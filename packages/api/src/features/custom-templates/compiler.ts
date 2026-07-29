import type {
	TemplateAst,
	TemplateCompilerReport,
	TemplateComposerContentNode,
	TemplateNode,
	TemplateSectionKind,
	TemplateSectionNode,
} from "@reactive-resume/schema/template-ast";
import type { TemplateVisionBlueprint } from "@reactive-resume/schema/template-vision";
import { inflateRawSync } from "node:zlib";
import {
	createComposerTableLayout,
	createDefaultSectionBody,
	defaultTemplateAst,
	templateAstSchema,
	templateSectionComponentRegistry,
} from "@reactive-resume/schema/template-ast";
import { generateId } from "@reactive-resume/utils/string";

type CompileInput = {
	data: Uint8Array;
	mediaType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	visionBlueprint?: TemplateVisionBlueprint | null;
};

type CompileOutput = { ast: TemplateAst; report: TemplateCompilerReport };

type LocatedText = { text: string; x: number; y: number; fontSize: number; page: number };
type DetectedTable = {
	title?: string;
	mode: "static" | "section-items";
	orientation: "horizontal" | "key-value";
	headerVisible?: boolean;
	columns: {
		id: string;
		label: string;
		binding?:
			| "item.primary"
			| "item.secondary"
			| "item.meta"
			| "item.description"
			| "item.keywords"
			| "item.value"
			| "item.level"
			| "item.experience"
			| "item.lastUsed";
		width?: number;
		align: "left" | "center" | "right";
	}[];
	rows: string[][];
	fieldRows?: string[][];
	sourceRowCount: number;
	evidence: string[];
};
type DetectedSection = {
	section: TemplateSectionKind;
	column?: "main" | "sidebar";
	title?: string;
	page?: number;
	itemColumns?: number;
	presentation?: "grouped-fields" | "numbered-items" | "tables" | "proficiency-bars";
	presentationEvidence?: string[];
	tables?: DetectedTable[];
};

function blueprintVariant(section: TemplateVisionBlueprint["sections"][number]): TemplateSectionNode["variant"] {
	if (section.layout.component === "timeline") return "timeline";
	if (section.layout.component === "tags") return "tags";
	if (section.layout.component === "table") return "table";
	if (section.layout.component === "list") return "bullets";
	if (section.layout.component === "cards") return "boxed";
	return "standard";
}

function supportedVisionVariant(
	node: TemplateSectionNode,
	suggested: TemplateSectionNode["variant"],
): TemplateSectionNode["variant"] {
	const supported = templateSectionComponentRegistry[node.section].supportedVariants as readonly string[];
	return supported.includes(suggested) ? suggested : node.variant;
}

const VISION_PRESENTATION_THRESHOLD = 0.72;

function mergeVisionBody(
	node: TemplateSectionNode,
	section: TemplateVisionBlueprint["sections"][number],
	preserveParsedStructure: boolean,
): NonNullable<TemplateSectionNode["body"]> {
	const deterministicBody = node.body ?? createDefaultSectionBody(node);
	const suggestedByBinding = new Map(section.blocks.map((block) => [block.binding, block]));
	const mergeBlockSuggestions = (entry: TemplateComposerContentNode): TemplateComposerContentNode => {
		if (entry.type === "block") {
			const suggestion = suggestedByBinding.get(entry.binding);
			if (!suggestion) return entry;
			return {
				...entry,
				component: preserveParsedStructure ? entry.component : suggestion.component,
				variant: suggestion.variant,
				// Content availability is deterministic. Vision cannot hide a parsed binding.
				visible: entry.visible,
			};
		}
		return {
			...entry,
			children: entry.children.map(mergeBlockSuggestions),
		};
	};

	return {
		component: preserveParsedStructure ? deterministicBody.component : section.layout.component,
		root: {
			...deterministicBody.root,
			props: {
				...deterministicBody.root.props,
				...(preserveParsedStructure
					? {}
					: {
							columns: section.layout.columns,
							columnGap: section.layout.columnGap,
							rowGap: section.layout.rowGap,
						}),
			},
			children: deterministicBody.root.children.map(mergeBlockSuggestions),
		},
	};
}

function hasParsedContentPresentation(entry: TemplateComposerContentNode): boolean {
	if (entry.type === "block") return entry.component === "table" && Boolean(entry.table);
	if (entry.type === "repeat") {
		if (entry.itemMarker && entry.itemMarker !== "none") return true;
		return entry.children.some(hasParsedContentPresentation);
	}
	if (entry.type === "layout") {
		if (entry.component === "table") return true;
		return entry.children.some(hasParsedContentPresentation);
	}
	return false;
}

function visionSectionMatchScore(
	deterministic: TemplateSectionNode,
	vision: TemplateVisionBlueprint["sections"][number],
	deterministicIndex: number,
) {
	if (deterministic.section !== vision.section) return Number.NEGATIVE_INFINITY;
	let score = 10 - Math.abs(deterministicIndex - vision.order) * 0.1;
	const deterministicTitle = normalizeHeading(deterministic.title ?? deterministic.section);
	const visionTitle = normalizeHeading(vision.sourceTitle ?? vision.section);
	if (deterministicTitle === visionTitle) score += 4;
	else if (deterministicTitle.includes(visionTitle) || visionTitle.includes(deterministicTitle)) score += 2;
	return score;
}

function visionSectionItemsTable(section: TemplateVisionBlueprint["sections"][number]): DetectedTable | undefined {
	if (!["experience", "projects"].includes(section.section)) return undefined;
	const table = section.tables?.find(
		(candidate) =>
			candidate.kind === "section-items" &&
			candidate.orientation === "key-value-cards" &&
			candidate.confidence >= VISION_PRESENTATION_THRESHOLD &&
			candidate.evidence.length > 0,
	);
	if (!table) return undefined;
	const allowedBindings = new Set([
		"item.primary",
		"item.secondary",
		"item.meta",
		"item.description",
		"item.keywords",
		"item.value",
		"item.level",
		"item.experience",
		"item.lastUsed",
	]);
	const roleBindings = {
		primary: "item.primary",
		secondary: "item.secondary",
		meta: "item.meta",
		description: "item.description",
		keywords: "item.keywords",
		level: "item.level",
		experience: "item.experience",
		"last-used": "item.lastUsed",
		reference: "item.value",
	} as const;
	const columns = table.columns
		.filter((column) => column.confidence >= VISION_PRESENTATION_THRESHOLD)
		.map((column, index) => {
			const normalizedLabel = normalizeHeading(column.label);
			const deterministicDefinition = sectionItemTableFieldDefinitions.find((definition) =>
				definition.pattern.test(normalizedLabel),
			);
			const explicitBinding =
				column.binding && allowedBindings.has(column.binding)
					? (column.binding as DetectedTable["columns"][number]["binding"])
					: undefined;
			return {
				id: deterministicDefinition?.id ?? `field-${index + 1}`,
				label: column.label,
				binding:
					section.section === "experience" && deterministicDefinition?.id === "position"
						? "item.primary"
						: (deterministicDefinition?.binding ?? explicitBinding ?? roleBindings[column.role]),
				width: 24,
				align: "left" as const,
			};
		});
	if (columns.length < 2) return undefined;
	return {
		mode: "section-items",
		orientation: "key-value",
		headerVisible: false,
		columns,
		rows: [],
		sourceRowCount: table.recordCount ?? 0,
		fieldRows: columns.map((column) => [column.id]),
		evidence: table.evidence,
	};
}

function applyVisionBlueprint(output: CompileOutput, blueprint: TemplateVisionBlueprint): CompileOutput {
	const availableVisionSections = blueprint.sections
		.map((section, index) => ({ section, index }))
		.filter(
			({ section }) =>
				blueprint.overallConfidence >= VISION_PRESENTATION_THRESHOLD &&
				section.confidence >= VISION_PRESENTATION_THRESHOLD &&
				section.evidence.length > 0,
		);
	const usedVisionIndexes = new Set<number>();
	const acceptedVisionSections: TemplateVisionBlueprint["sections"] = [];

	const nodes = output.ast.nodes.map((node, deterministicIndex): TemplateNode => {
		if (node.type === "header") {
			if (blueprint.overallConfidence < VISION_PRESENTATION_THRESHOLD) return node;
			return { ...node, variant: blueprint.header.variant };
		}
		if (node.type !== "section") return node;

		const match = availableVisionSections
			.filter(({ index }) => !usedVisionIndexes.has(index))
			.map((candidate) => ({
				...candidate,
				score: visionSectionMatchScore(node, candidate.section, deterministicIndex),
			}))
			.filter(({ score }) => Number.isFinite(score))
			.sort((a, b) => b.score - a.score)[0];
		if (!match) return node;

		usedVisionIndexes.add(match.index);
		acceptedVisionSections.push(match.section);
		const preserveParsedStructure =
			hasParsedContentPresentation(node.body?.root ?? createDefaultSectionBody(node).root) ||
			(node.section === "skills" && node.body?.component === "list");
		const sectionItemsTable = visionSectionItemsTable(match.section);
		const variant = supportedVisionVariant(
			node,
			sectionItemsTable ? ("boxed" as const) : blueprintVariant(match.section),
		);
		const visionPresentation =
			!preserveParsedStructure && match.section.dataModel?.kind === "grouped-fields" && node.section === "skills"
				? ("grouped-fields" as const)
				: !preserveParsedStructure &&
						node.section === "skills" &&
						match.section.dataModel?.fields.some((field) => field.role === "level" && field.confidence >= 0.72)
					? ("proficiency-bars" as const)
					: !preserveParsedStructure &&
							match.section.dataModel?.numbered &&
							["experience", "projects"].includes(node.section)
						? ("numbered-items" as const)
						: undefined;
		const suggestedNode = {
			...node,
			variant: preserveParsedStructure ? node.variant : variant,
		};
		const body =
			sectionItemsTable && !preserveParsedStructure
				? createMappedSectionBody(suggestedNode, {
						section: node.section,
						...(match.section.sourceTitle ? { title: match.section.sourceTitle } : {}),
						presentation: "tables",
						presentationEvidence: sectionItemsTable.evidence,
						tables: [sectionItemsTable],
					})
				: visionPresentation
					? createMappedSectionBody(suggestedNode, {
							section: node.section,
							...(match.section.sourceTitle ? { title: match.section.sourceTitle } : {}),
							presentation: visionPresentation,
							presentationEvidence: match.section.evidence,
						})
					: mergeVisionBody(node, match.section, preserveParsedStructure);
		return {
			...suggestedNode,
			// Parser owns identity, source title, source order, region and page-break evidence.
			itemLayout: preserveParsedStructure
				? node.itemLayout
				: sectionItemsTable
					? { columns: 1, columnGap: 0, rowGap: 12 }
					: {
							columns: match.section.layout.columns,
							columnGap: match.section.layout.columnGap,
							rowGap: match.section.layout.rowGap,
						},
			appearance: {
				heading: match.section.layout.heading,
				itemHeader: node.appearance?.itemHeader ?? "split",
				itemDecoration: preserveParsedStructure
					? (node.appearance?.itemDecoration ?? "none")
					: sectionItemsTable
						? "card"
						: match.section.layout.component === "cards"
							? "card"
							: match.section.layout.component === "timeline"
								? "divider"
								: (node.appearance?.itemDecoration ?? "none"),
			},
			body,
		};
	});

	const layoutAgreement = blueprint.page.preset === output.ast.layout.preset;
	const acceptsGlobalPresentation = blueprint.overallConfidence >= VISION_PRESENTATION_THRESHOLD;
	const tokenOverrides = acceptsGlobalPresentation
		? (Object.fromEntries(Object.entries(blueprint.tokens).filter(([, value]) => value !== undefined)) as Partial<
				TemplateAst["tokens"]
			>)
		: {};
	const layout =
		layoutAgreement && acceptsGlobalPresentation
			? {
					...output.ast.layout,
					sidebarWidth: blueprint.page.sidebarWidth,
					sidebarPosition: blueprint.page.sidebarPosition,
					columnGap: blueprint.page.gap,
					pagePadding: blueprint.page.pagePadding,
					...(output.ast.layout.preset === "grid" && output.ast.layout.pageGrid
						? {
								pageGrid: {
									...output.ast.layout.pageGrid,
									gap: blueprint.page.gap,
								},
							}
						: {}),
				}
			: output.ast.layout;
	const ast = templateAstSchema.parse({
		...output.ast,
		schemaVersion: "0.2",
		layout,
		tokens: { ...output.ast.tokens, ...tokenOverrides },
		nodes,
		// Recompose from parser-owned node order and placement.
		page: undefined,
	});
	const rejectedVisionSections = blueprint.sections.filter((section) => !acceptedVisionSections.includes(section));
	const reconciliationWarnings = [
		...(!layoutAgreement
			? [`AI Vision suggested ${blueprint.page.preset}, but parser mapping retained ${output.ast.layout.preset}.`]
			: []),
		...rejectedVisionSections.map(
			(section) =>
				`AI Vision suggestion for "${section.sourceTitle ?? section.section}" was not applied because parser evidence or confidence was insufficient.`,
		),
	];
	return {
		ast,
		report: {
			...output.report,
			visualFidelity: roundScore(
				acceptedVisionSections.length > 0
					? Math.max(
							output.report.visualFidelity,
							output.report.visualFidelity * 0.75 + blueprint.overallConfidence * 0.25,
						)
					: output.report.visualFidelity,
			),
			detectedLayout: ast.layout.preset,
			detectedSections: output.report.detectedSections,
			warnings: [...new Set([...output.report.warnings, ...blueprint.warnings, ...reconciliationWarnings])],
			mappingSummary: {
				...output.report.mappingSummary,
				supported: [
					...output.report.mappingSummary.supported,
					`AI Vision suggestions reconciled against parser evidence: ${blueprint.analysisMode}`,
					...acceptedVisionSections.map(
						(section) =>
							`Accepted presentation suggestion: ${section.sourceTitle ?? section.section} → ${section.layout.component}`,
					),
				],
				approximated: [
					...output.report.mappingSummary.approximated,
					...rejectedVisionSections.map(
						(section) => `Rejected AI-only section/layout suggestion: ${section.sourceTitle ?? section.section}`,
					),
				],
			},
		},
	};
}

const sectionAliases: Record<TemplateSectionKind, string[]> = {
	summary: [
		"summary",
		"profile",
		"objective",
		"about",
		"professional summary",
		"career summary",
		"overview",
		"highlights",
		"tóm tắt",
		"mục tiêu",
		"mục tiêu nghề nghiệp",
	],
	profiles: [
		"profiles",
		"social profiles",
		"links",
		"social",
		"personal information",
		"personal details",
		"contact information",
		"liên kết",
		"thông tin cá nhân",
	],
	experience: [
		"experience",
		"work experience",
		"professional experience",
		"employment",
		"kinh nghiệm",
		"quá trình công tác",
	],
	education: ["education", "academic", "học vấn", "giáo dục"],
	projects: ["projects", "selected projects", "personal projects", "dự án", "dự án cá nhân"],
	skills: [
		"skills",
		"technical skills",
		"soft skills",
		"core skills",
		"technical expertise",
		"technical expertise skills",
		"expertise",
		"kỹ năng",
	],
	languages: ["languages", "language", "ngôn ngữ"],
	certifications: ["certifications", "certificates", "chứng chỉ", "chứng nhận"],
	interests: ["interests", "hobbies", "sở thích"],
	awards: ["awards", "honors", "achievements", "giải thưởng", "thành tích"],
	publications: ["publications", "articles", "ấn phẩm", "bài viết"],
	volunteer: ["volunteer", "volunteering", "community", "tình nguyện"],
	references: ["references", "referees", "người tham chiếu"],
};

function stripHeadingPrefix(value: string) {
	return value.replace(/^\s*(?:\d{1,2}|[a-z]|[ivxlcdm]{1,6})\s*[.):-]\s*/iu, "");
}

function normalizeHeading(value: string) {
	return stripHeadingPrefix(value)
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function detectSections(value: string): TemplateSectionKind[] {
	const normalized = normalizeHeading(value);
	if (!normalized || normalized.split(" ").length > 10) return [];
	const headingParts = [
		normalized,
		...stripHeadingPrefix(value)
			.split(/\s*(?:&|\/|\||,|;|\+|\band\b|\bvà\b)\s*/giu)
			.map(normalizeHeading),
	];

	return (Object.entries(sectionAliases) as [TemplateSectionKind, string[]][]).flatMap(([section, aliases]) => {
		const matched = aliases.some((alias) => headingParts.includes(normalizeHeading(alias)));
		return matched ? [section] : [];
	});
}

function isLikelySectionHeading(value: string, fontSize?: number, bodySize?: number) {
	const text = stripHeadingPrefix(value).trim();
	const knownSemanticHeading = detectSections(text).length > 0;
	const letters = text.match(/\p{L}/gu) ?? [];
	const uppercase = letters.length > 0 && text === text.toUpperCase();
	const titleCase = text
		.split(/\s+/)
		.filter(Boolean)
		.every((word) => !/\p{L}/u.test(word) || /^\p{Lu}/u.test(word));
	const visiblyLarger = fontSize !== undefined && bodySize !== undefined && fontSize >= bodySize * 1.08;
	return knownSemanticHeading || uppercase || titleCase || /:\s*$/u.test(text) || visiblyLarger;
}

function median(values: number[], fallback: number) {
	if (values.length === 0) return fallback;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? fallback;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

function roundScore(value: number) {
	return Number(clamp(value, 0, 1).toFixed(3));
}

function semanticConfidence(sectionCount: number) {
	return roundScore(clamp(0.18 + sectionCount * 0.15, 0.18, 0.94));
}

function normalizeHexColor(value: string | undefined) {
	if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return undefined;
	return value.toLowerCase();
}

function colorMetrics(color: string) {
	const red = Number.parseInt(color.slice(1, 3), 16);
	const green = Number.parseInt(color.slice(3, 5), 16);
	const blue = Number.parseInt(color.slice(5, 7), 16);
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	return { chroma: max - min, lightness: (max + min) / 510 };
}

function pickAccentColor(colors: Map<string, number>) {
	return [...colors.entries()]
		.filter(([color]) => {
			const { chroma, lightness } = colorMetrics(color);
			return chroma >= 42 && lightness >= 0.12 && lightness <= 0.92;
		})
		.sort((a, b) => b[1] - a[1])[0]?.[0];
}

function pickTextColor(colors: Map<string, number>) {
	return [...colors.entries()]
		.filter(([color]) => colorMetrics(color).lightness <= 0.28)
		.sort((a, b) => b[1] - a[1])[0]?.[0];
}

function resolveSectionVariant(section: DetectedSection): TemplateSectionNode["variant"] {
	const title = normalizeHeading(section.title ?? "");
	if (section.presentation === "tables") return section.section === "skills" ? "table" : "boxed";
	if (section.presentation === "proficiency-bars" && section.section === "skills") return "bullets";
	if (section.presentation === "grouped-fields" && section.section === "skills") return "bullets";
	if (section.presentation === "numbered-items" && ["experience", "projects"].includes(section.section))
		return "standard";
	if (section.section === "skills" && title.includes("expertise")) return "table";
	if (section.section === "skills" && (title.includes("technical") || title.includes("soft"))) return "bullets";
	if (section.section === "skills") return "tags";
	if (section.section === "experience" && title.includes("professional")) return "boxed";
	if (section.section === "experience") return "timeline";
	return "standard";
}

function resolveSkillSlice(section: DetectedSection) {
	if (section.section !== "skills") return {};
	const title = normalizeHeading(section.title ?? "");
	if (title.includes("soft")) return { itemStart: 4, itemCount: 4 };
	if (title.includes("expertise")) return { itemStart: 0, itemCount: 8 };
	if (title.includes("technical")) return { itemStart: 0, itemCount: 4 };
	return {};
}

function resolveSectionItemLayout(section: DetectedSection): TemplateSectionNode["itemLayout"] {
	if (
		section.presentation === "grouped-fields" ||
		section.presentation === "numbered-items" ||
		section.presentation === "tables" ||
		section.presentation === "proficiency-bars"
	) {
		return {
			columns: 1,
			columnGap: 0,
			rowGap: section.presentation === "numbered-items" ? 10 : 6,
		};
	}
	const inferredColumns =
		section.itemColumns ?? (["skills", "languages", "certifications", "interests"].includes(section.section) ? 2 : 1);
	return {
		columns: clamp(Math.round(inferredColumns), 1, 6),
		columnGap: 8,
		rowGap: 8,
	};
}

function resolveSectionAppearance(section: DetectedSection): TemplateSectionNode["appearance"] {
	const variant = resolveSectionVariant(section);
	return {
		heading: variant === "table" ? "filled" : "underline",
		itemHeader: variant === "compact" ? "inline" : "split",
		itemDecoration: variant === "boxed" ? "card" : variant === "timeline" ? "divider" : "none",
	};
}

function tableLayout(nodeId: string, table: DetectedTable) {
	return createComposerTableLayout(`${nodeId}-${table.mode}-${table.columns[0]?.id ?? "table"}`, {
		mode: table.mode,
		orientation: table.orientation,
		...(table.title ? { title: table.title } : {}),
		columns: table.columns,
		rows: table.mode === "static" ? table.rows : [],
		headerVisible: table.headerVisible ?? true,
	});
}

function sectionTableId(base: string, suffix: string) {
	return `${base.slice(0, Math.max(1, 79 - suffix.length))}-${suffix}`;
}

function sectionTableBlock(
	id: string,
	input:
		| { binding: NonNullable<DetectedTable["columns"][number]["binding"]>; literal?: never }
		| { binding?: never; literal: string },
	variant: "plain" | "strong" | "muted" | "accent" = "plain",
): TemplateComposerContentNode {
	if (input.binding) {
		return {
			id,
			type: "block",
			component: input.binding === "item.description" || input.binding === "item.value" ? "rich-text" : "text",
			binding: input.binding,
			variant,
			visible: true,
		};
	}
	return {
		id,
		type: "block",
		component: "text",
		binding: "literal",
		literal: input.literal,
		variant,
		visible: true,
	};
}

function sectionTableCell(
	id: string,
	width: number,
	child: TemplateComposerContentNode,
	background: "page" | "sidebar" | "primary" = "page",
): TemplateComposerContentNode {
	return {
		id,
		type: "layout",
		component: "table-cell",
		props: { width, padding: 4, border: "solid", radius: 0, background },
		children: [child],
	};
}

function sectionTableRow(id: string, children: TemplateComposerContentNode[]): TemplateComposerContentNode {
	return {
		id,
		type: "layout",
		component: "table-row",
		props: { direction: "horizontal", gap: 0, align: "stretch" },
		children,
	};
}

function createExperienceTableBody(
	node: TemplateSectionNode,
	heading: TemplateComposerContentNode,
	table: DetectedTable,
): NonNullable<TemplateSectionNode["body"]> {
	const tableId = sectionTableId(node.id, "experience-table");
	const columns = new Map(table.columns.map((column) => [column.id, column]));
	const fieldRows = table.fieldRows?.length ? table.fieldRows : table.columns.map((column) => [column.id]);
	const rows: TemplateComposerContentNode[] = [
		sectionTableRow(sectionTableId(tableId, "header"), [
			sectionTableCell(
				sectionTableId(tableId, "header-title-cell"),
				62,
				sectionTableBlock(sectionTableId(tableId, "header-title"), { binding: "item.secondary" }, "strong"),
				"primary",
			),
			sectionTableCell(
				sectionTableId(tableId, "header-meta-cell"),
				38,
				sectionTableBlock(sectionTableId(tableId, "header-meta"), { binding: "item.meta" }, "strong"),
				"primary",
			),
		]),
	];

	for (const [rowIndex, fieldIds] of fieldRows.entries()) {
		const fields = fieldIds.flatMap((fieldId) => {
			const column = columns.get(fieldId);
			return column ? [column] : [];
		});
		if (fields.length === 0) continue;
		if (fields.length === 1) {
			const [field] = fields;
			if (!field) continue;
			rows.push(
				sectionTableRow(sectionTableId(tableId, `r${rowIndex + 1}-label`), [
					sectionTableCell(
						sectionTableId(tableId, `r${rowIndex + 1}-label-cell`),
						100,
						sectionTableBlock(
							sectionTableId(tableId, `r${rowIndex + 1}-label-text`),
							{ literal: field.label },
							"accent",
						),
						"sidebar",
					),
				]),
				sectionTableRow(sectionTableId(tableId, `r${rowIndex + 1}-value`), [
					sectionTableCell(
						sectionTableId(tableId, `r${rowIndex + 1}-value-cell`),
						100,
						sectionTableBlock(sectionTableId(tableId, `r${rowIndex + 1}-value-content`), {
							binding: field.binding ?? "item.value",
						}),
					),
				]),
			);
			continue;
		}

		const pairWidth = 100 / fields.length;
		rows.push(
			sectionTableRow(
				sectionTableId(tableId, `r${rowIndex + 1}`),
				fields.flatMap((field, fieldIndex) => [
					sectionTableCell(
						sectionTableId(tableId, `r${rowIndex + 1}-${fieldIndex + 1}-label-cell`),
						pairWidth * 0.3,
						sectionTableBlock(
							sectionTableId(tableId, `r${rowIndex + 1}-${fieldIndex + 1}-label-text`),
							{ literal: field.label },
							"accent",
						),
						"sidebar",
					),
					sectionTableCell(
						sectionTableId(tableId, `r${rowIndex + 1}-${fieldIndex + 1}-value-cell`),
						pairWidth * 0.7,
						sectionTableBlock(sectionTableId(tableId, `r${rowIndex + 1}-${fieldIndex + 1}-value-content`), {
							binding: field.binding ?? "item.value",
						}),
					),
				]),
			),
		);
	}

	return {
		component: "table",
		root: {
			id: sectionTableId(node.id, "body"),
			type: "layout",
			component: "stack",
			props: { columns: 1, rowGap: 12 },
			children: [
				heading,
				{
					id: sectionTableId(node.id, "experience-cards"),
					type: "repeat",
					binding: "section.items",
					label: "Experience table card",
					itemMarker: "none",
					children: [
						{
							id: sectionTableId(node.id, "experience-card"),
							type: "layout",
							component: "box",
							props: { gap: 0, border: "solid", radius: 0, background: "page" },
							children: [
								{
									id: tableId,
									type: "layout",
									component: "table",
									props: { gap: 0, border: "none", radius: 0 },
									children: rows,
								},
							],
						},
					],
				},
			],
		},
	};
}

function createMappedSectionBody(node: TemplateSectionNode, detected: DetectedSection) {
	const fallback = createDefaultSectionBody(node);
	const heading = fallback.root.children.find((entry) => entry.type === "block" && entry.binding === "section.title");
	if (!heading) return fallback;

	const sectionItemsTable = detected.tables?.find(
		(table) => table.mode === "section-items" && table.orientation === "key-value",
	);
	if (detected.section === "experience" && detected.presentation === "tables" && sectionItemsTable) {
		return createExperienceTableBody(node, heading, sectionItemsTable);
	}
	if (detected.section === "projects" && detected.presentation === "tables" && sectionItemsTable) {
		return {
			component: "cards" as const,
			root: {
				...fallback.root,
				props: { ...fallback.root.props, columns: 1, rowGap: 12 },
				children: [
					heading,
					{
						id: `${node.id}-project-cards`,
						type: "repeat" as const,
						binding: "section.items" as const,
						label: "Project table card",
						itemMarker: "none" as const,
						children: [
							{
								id: `${node.id}-project-card`,
								type: "layout" as const,
								component: "box" as const,
								props: {
									gap: 0,
									border: "solid" as const,
									radius: 0,
									background: "page" as const,
								},
								children: [
									{
										id: `${node.id}-project-header`,
										type: "layout" as const,
										component: "stack" as const,
										props: {
											gap: 2,
											padding: 6,
											background: "sidebar" as const,
											border: "none" as const,
										},
										children: [
											{
												id: `${node.id}-project-name`,
												type: "block" as const,
												component: "text" as const,
												binding: "item.primary" as const,
												variant: "strong" as const,
												visible: true,
											},
											{
												id: `${node.id}-project-duration`,
												type: "block" as const,
												component: "meta" as const,
												binding: "item.meta" as const,
												variant: "plain" as const,
												visible: true,
												prefix: "Duration: ",
											},
										],
									},
									tableLayout(node.id, sectionItemsTable),
								],
							},
						],
					},
				],
			},
		};
	}

	if (detected.presentation === "tables" && detected.tables?.length) {
		return {
			component: "table" as const,
			root: {
				...fallback.root,
				props: { ...fallback.root.props, columns: 1, rowGap: 8 },
				children: [
					heading,
					{
						id: `${node.id}-tables`,
						type: "layout" as const,
						component: "columns" as const,
						props: { gap: 10, align: "start" as const },
						children: detected.tables.map((table) => tableLayout(node.id, table)),
					},
				],
			},
		};
	}

	if (detected.section === "skills" && detected.presentation === "proficiency-bars") {
		return {
			component: "list" as const,
			root: {
				...fallback.root,
				props: { ...fallback.root.props, columns: 1, rowGap: 8 },
				children: [
					heading,
					{
						id: `${node.id}-items`,
						type: "repeat" as const,
						binding: "section.items" as const,
						label: "Skill proficiency",
						itemMarker: "none" as const,
						children: [
							{
								id: `${node.id}-skill-progress`,
								type: "layout" as const,
								component: "stack" as const,
								props: { gap: 3 },
								children: [
									{
										id: `${node.id}-primary`,
										type: "block" as const,
										component: "text" as const,
										binding: "item.primary" as const,
										variant: "strong" as const,
										visible: true,
									},
									{
										id: `${node.id}-level`,
										type: "block" as const,
										component: "progress" as const,
										binding: "item.level" as const,
										variant: "accent" as const,
										visible: true,
									},
								],
							},
						],
					},
				],
			},
		};
	}

	if (detected.section === "skills" && detected.presentation === "grouped-fields") {
		return {
			component: "list" as const,
			root: {
				...fallback.root,
				props: { ...fallback.root.props, columns: 1, rowGap: 6 },
				children: [
					heading,
					{
						id: `${node.id}-items`,
						type: "repeat" as const,
						binding: "section.items" as const,
						label: "Skill group",
						itemMarker: "none" as const,
						children: [
							{
								id: `${node.id}-item-layout`,
								type: "layout" as const,
								component: "row" as const,
								props: { gap: 4, align: "start" as const },
								children: [
									{
										id: `${node.id}-primary`,
										type: "block" as const,
										component: "text" as const,
										binding: "item.primary" as const,
										variant: "strong" as const,
										visible: true,
										suffix: ":",
									},
									{
										id: `${node.id}-keywords`,
										type: "block" as const,
										component: "text" as const,
										binding: "item.keywords" as const,
										variant: "plain" as const,
										visible: true,
									},
								],
							},
						],
					},
				],
			},
		};
	}

	if (["experience", "projects"].includes(detected.section) && detected.presentation === "numbered-items") {
		return {
			component: "list" as const,
			root: {
				...fallback.root,
				props: { ...fallback.root.props, columns: 1, rowGap: 10 },
				children: [
					heading,
					{
						id: `${node.id}-items`,
						type: "repeat" as const,
						binding: "section.items" as const,
						label: detected.section === "projects" ? "Project item" : "Experience item",
						itemMarker: "number" as const,
						children: [
							{
								id: `${node.id}-item-layout`,
								type: "layout" as const,
								component: "stack" as const,
								props: { gap: 3 },
								children: [
									{
										id: `${node.id}-title-row`,
										type: "layout" as const,
										component: "row" as const,
										props: { gap: 6, justify: "between" as const, align: "start" as const },
										children: [
											{
												id: `${node.id}-primary`,
												type: "block" as const,
												component: "text" as const,
												binding: "item.primary" as const,
												variant: "strong" as const,
												visible: true,
											},
											{
												id: `${node.id}-meta`,
												type: "block" as const,
												component: "meta" as const,
												binding: "item.meta" as const,
												variant: "plain" as const,
												visible: true,
											},
										],
									},
									{
										id: `${node.id}-secondary`,
										type: "block" as const,
										component: "text" as const,
										binding: "item.secondary" as const,
										variant: "strong" as const,
										visible: true,
									},
									{
										id: `${node.id}-description`,
										type: "block" as const,
										component: "list" as const,
										binding: "item.description" as const,
										variant: "bullet" as const,
										visible: true,
									},
									{
										id: `${node.id}-keywords`,
										type: "block" as const,
										component: "text" as const,
										binding: "item.keywords" as const,
										variant: "strong" as const,
										visible: true,
										prefix: "Technologies: ",
									},
								],
							},
						],
					},
				],
			},
		};
	}

	return fallback;
}

function inferPdfSectionItemColumns(
	heading: LocatedText,
	section: TemplateSectionKind,
	headings: LocatedText[],
	lines: LocatedText[],
) {
	if (!["profiles", "skills", "languages", "certifications", "interests"].includes(section)) return undefined;
	const nextHeading = headings
		.filter((candidate) => candidate.page === heading.page && candidate.y < heading.y)
		.sort((a, b) => b.y - a.y)[0];
	const lowerBoundary = nextHeading?.y ?? Number.NEGATIVE_INFINITY;
	const bodyLines = lines.filter(
		(line) => line.page === heading.page && line.y < heading.y - 2 && line.y > lowerBoundary + 2,
	);
	const bins = new Map<number, number>();
	for (const line of bodyLines) {
		const bin = Math.round(line.x / 0.08);
		bins.set(bin, (bins.get(bin) ?? 0) + 1);
	}
	const activeBins = [...bins.entries()]
		.filter(([, count]) => count >= 2)
		.map(([bin]) => bin)
		.sort((a, b) => a - b);
	if (activeBins.length < 2 || (activeBins.at(-1) ?? 0) - (activeBins[0] ?? 0) < 2) return undefined;
	return Math.min(3, activeBins.length);
}

function joinPdfCell(items: LocatedText[]) {
	return items
		.sort((a, b) => b.y - a.y || a.x - b.x)
		.map((item) => item.text.trim())
		.filter(Boolean)
		.join(" ")
		.replace(/\s+([,.;:])/g, "$1")
		.replace(/\s*\/\s*/g, " / ")
		.replace(/\s+/g, " ")
		.trim();
}

function extractPdfTableRows(input: {
	items: LocatedText[];
	page: number;
	headerY: number;
	columnX: number[];
	anchors: LocatedText[];
	minX?: number;
	maxX?: number;
	bottomY?: number;
}) {
	const sortedAnchors = [...input.anchors].sort((a, b) => b.y - a.y);
	const bounds = input.columnX.map((x, index) => ({
		start: index === 0 ? (input.minX ?? Number.NEGATIVE_INFINITY) : ((input.columnX[index - 1] ?? x) + x) / 2,
		end:
			index === input.columnX.length - 1
				? (input.maxX ?? Number.POSITIVE_INFINITY)
				: (x + (input.columnX[index + 1] ?? x)) / 2,
	}));
	return sortedAnchors.map((anchor, index) => {
		const nextY = sortedAnchors[index + 1]?.y ?? Number.NEGATIVE_INFINITY;
		return bounds.map((bound) =>
			joinPdfCell(
				input.items.filter(
					(item) =>
						item.page === input.page &&
						item.y < input.headerY - 2 &&
						item.y <= anchor.y + 2 &&
						item.y > Math.max(nextY + 2, input.bottomY ?? Number.NEGATIVE_INFINITY) &&
						item.x >= bound.start &&
						item.x < bound.end,
				),
			),
		);
	});
}

function detectPdfSkillsTables(heading: LocatedText, items: LocatedText[]): DetectedTable[] {
	const pageItems = items.filter(
		(item) => item.page === heading.page && item.y < heading.y - 4 && item.y > heading.y - 260,
	);
	const normalized = (value: string) => normalizeHeading(value).replace(/\s+/g, " ");
	const find = (pattern: RegExp, range?: { min: number; max: number }) =>
		pageItems.find(
			(item) => pattern.test(normalized(item.text)) && (!range || (item.x >= range.min && item.x <= range.max)),
		);
	const levelHeader = find(/^(?:lv|level)$/u, { min: 0, max: 0.2 });
	const titleHeader = find(/^title$/u, { min: 0.1, max: 0.4 });
	const descriptionHeader = find(/^description$/u, { min: 0.2, max: 0.55 });
	const skillHeader = find(/^(?:skill|technology skill)$/u, { min: 0.4, max: 0.7 });
	const proficiencyHeader = find(/^proficiency$/u, { min: 0.55, max: 0.78 });
	const experienceHeader = find(/^experience$/u, { min: 0.65, max: 0.9 });
	const lastHeader = find(/^last(?: used)?$/u, { min: 0.78, max: 1 });
	const usedHeader = find(/^used$/u, { min: 0.78, max: 1 });
	if (
		!levelHeader ||
		!titleHeader ||
		!descriptionHeader ||
		!skillHeader ||
		!proficiencyHeader ||
		!experienceHeader ||
		!lastHeader
	) {
		return [];
	}

	const headerY = Math.max(
		levelHeader.y,
		titleHeader.y,
		descriptionHeader.y,
		skillHeader.y,
		proficiencyHeader.y,
		experienceHeader.y,
		lastHeader.y,
	);
	const staticAnchors = pageItems.filter(
		(item) => item.x < (levelHeader.x + titleHeader.x) / 2 && /^\d{1,2}$/u.test(item.text) && item.y < headerY - 2,
	);
	const dynamicAnchors = pageItems.filter(
		(item) =>
			item.x >= (experienceHeader.x + lastHeader.x) / 2 && /^(?:19|20)\d{2}$/u.test(item.text) && item.y < headerY - 2,
	);
	if (staticAnchors.length < 2 || dynamicAnchors.length < 2) return [];

	const staticRows = extractPdfTableRows({
		items: pageItems,
		page: heading.page,
		headerY,
		columnX: [levelHeader.x, titleHeader.x, descriptionHeader.x],
		anchors: staticAnchors,
		minX: 0.08,
		maxX: (descriptionHeader.x + skillHeader.x) / 2,
		bottomY: Math.min(...staticAnchors.map((item) => item.y)) - 24,
	});
	const dynamicRows = extractPdfTableRows({
		items: pageItems,
		page: heading.page,
		headerY,
		columnX: [skillHeader.x, proficiencyHeader.x, experienceHeader.x, lastHeader.x],
		anchors: dynamicAnchors,
		minX: (descriptionHeader.x + skillHeader.x) / 2,
		maxX: 0.94,
		bottomY: Math.min(...dynamicAnchors.map((item) => item.y)) - 24,
	});
	const nearbyTitles = pageItems
		.filter((item) => item.y > headerY + 3 && item.y < heading.y - 2)
		.sort((a, b) => a.x - b.x);
	const leftTitle = nearbyTitles.find((item) => item.x < 0.4)?.text;
	const rightTitle = nearbyTitles.find((item) => item.x >= 0.4)?.text;

	return [
		{
			title: leftTitle ?? "Proficiency Description",
			mode: "static",
			orientation: "horizontal",
			columns: [
				{ id: "level", label: levelHeader.text, width: 12, align: "center" },
				{ id: "title", label: titleHeader.text, width: 32, align: "left" },
				{ id: "description", label: descriptionHeader.text, width: 56, align: "left" },
			],
			rows: staticRows,
			sourceRowCount: staticRows.length,
			evidence: [levelHeader.text, titleHeader.text, descriptionHeader.text],
		},
		{
			title: rightTitle ?? skillHeader.text,
			mode: "section-items",
			orientation: "horizontal",
			columns: [
				{ id: "skill", label: skillHeader.text, binding: "item.primary", width: 40, align: "left" },
				{
					id: "proficiency",
					label: proficiencyHeader.text,
					binding: "item.level",
					width: 20,
					align: "center",
				},
				{
					id: "experience",
					label: experienceHeader.text,
					binding: "item.experience",
					width: 22,
					align: "center",
				},
				{
					id: "last-used",
					label: usedHeader ? `${lastHeader.text} ${usedHeader.text}` : lastHeader.text,
					binding: "item.lastUsed",
					width: 18,
					align: "center",
				},
			],
			rows: dynamicRows,
			sourceRowCount: dynamicRows.length,
			evidence: [skillHeader.text, proficiencyHeader.text, experienceHeader.text, lastHeader.text],
		},
	];
}

const sectionItemTableFieldDefinitions = [
	{
		id: "description",
		label: "Description",
		pattern: /^(?:description|objectives? description|mô tả)$/u,
		binding: "item.description" as const,
	},
	{
		id: "team-size",
		label: "Team size",
		pattern: /^(?:team size|team|quy mô đội ngũ)$/u,
		binding: "item.experience" as const,
	},
	{
		id: "technology",
		label: "Tech stack",
		pattern: /^(?:tech stack|technology|technologies|công nghệ)$/u,
		binding: "item.keywords" as const,
	},
	{
		id: "position",
		label: "Position",
		pattern: /^(?:position|role|vai trò)$/u,
		binding: "item.secondary" as const,
	},
	{
		id: "responsibility",
		label: "Responsibility",
		pattern: /^(?:responsibility|responsibilities|key responsibilities|trách nhiệm)$/u,
		binding: "item.value" as const,
	},
] as const;

function pdfItemComesAfter(item: LocatedText, boundary: LocatedText) {
	return item.page > boundary.page || (item.page === boundary.page && item.y < boundary.y - 2);
}

function pdfItemComesBefore(item: LocatedText, boundary: LocatedText) {
	return item.page < boundary.page || (item.page === boundary.page && item.y > boundary.y + 2);
}

function inlineFieldLabel(value: string) {
	return value.split(":")[0]?.trim() ?? value.trim();
}

function recordHeaderKey(item: LocatedText) {
	return `${item.page}:${Math.round(item.y)}`;
}

export function detectPdfSectionItemTables(
	heading: LocatedText,
	section: "experience" | "projects",
	items: LocatedText[],
	headings: LocatedText[],
): DetectedTable[] {
	const nextHeading = headings
		.filter((candidate) => candidate !== heading && pdfItemComesAfter(candidate, heading))
		.sort((a, b) => a.page - b.page || b.y - a.y)[0];
	const sectionItems = items.filter(
		(item) => pdfItemComesAfter(item, heading) && (!nextHeading || pdfItemComesBefore(item, nextHeading)),
	);
	const normalized = (value: string) => normalizeHeading(value).replace(/\s+/g, " ");
	const projectHeaders = sectionItems.filter((item) => /^project\s*\d+\s*(?::|-)\s*\S+/iu.test(item.text.trim()));
	const datedHeaders = sectionItems.flatMap((date) => {
		const isDate =
			date.x >= 0.55 && /(?:\bpresent\b|\bnay\b|(?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}|(?:19|20)\d{2})/iu.test(date.text);
		if (!isDate) return [];
		const title = sectionItems.find(
			(candidate) =>
				candidate.page === date.page &&
				candidate.x < 0.55 &&
				Math.abs(candidate.y - date.y) <= 2.5 &&
				candidate.text.trim().length >= 3 &&
				!detectSections(candidate.text).includes(section),
		);
		return title ? [title] : [];
	});
	const recordHeaders = [
		...new Map([...projectHeaders, ...datedHeaders].map((item) => [recordHeaderKey(item), item])).values(),
	];
	if (recordHeaders.length < 2) return [];

	const matchedFields = sectionItems.flatMap((item) => {
		const value = normalized(inlineFieldLabel(item.text));
		const definition = sectionItemTableFieldDefinitions.find((candidate) => candidate.pattern.test(value));
		return definition ? [{ item, definition, label: inlineFieldLabel(item.text) }] : [];
	});
	const repeatedDefinitions = sectionItemTableFieldDefinitions.filter(
		(definition) => matchedFields.filter((field) => field.definition.id === definition.id).length >= 2,
	);
	const hasStrongGridEvidence = repeatedDefinitions.length >= 3 && recordHeaders.length >= 2;
	if (!hasStrongGridEvidence) return [];

	const firstHeader = [...recordHeaders].sort((a, b) => a.page - b.page || b.y - a.y)[0];
	const nextRecordHeader = firstHeader
		? recordHeaders
				.filter((candidate) => pdfItemComesAfter(candidate, firstHeader))
				.sort((a, b) => a.page - b.page || b.y - a.y)[0]
		: undefined;
	const firstRecordFields = firstHeader
		? matchedFields
				.filter(
					(field) =>
						pdfItemComesAfter(field.item, firstHeader) &&
						(!nextRecordHeader || pdfItemComesBefore(field.item, nextRecordHeader)),
				)
				.sort((a, b) => a.item.page - b.item.page || b.item.y - a.item.y || a.item.x - b.item.x)
		: [];
	const orderedFields = [
		...new Map([...firstRecordFields, ...matchedFields].map((field) => [field.definition.id, field])).values(),
	];
	const fieldRows = orderedFields.reduce<string[][]>((rows, field) => {
		const source = firstRecordFields.find((candidate) => candidate.definition.id === field.definition.id)?.item;
		const previousDefinitionId = rows.at(-1)?.[0];
		const previous = previousDefinitionId
			? firstRecordFields.find((candidate) => candidate.definition.id === previousDefinitionId)?.item
			: undefined;
		if (source && previous && source.page === previous.page && Math.abs(source.y - previous.y) <= 2.5) {
			rows.at(-1)?.push(field.definition.id);
		} else {
			rows.push([field.definition.id]);
		}
		return rows;
	}, []);

	return [
		{
			mode: "section-items",
			orientation: "key-value",
			headerVisible: false,
			columns: orderedFields.map(({ definition, label }) => ({
				id: definition.id,
				label: label || definition.label,
				binding: section === "experience" && definition.id === "position" ? "item.primary" : definition.binding,
				width: 24,
				align: "left" as const,
			})),
			rows: [],
			fieldRows,
			sourceRowCount: recordHeaders.length,
			evidence: [
				`${recordHeaders.length} repeated ${section} record headers`,
				...orderedFields.map(({ label }) => label),
			],
		},
	];
}

export function detectPdfProjectTables(
	heading: LocatedText,
	items: LocatedText[],
	headings: LocatedText[],
): DetectedTable[] {
	return detectPdfSectionItemTables(heading, "projects", items, headings);
}

function inferSectionPresentation(
	section: TemplateSectionKind,
	bodyLines: string[],
): Pick<DetectedSection, "presentation" | "presentationEvidence"> {
	const normalizedLines = bodyLines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
	if (section === "skills") {
		const groupedFields = normalizedLines.filter((line) =>
			/^(?:programming languages?|frameworks?|databases?|other|tools?|technologies?|languages?)\s*:/iu.test(line),
		);
		if (groupedFields.length >= 2) {
			return {
				presentation: "grouped-fields",
				presentationEvidence: groupedFields.slice(0, 4),
			};
		}
	}
	if (section === "experience" || section === "projects") {
		const numberedItems = normalizedLines.filter((line) => /^\d{1,2}\s*[.)]\s*\S/u.test(line));
		const labeledProjectFields =
			section === "projects"
				? normalizedLines.filter((line) =>
						/^(?:mô tả|description|công nghệ|technolog(?:y|ies)|vai trò|role)\s*:/iu.test(line),
					)
				: [];
		if (
			numberedItems.length >= 2 ||
			(section === "projects" && numberedItems.length >= 1 && labeledProjectFields.length >= 2)
		) {
			return {
				presentation: "numbered-items",
				presentationEvidence: [...numberedItems, ...labeledProjectFields].slice(0, 6),
			};
		}
	}
	return {};
}

function inferPdfSectionPresentation(
	heading: LocatedText,
	section: TemplateSectionKind,
	headings: LocatedText[],
	lines: LocatedText[],
) {
	const nextHeading = headings
		.filter(
			(candidate) =>
				candidate.page === heading.page && candidate.y < heading.y && Math.abs(candidate.x - heading.x) < 0.28,
		)
		.sort((a, b) => b.y - a.y)[0];
	const lowerBoundary = nextHeading?.y ?? Number.NEGATIVE_INFINITY;
	const bodyLines = lines
		.filter(
			(line) =>
				line.page === heading.page &&
				line.y < heading.y - 2 &&
				line.y > lowerBoundary + 2 &&
				Math.abs(line.x - heading.x) < 0.32,
		)
		.sort((a, b) => b.y - a.y)
		.map((line) => line.text);
	return inferSectionPresentation(section, bodyLines);
}

function hasPdfSkillProgressPattern(
	heading: LocatedText,
	headings: LocatedText[],
	lines: LocatedText[],
	bodySize: number,
) {
	const nextHeading = headings
		.filter(
			(candidate) =>
				candidate.page === heading.page && candidate.y < heading.y && Math.abs(candidate.x - heading.x) < 0.2,
		)
		.sort((a, b) => b.y - a.y)[0];
	const lowerBoundary = nextHeading?.y ?? Number.NEGATIVE_INFINITY;
	const rows = lines
		.filter(
			(line) =>
				line.page === heading.page &&
				line.y < heading.y - 2 &&
				line.y > lowerBoundary + 2 &&
				Math.abs(line.x - heading.x) < 0.12,
		)
		.sort((a, b) => b.y - a.y);
	if (rows.length < 3) return false;
	const gaps = rows.slice(1).map((row, index) => Math.abs((rows[index]?.y ?? row.y) - row.y));
	return median(gaps, 0) >= bodySize * 2.2;
}

function createNodes(
	sections: DetectedSection[],
	twoColumn: boolean,
	headerColumn: "main" | "sidebar" = "main",
	headerVariant: "standard" | "compact" | "sidebar" | "split" = "standard",
) {
	const source: DetectedSection[] =
		sections.length > 0
			? sections
			: (["summary", "experience", "education", "skills"] as TemplateSectionKind[]).map((section) => ({
					section,
				}));
	const seen = new Set<string>();
	let previousPage = source[0]?.page ?? 1;
	const sectionNodes = source.flatMap((detected) => {
		const { section, column } = detected;
		const identity = `${section}:${normalizeHeading(detected.title ?? section)}`;
		if (seen.has(identity)) return [];
		seen.add(identity);
		const inferredSidebar = ["skills", "education", "languages", "certifications"].includes(section);
		const page = detected.page ?? previousPage;
		const node: TemplateSectionNode = {
			id: `${section}-${generateId()}`,
			type: "section",
			section,
			...(detected.title ? { title: detected.title.trim() } : {}),
			column: twoColumn ? (column ?? (inferredSidebar ? "sidebar" : "main")) : "main",
			variant: resolveSectionVariant(detected),
			...resolveSkillSlice(detected),
			itemLayout: resolveSectionItemLayout(detected),
			appearance: resolveSectionAppearance(detected),
			visible: true,
			breakBefore: page > previousPage,
			breakAfter: false,
			keepWithNext: true,
			breakInside: detected.tables?.some((table) => table.orientation === "key-value") ? "auto" : "avoid",
			minPresenceAhead: 24,
			repeatOnPage: false,
			overflow: "split",
		};
		node.body = createMappedSectionBody(node, detected);
		previousPage = page;
		return [node];
	});

	return [
		{
			id: `header-${generateId()}`,
			type: "header",
			column: twoColumn ? headerColumn : "main",
			variant: headerVariant,
			showPicture: false,
			showContact: true,
			visible: true,
			breakBefore: false,
			breakAfter: false,
			breakInside: "avoid",
			keepWithNext: true,
			minPresenceAhead: 48,
			repeatOnPage: false,
			overflow: "split",
		},
		...sectionNodes,
	] satisfies TemplateNode[];
}

function buildOutput(input: {
	format: "pdf" | "docx";
	pageCount: number;
	twoColumn: boolean;
	sections: DetectedSection[];
	bodySize?: number;
	primaryColor?: string;
	textColor?: string;
	headingColor?: string;
	sidebarColor?: string;
	sidebarWidth?: number;
	sidebarPosition?: "left" | "right";
	pagePadding?: number;
	headerColumn?: "main" | "sidebar";
	headerVariant?: "standard" | "compact" | "sidebar" | "split";
	pageGrid?: NonNullable<TemplateAst["layout"]["pageGrid"]>;
	visualSupported?: string[];
	confidenceBreakdown: TemplateCompilerReport["confidenceBreakdown"];
	visualFidelity: number;
	warnings: string[];
	unsupported: string[];
}): CompileOutput {
	const detectedSections = [...new Set(input.sections.map(({ section }) => section))];
	const confidence = roundScore(
		input.confidenceBreakdown.semantic * 0.45 +
			input.confidenceBreakdown.layout * 0.3 +
			input.confidenceBreakdown.typography * 0.15 +
			input.confidenceBreakdown.extraction * 0.1,
	);
	const ast = templateAstSchema.parse({
		...defaultTemplateAst,
		layout: {
			...defaultTemplateAst.layout,
			preset: input.pageGrid ? "grid" : input.twoColumn ? "two-column" : "one-column",
			sidebarWidth: clamp(Math.round(input.sidebarWidth ?? defaultTemplateAst.layout.sidebarWidth), 20, 45),
			sidebarPosition: input.sidebarPosition ?? defaultTemplateAst.layout.sidebarPosition,
			pagePadding: clamp(Math.round(input.pagePadding ?? defaultTemplateAst.layout.pagePadding), 16, 64),
			...(input.pageGrid ? { pageGrid: input.pageGrid } : {}),
		},
		tokens: {
			...defaultTemplateAst.tokens,
			headingFont: "Inter",
			bodyFont: "Inter",
			bodySize: clamp(Math.round(input.bodySize ?? 10), 8, 14),
			primaryColor: input.primaryColor ?? defaultTemplateAst.tokens.primaryColor,
			textColor: input.textColor ?? defaultTemplateAst.tokens.textColor,
			...(input.headingColor ? { headingColor: input.headingColor } : {}),
			sidebarColor: input.sidebarColor ?? defaultTemplateAst.tokens.sidebarColor,
		},
		nodes: createNodes(
			input.sections,
			input.twoColumn || Boolean(input.pageGrid),
			input.headerColumn,
			input.headerVariant,
		).map((node) => (input.pageGrid ? { ...node, region: node.column === "sidebar" ? "sidebar" : "main" } : node)),
		page: undefined,
	});

	return {
		ast,
		report: {
			sourceFormat: input.format,
			confidence,
			confidenceBreakdown: input.confidenceBreakdown,
			visualFidelity: input.visualFidelity,
			pageCount: input.pageCount,
			detectedLayout: ast.layout.preset,
			detectedSections,
			warnings: input.warnings,
			mappingSummary: {
				supported: [
					...detectedSections.map((section) => `Semantic section: ${section}`),
					...input.sections.flatMap((section) => [
						...(section.title ? [`Source heading: ${section.title.trim()} → ${section.section}`] : []),
						...(section.itemColumns && section.itemColumns > 1 && !section.presentation
							? [`Section grid: ${section.section} → ${section.itemColumns} columns`]
							: []),
						...(section.presentation
							? [
									`Parsed presentation: ${section.section} → ${section.presentation} (${section.presentationEvidence?.length ?? 0} evidence lines)`,
								]
							: []),
						...(section.tables ?? []).map((table) =>
							table.orientation === "key-value"
								? `Parsed ${table.mode === "static" ? "static reference" : "dynamic"} key-value table: ${table.title ?? section.title ?? section.section} → 2 layout columns, ${table.columns.length} field rows, ${table.sourceRowCount} source records`
								: `Parsed ${table.mode === "static" ? "static reference" : "dynamic"} table: ${table.title ?? section.title ?? section.section} → ${table.columns.length} layout columns, ${table.sourceRowCount} source rows`,
						),
					]),
					...(input.visualSupported ?? []),
				],
				approximated: ["Complex visual decorations", "Exact font family and spacing"],
				unsupported: input.unsupported,
			},
			manualReviewRequired: true,
			generatedAt: new Date().toISOString(),
		},
	};
}

type PdfTextItem = { str: string; transform: number[]; width?: number; hasEOL?: boolean };

function isPdfTextItem(value: unknown): value is PdfTextItem {
	return (
		typeof value === "object" &&
		value !== null &&
		"str" in value &&
		typeof value.str === "string" &&
		"transform" in value &&
		Array.isArray(value.transform)
	);
}

type PdfOperatorList = { fnArray: number[]; argsArray: unknown[] };

type PdfOps = {
	setFillRGBColor: number;
	setStrokeRGBColor: number;
	constructPath: number;
};

function joinPdfLineSegment(segment: PdfTextItem[]) {
	let text = "";
	let previous: PdfTextItem | undefined;
	for (const item of segment) {
		const value = item.str.trim();
		if (!value) continue;
		if (!previous) {
			text = value;
			previous = item;
			continue;
		}
		const previousEnd = (previous.transform[4] ?? 0) + (previous.width ?? 0);
		const gap = (item.transform[4] ?? 0) - previousEnd;
		const fontSize = Math.max(
			Math.abs(previous.transform[3] ?? previous.transform[0] ?? 10),
			Math.abs(item.transform[3] ?? item.transform[0] ?? 10),
		);
		const sourceHasSpace = /\s$/u.test(previous.str) || /^\s/u.test(item.str);
		text += sourceHasSpace || gap > Math.max(0.8, fontSize * 0.12) ? ` ${value}` : value;
		previous = item;
	}
	return text.replace(/\s+/g, " ").trim();
}

function readBounds(value: unknown) {
	if (typeof value !== "object" || value === null) return undefined;
	const bounds = value as Record<number, unknown>;
	const numbers = [bounds[0], bounds[1], bounds[2], bounds[3]];
	return numbers.every((entry): entry is number => typeof entry === "number") ? numbers : undefined;
}

function analyzePdfVisuals(operatorList: PdfOperatorList, ops: PdfOps, pageWidth: number, pageHeight: number) {
	const colors = new Map<string, number>();
	let fillColor: string | undefined;
	let sidebar: { color: string; width: number; position: "left" | "right"; area: number } | undefined;
	let horizontalBars = 0;

	for (let index = 0; index < operatorList.fnArray.length; index++) {
		const operation = operatorList.fnArray[index];
		const args = operatorList.argsArray[index];
		if (operation === ops.setFillRGBColor || operation === ops.setStrokeRGBColor) {
			const color = normalizeHexColor(Array.isArray(args) && typeof args[0] === "string" ? args[0] : undefined);
			if (!color) continue;
			colors.set(color, (colors.get(color) ?? 0) + (operation === ops.setFillRGBColor ? 2 : 1));
			if (operation === ops.setFillRGBColor) fillColor = color;
			continue;
		}

		if (operation !== ops.constructPath || !fillColor || !Array.isArray(args) || args[0] !== 23) continue;
		const bounds = readBounds(args[2]);
		if (!bounds) continue;
		const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = bounds;
		const widthRatio = Math.abs(x2 - x1) / pageWidth;
		const heightRatio = Math.abs(y2 - y1) / pageHeight;
		const area = widthRatio * heightRatio;
		if (widthRatio >= 0.08 && widthRatio <= 0.32 && heightRatio >= 0.002 && heightRatio <= 0.035) {
			horizontalBars++;
		}
		if (area < 0.18 || heightRatio < 0.55 || colorMetrics(fillColor).lightness > 0.94) continue;

		const candidate = {
			color: fillColor,
			width: clamp(widthRatio * 100, 20, 45),
			position: (x1 + x2) / 2 / pageWidth < 0.5 ? ("left" as const) : ("right" as const),
			area,
		};
		if (!sidebar || candidate.area > sidebar.area) sidebar = candidate;
	}

	return {
		primaryColor: pickAccentColor(colors),
		textColor: pickTextColor(colors),
		sidebar,
		horizontalBars,
	};
}

async function compilePdf(data: Uint8Array): Promise<CompileOutput> {
	const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
	const loadingTask = getDocument({ data: new Uint8Array(data), useSystemFonts: true });
	const document = await loadingTask.promise;

	try {
		const located: LocatedText[] = [];
		const locatedLines: LocatedText[] = [];
		const firstPageLines: { start: number; end: number; y: number; text: string }[] = [];
		let firstPageWidth = 1;
		let visualProfile: ReturnType<typeof analyzePdfVisuals> | undefined;

		for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
			const page = await document.getPage(pageNumber);
			const viewport = page.getViewport({ scale: 1 });
			if (pageNumber === 1) {
				firstPageWidth = viewport.width;
				visualProfile = analyzePdfVisuals(
					(await page.getOperatorList()) as PdfOperatorList,
					OPS as PdfOps,
					viewport.width,
					viewport.height,
				);
			}
			const content = await page.getTextContent();
			const pageItems: PdfTextItem[] = content.items.flatMap((item) =>
				isPdfTextItem(item) && item.str.trim() ? [item] : [],
			);
			const lines = new Map<number, PdfTextItem[]>();

			for (const item of pageItems) {
				const x = item.transform[4] ?? 0;
				const y = item.transform[5] ?? 0;
				const fontSize = Math.abs(item.transform[3] ?? item.transform[0] ?? 10);
				located.push({ text: item.str.trim(), x: x / viewport.width, y, fontSize, page: pageNumber });
				const lineKey = Math.round(y / 3) * 3;
				lines.set(lineKey, [...(lines.get(lineKey) ?? []), item]);
			}

			for (const [lineY, items] of lines) {
				const ordered = [...items].sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0));
				const segments: PdfTextItem[][] = [];
				for (const item of ordered) {
					const current = segments.at(-1);
					const previous = current?.at(-1);
					const previousEnd = previous ? (previous.transform[4] ?? 0) + (previous.width ?? 0) : undefined;
					const itemStart = item.transform[4] ?? 0;
					if (previousEnd !== undefined && itemStart - previousEnd <= viewport.width * 0.06) current?.push(item);
					else segments.push([item]);
				}
				for (const segment of segments) {
					const start = Math.min(...segment.map((item) => item.transform[4] ?? 0));
					const end = Math.max(...segment.map((item) => (item.transform[4] ?? 0) + (item.width ?? 0)));
					const lineText = joinPdfLineSegment(segment);
					locatedLines.push({
						text: lineText,
						x: start / viewport.width,
						y: lineY,
						fontSize: median(
							segment.map((item) => Math.abs(item.transform[3] ?? item.transform[0] ?? 10)),
							10,
						),
						page: pageNumber,
					});
					if (pageNumber === 1) {
						firstPageLines.push({
							start: start / viewport.width,
							end: end / viewport.width,
							y: lineY / viewport.height,
							text: lineText,
						});
					}
				}
			}
		}

		const leftLines = firstPageLines.filter(({ start }) => start < 0.38);
		const rightLines = firstPageLines.filter(({ start }) => start > 0.33 && start < 0.9);
		const wideLines = firstPageLines.filter(({ start, end }) => start < 0.22 && end > 0.55);
		const leftRatio = leftLines.length / Math.max(1, firstPageLines.length);
		const rightRatio = rightLines.length / Math.max(1, firstPageLines.length);
		const wideRatio = wideLines.length / Math.max(1, firstPageLines.length);
		const rightVerticalBins = new Set(rightLines.map(({ y }) => Math.min(4, Math.floor(clamp(y, 0, 1) * 5)))).size;
		const headerBandLines = firstPageLines.filter(({ y }) => y >= 0.78);
		const splitHeader =
			headerBandLines.some(({ start, end }) => start < 0.25 && end > 0.35) &&
			headerBandLines.filter(({ start }) => start > 0.58).length >= 2;
		const geometrySuggestsTwoColumns =
			firstPageLines.length >= 8 &&
			leftRatio > 0.22 &&
			rightRatio > 0.16 &&
			wideRatio < 0.25 &&
			(rightRatio > 0.45 || rightVerticalBins >= 4);
		const twoColumn = !!visualProfile?.sidebar || geometrySuggestsTwoColumns;
		const sidebarWidth = visualProfile?.sidebar?.width ?? defaultTemplateAst.layout.sidebarWidth;
		const sidebarPosition = visualProfile?.sidebar?.position ?? defaultTemplateAst.layout.sidebarPosition;
		const isSidebarPosition = (x: number) =>
			twoColumn && (sidebarPosition === "left" ? x < sidebarWidth / 100 : x > 1 - sidebarWidth / 100);
		const bodySize = median(
			located.filter((item) => item.fontSize > 5 && item.fontSize < 24).map((item) => item.fontSize),
			10,
		);
		const headingItems = locatedLines.filter(
			(item) => detectSections(item.text).length > 0 && isLikelySectionHeading(item.text, item.fontSize, bodySize),
		);
		const sections: DetectedSection[] = headingItems
			.flatMap((item) => detectSections(item.text).map((section) => ({ ...item, section })))
			.sort((a, b) => a.page - b.page || b.y - a.y)
			.map((item) => {
				const itemColumns = inferPdfSectionItemColumns(item, item.section, headingItems, locatedLines);
				const tables =
					item.section === "skills" && normalizeHeading(item.text).includes("expertise")
						? detectPdfSkillsTables(item, located)
						: item.section === "projects" || item.section === "experience"
							? detectPdfSectionItemTables(item, item.section, located, headingItems)
							: [];
				const parsedPresentation = inferPdfSectionPresentation(item, item.section, headingItems, locatedLines);
				const hasSidebarProgressBars =
					item.section === "skills" &&
					isSidebarPosition(item.x) &&
					((visualProfile?.horizontalBars ?? 0) >= 3 ||
						hasPdfSkillProgressPattern(item, headingItems, locatedLines, bodySize)) &&
					!parsedPresentation.presentation;
				return {
					section: item.section,
					column: isSidebarPosition(item.x) ? ("sidebar" as const) : ("main" as const),
					title: item.text,
					page: item.page,
					...(itemColumns ? { itemColumns } : {}),
					...(tables.length > 0
						? {
								presentation: "tables" as const,
								presentationEvidence: tables.flatMap((table) => table.evidence),
								tables,
							}
						: hasSidebarProgressBars
							? {
									presentation: "proficiency-bars" as const,
									presentationEvidence: [`${visualProfile?.horizontalBars ?? 0} horizontal proficiency bars`],
								}
							: parsedPresentation),
				};
			});
		const uniqueSectionCount = new Set(sections.map(({ section }) => section)).size;
		const headingSize = median(
			headingItems.filter((item) => item.fontSize > 5 && item.fontSize < 40).map((item) => item.fontSize),
			bodySize,
		);
		const layoutConfidence = twoColumn
			? clamp(0.55 + leftRatio * 0.5 + rightRatio * 0.5 + (rightVerticalBins / 5) * 0.12 - wideRatio * 0.3, 0.55, 0.95)
			: clamp(0.75 + wideRatio * 0.45 + (rightVerticalBins <= 3 ? 0.08 : 0) - rightRatio * 0.5, 0.58, 0.95);
		const typographyConfidence =
			uniqueSectionCount === 0
				? 0.25
				: clamp(
						0.55 + (headingSize / Math.max(bodySize, 1) - 1) * 0.65 + Math.min(0.18, uniqueSectionCount * 0.025),
						0.45,
						0.95,
					);
		const extractionConfidence = clamp(
			0.5 +
				Math.min(0.3, (located.length / 200) * 0.3) +
				Math.min(0.1, document.numPages * 0.025) +
				(firstPageWidth > 1 ? 0.05 : 0),
			0.45,
			0.98,
		);
		const pagePadding = clamp(
			Math.round(Math.min(...firstPageLines.map(({ start }) => start), 0.1) * firstPageWidth),
			16,
			64,
		);
		const largestFirstPageText = located.filter((item) => item.page === 1).sort((a, b) => b.fontSize - a.fontSize)[0];
		const headerColumn = largestFirstPageText && isSidebarPosition(largestFirstPageText.x) ? "sidebar" : "main";
		const resolvedPrimaryColor = visualProfile?.primaryColor ?? visualProfile?.textColor;
		const hasPrimaryColor = !!resolvedPrimaryColor;
		const hasSidebarVisual = !twoColumn || !!visualProfile?.sidebar;
		const visualFidelity = clamp(
			0.3 +
				layoutConfidence * 0.16 +
				typographyConfidence * 0.12 +
				(hasPrimaryColor ? 0.1 : 0) +
				(hasSidebarVisual ? 0.08 : 0.03) +
				(splitHeader ? 0.04 : 0) +
				(sections.some((section) => normalizeHeading(section.title ?? "").includes("expertise")) ? 0.04 : 0) +
				0.05,
			0.35,
			0.86,
		);
		const warnings = [
			"PDF visual elements are approximated; review spacing, colors and section placement before publishing.",
		];
		if (sections.length === 0)
			warnings.push("No section headings were recognized; a safe default section set was used.");
		if (firstPageWidth <= 1) warnings.push("Page geometry could not be measured reliably.");

		return buildOutput({
			format: "pdf",
			pageCount: document.numPages,
			twoColumn,
			sections,
			bodySize,
			...(resolvedPrimaryColor ? { primaryColor: resolvedPrimaryColor } : {}),
			...(visualProfile?.textColor ? { textColor: visualProfile.textColor } : {}),
			...(visualProfile?.textColor ? { headingColor: visualProfile.textColor } : {}),
			...(visualProfile?.sidebar?.color ? { sidebarColor: visualProfile.sidebar.color } : {}),
			sidebarWidth,
			sidebarPosition,
			pagePadding,
			headerColumn,
			headerVariant: splitHeader ? "split" : "standard",
			visualSupported: [
				"Page margins and typography scale",
				...(hasPrimaryColor ? ["Dominant heading and text colors"] : []),
				...(visualProfile?.sidebar ? ["Sidebar color, width and position"] : []),
				...(splitHeader ? ["Split profile header"] : []),
				...(sections.some((section) => section.title && normalizeHeading(section.title).includes("expertise"))
					? ["Skills table structure"]
					: []),
			],
			confidenceBreakdown: {
				semantic: semanticConfidence(uniqueSectionCount),
				layout: roundScore(layoutConfidence),
				typography: roundScore(typographyConfidence),
				extraction: roundScore(extractionConfidence),
			},
			visualFidelity: roundScore(visualFidelity),
			warnings,
			unsupported: ["Logos and embedded images require manual recreation."],
		});
	} finally {
		await loadingTask.destroy();
	}
}

const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;

function assertRange(buffer: Buffer, offset: number, length: number) {
	if (offset < 0 || length < 0 || offset + length > buffer.length) throw new Error("Invalid DOCX archive.");
}

function readZipEntry(buffer: Buffer, entryName: string): Buffer {
	const minOffset = Math.max(0, buffer.length - 0xffff - 22);
	let eocdOffset = -1;
	for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
		if (buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
			eocdOffset = offset;
			break;
		}
	}
	if (eocdOffset < 0) throw new Error("Invalid DOCX archive.");
	assertRange(buffer, eocdOffset, 22);
	const directorySize = buffer.readUInt32LE(eocdOffset + 12);
	let offset = buffer.readUInt32LE(eocdOffset + 16);
	const end = offset + directorySize;

	while (offset < end) {
		assertRange(buffer, offset, 46);
		if (buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) throw new Error("Invalid DOCX archive.");
		const method = buffer.readUInt16LE(offset + 10);
		const compressedSize = buffer.readUInt32LE(offset + 20);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const localOffset = buffer.readUInt32LE(offset + 42);
		const nameOffset = offset + 46;
		assertRange(buffer, nameOffset, nameLength);
		const name = buffer.toString("utf8", nameOffset, nameOffset + nameLength);

		if (name === entryName) {
			assertRange(buffer, localOffset, 30);
			if (buffer.readUInt32LE(localOffset) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE)
				throw new Error("Invalid DOCX archive.");
			const localNameLength = buffer.readUInt16LE(localOffset + 26);
			const localExtraLength = buffer.readUInt16LE(localOffset + 28);
			const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
			assertRange(buffer, dataOffset, compressedSize);
			const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
			if (method === 0) return compressed;
			if (method === 8) return inflateRawSync(compressed);
			throw new Error("Unsupported DOCX compression.");
		}
		offset = nameOffset + nameLength + extraLength + commentLength;
	}
	throw new Error(`DOCX entry not found: ${entryName}`);
}

function decodeEntities(value: string) {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

type DocxLayout = {
	twoColumn: boolean;
	confidence: number;
	sidebarWidth?: number;
	sidebarPosition?: "left" | "right";
	pageGrid?: NonNullable<TemplateAst["layout"]["pageGrid"]>;
};

function detectDocxLayout(documentXml: string): DocxLayout {
	const explicitColumns = [...documentXml.matchAll(/<w:cols\b[^>]*w:num="(\d+)"/g)].map((match) => Number(match[1]));
	const explicitGridColumns = Math.max(0, ...explicitColumns);
	const tableGrids = [...documentXml.matchAll(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/g)].map((table) =>
		[...(table[1] ?? "").matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)].map((column) => Number(column[1])),
	);
	const twoColumnTables = tableGrids.filter((columns) => columns.length === 2 && columns.every((width) => width > 0));
	const balancedTables = twoColumnTables.filter((columns) => {
		const [first = 0, second = 0] = columns;
		return first + second >= 1_000 && Math.min(first, second) / Math.max(first, second) >= 0.55;
	});
	const hasSemanticPageTable = [...documentXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)].some((match) => {
		const table = match[0];
		const widths = [...table.matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)].map((column) => Number(column[1]));
		const [first = 0, second = 0] = widths;
		if (widths.length !== 2 || first + second < 1_000 || Math.min(first, second) / Math.max(first, second) < 0.55) {
			return false;
		}
		const semanticCells = [...table.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].slice(0, 2).filter((cell) => {
			return [...cell[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].some((paragraph) => {
				const text = decodeEntities(
					[...(paragraph[0] ?? "").matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
						.map((entry) => entry[1] ?? "")
						.join(""),
				);
				return detectSections(text).length > 0;
			});
		});
		return semanticCells.length === 2;
	});
	const inferredSidebar = balancedTables[0]
		? (() => {
				const [first = 1, second = 1] = balancedTables[0];
				return first <= second
					? { sidebarWidth: (first / (first + second)) * 100, sidebarPosition: "left" as const }
					: { sidebarWidth: (second / (first + second)) * 100, sidebarPosition: "right" as const };
			})()
		: undefined;

	if (explicitGridColumns >= 3) {
		const ids = ["sidebar", "main", "auxiliary", "rail"].slice(0, Math.min(4, explicitGridColumns));
		const width = Number((100 / ids.length).toFixed(2));
		return {
			twoColumn: false,
			confidence: 0.96,
			pageGrid: {
				gap: 18,
				regions: ids.map((id, index) => ({
					id,
					width: index === ids.length - 1 ? Number((100 - width * (ids.length - 1)).toFixed(2)) : width,
					padding: 0,
				})),
			},
		};
	}
	if (explicitGridColumns === 2) return { twoColumn: true, confidence: 0.96 };
	if (explicitColumns.includes(1) && !hasSemanticPageTable) return { twoColumn: false, confidence: 0.88 };
	if (balancedTables.length === 1 && tableGrids.length === 1) {
		return { twoColumn: true, confidence: 0.82, ...inferredSidebar };
	}
	if (balancedTables.length >= 2 && balancedTables.length / Math.max(1, twoColumnTables.length) >= 0.6) {
		return { twoColumn: true, confidence: 0.78, ...inferredSidebar };
	}

	return {
		twoColumn: false,
		confidence: tableGrids.length > 0 ? 0.72 : 0.8,
	};
}

function compileDocx(data: Uint8Array): CompileOutput {
	const archive = Buffer.from(data);
	const documentXml = readZipEntry(archive, "word/document.xml").toString("utf8");
	let currentPage = 1;
	const paragraphs = [...documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((match, index) => {
		const paragraphXml = match[0];
		if (/<w:lastRenderedPageBreak\b/.test(paragraphXml)) currentPage += 1;
		const paragraph = {
			text: decodeEntities(
				[...paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((text) => text[1] ?? "").join(""),
			),
			page: currentPage,
			index,
		};
		if (/<w:br\b[^>]*w:type="page"/.test(paragraphXml)) currentPage += 1;
		return paragraph;
	});
	const layout = detectDocxLayout(documentXml);
	const tableSectionColumns = new Map<TemplateSectionKind, number>();
	const tables = [...documentXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)].map((match) => match[0]);
	for (const [tableIndex, table] of tables.entries()) {
		if (layout.twoColumn && tableIndex === 0) continue;
		const gridColumns = [...table.matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)].length;
		if (gridColumns < 2 || gridColumns > 6) continue;
		for (const paragraph of table.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) {
			const text = decodeEntities(
				[...(paragraph[0] ?? "").matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
					.map((entry) => entry[1] ?? "")
					.join(""),
			);
			for (const section of detectSections(text)) {
				tableSectionColumns.set(section, Math.max(tableSectionColumns.get(section) ?? 1, gridColumns));
			}
		}
	}
	const cellSectionColumns = new Map<TemplateSectionKind, "main" | "sidebar">();
	if (layout.twoColumn) {
		const firstTable = documentXml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/)?.[0];
		const cells = firstTable ? [...firstTable.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((match) => match[0]) : [];
		for (const [cellIndex, cell] of cells.slice(0, 2).entries()) {
			const column =
				(layout.sidebarPosition ?? "left") === "left"
					? cellIndex === 0
						? "sidebar"
						: "main"
					: cellIndex === 1
						? "sidebar"
						: "main";
			const cellText = decodeEntities(
				[...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((text) => text[1] ?? "").join(" "),
			);
			for (const section of detectSections(cellText)) cellSectionColumns.set(section, column);
			for (const paragraph of cell.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)) {
				const text = decodeEntities(
					[...(paragraph[0] ?? "").matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
						.map((entry) => entry[1] ?? "")
						.join(""),
				);
				for (const section of detectSections(text)) cellSectionColumns.set(section, column);
			}
		}
	}
	const sections = paragraphs.flatMap(({ text, page, index }) =>
		(isLikelySectionHeading(text) ? detectSections(text) : []).map((section) => {
			const column = cellSectionColumns.get(section);
			const itemColumns = tableSectionColumns.get(section);
			const nextHeadingIndex = paragraphs.findIndex(
				(paragraph) =>
					paragraph.index > index &&
					isLikelySectionHeading(paragraph.text) &&
					detectSections(paragraph.text).length > 0,
			);
			const bodyLines = paragraphs
				.slice(index + 1, nextHeadingIndex >= 0 ? nextHeadingIndex : undefined)
				.map((paragraph) => paragraph.text);
			return {
				section,
				...(column ? { column } : {}),
				title: text,
				page,
				...(itemColumns ? { itemColumns } : {}),
				...inferSectionPresentation(section, bodyLines),
			};
		}),
	);
	const colorValues = [...documentXml.matchAll(/<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"/g)].flatMap((match) =>
		match[1] ? [`#${match[1].toLowerCase()}`] : [],
	);
	const colorCounts = new Map<string, number>();
	for (const color of colorValues) colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
	const primaryColor = pickAccentColor(colorCounts);
	const textColor = pickTextColor(colorCounts);
	const resolvedPrimaryColor = primaryColor ?? textColor;
	const shadingCounts = new Map<string, number>();
	for (const match of documentXml.matchAll(/<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{6})"/g)) {
		const color = match[1] ? `#${match[1].toLowerCase()}` : undefined;
		if (color) shadingCounts.set(color, (shadingCounts.get(color) ?? 0) + 1);
	}
	const sidebarColor = layout.twoColumn
		? [...shadingCounts.entries()]
				.filter(([color]) => colorMetrics(color).lightness < 0.95)
				.sort((a, b) => b[1] - a[1])[0]?.[0]
		: undefined;
	const pageMargin = Number(documentXml.match(/<w:pgMar\b[^>]*w:left="(\d+)"/)?.[1] ?? 640) / 20;
	const sizes = [...documentXml.matchAll(/<w:sz\b[^>]*w:val="(\d+)"/g)]
		.map((match) => Number(match[1]) / 2)
		.filter((size) => size >= 6 && size <= 30);
	const uniqueSectionCount = new Set(sections.map(({ section }) => section)).size;
	const uniqueSizes = new Set(sizes.map((size) => Math.round(size * 2) / 2)).size;
	const typographyConfidence =
		sizes.length === 0
			? 0.35
			: clamp(0.5 + Math.min(0.28, uniqueSizes * 0.07) + (colorValues.length > 0 ? 0.07 : 0), 0.5, 0.9);
	const extractionConfidence = clamp(
		0.52 +
			Math.min(0.36, (paragraphs.filter(({ text }) => Boolean(text)).length / 60) * 0.36) +
			(sizes.length > 0 ? 0.06 : 0),
		0.5,
		0.94,
	);
	const hasPrimaryColor = !!resolvedPrimaryColor;
	const hasSidebarVisual = !layout.twoColumn || !!sidebarColor;
	const visualFidelity = clamp(
		0.3 +
			layout.confidence * 0.16 +
			typographyConfidence * 0.12 +
			(hasPrimaryColor ? 0.1 : 0) +
			(hasSidebarVisual ? 0.08 : 0.03) +
			0.05,
		0.35,
		0.78,
	);
	const warnings = [
		"DOCX floating shapes, text boxes and exact pagination are approximated; review the generated draft.",
	];
	if (sections.length === 0) warnings.push("No section headings were recognized; a safe default section set was used.");

	return buildOutput({
		format: "docx",
		pageCount: Math.max(currentPage, ...sections.map(({ page }) => page ?? 1)),
		twoColumn: layout.twoColumn,
		...(layout.pageGrid ? { pageGrid: layout.pageGrid } : {}),
		sections,
		bodySize: median(sizes, 10),
		...(resolvedPrimaryColor ? { primaryColor: resolvedPrimaryColor } : {}),
		...(textColor ? { textColor } : {}),
		headingColor: textColor ?? "#000000",
		...(sidebarColor ? { sidebarColor } : {}),
		...(layout.sidebarWidth ? { sidebarWidth: layout.sidebarWidth } : {}),
		...(layout.sidebarPosition ? { sidebarPosition: layout.sidebarPosition } : {}),
		pagePadding: clamp(pageMargin, 16, 64),
		headerColumn: layout.twoColumn && sidebarColor ? "sidebar" : "main",
		headerVariant: !layout.twoColumn && /year of birth|gender|location/iu.test(documentXml) ? "split" : "standard",
		visualSupported: [
			"Page margins and typography scale",
			...(hasPrimaryColor ? ["Dominant heading and text colors"] : []),
			...(sidebarColor ? ["Sidebar color, width and position"] : []),
		],
		confidenceBreakdown: {
			semantic: semanticConfidence(uniqueSectionCount),
			layout: roundScore(layout.confidence),
			typography: roundScore(typographyConfidence),
			extraction: roundScore(extractionConfidence),
		},
		visualFidelity: roundScore(visualFidelity),
		warnings,
		unsupported: ["Floating shapes, headers/footers and embedded images require manual recreation."],
	});
}

export async function compileCustomTemplate(input: CompileInput): Promise<CompileOutput> {
	const output = input.mediaType === "application/pdf" ? await compilePdf(input.data) : compileDocx(input.data);
	return input.visionBlueprint ? applyVisionBlueprint(output, input.visionBlueprint) : output;
}
