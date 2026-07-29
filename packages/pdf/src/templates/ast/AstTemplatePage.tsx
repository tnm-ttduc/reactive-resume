import type { Style } from "@react-pdf/types";
import type {
	TemplateAst,
	TemplateComposerContentNode,
	TemplateComposerPageNode,
	TemplateFlowNode,
	TemplateHeaderNode,
	TemplateSectionNode,
	TemplateShapeNode,
} from "@reactive-resume/schema/template-ast";
import type { ReactNode } from "react";
import type { TemplatePageProps } from "../../document";
import type { TemplateStyleSlots } from "../shared/types";
import { useMemo } from "react";
import { defaultTemplateAst } from "@reactive-resume/schema/template-ast";
import { Image, Page, StyleSheet, View } from "#react-pdf-renderer";
import { useRender } from "../../context";
import { TemplateProvider } from "../shared/context";
import { getTemplatePageMinHeightStyle, getTemplatePageSize } from "../shared/page-size";
import { Heading, Text } from "../shared/primitives";
import { Section } from "../shared/sections";
import { composeStyles } from "../shared/styles";

type AstStyles = TemplateStyleSlots & {
	page: Style;
	section: Style;
	sectionHeading: Style;
	sectionItems: Style;
	item: Style;
	sectionItemHeader: Style;
	header: Style;
	headerRow: Style;
	headerName: Style;
	contact: Style;
	picture: Style;
	splitRow: Style;
	alignEnd: Style;
	inlineItemHeader: Style;
	contentRow: Style;
	mainColumn: Style;
	sidebarColumn: Style;
	skillTags: Style;
	skillTag: Style;
	skillBulletRow: Style;
	skillBullet: Style;
	skillTable: Style;
	skillTableRow: Style;
	skillTableHeader: Style;
	skillTableName: Style;
	skillTableMeta: Style;
};

type AstSectionProps = {
	node: TemplateSectionNode;
	ast: TemplateAst;
	styles: AstStyles;
};

type ComposerItem = {
	id: string;
	primary: string;
	secondary: string;
	meta: string;
	description: string;
	keywords: string;
	value: string;
	level: string;
	experience: string;
	lastUsed: string;
};

function textValue(record: Record<string, unknown>, keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value;
	}
	return "";
}

function normalizeComposerItem(value: unknown, section: TemplateSectionNode["section"], index: number): ComposerItem {
	const item = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
	const keywords = Array.isArray(item.keywords)
		? item.keywords.filter((entry): entry is string => typeof entry === "string").join(", ")
		: textValue(item, ["keywords", "technologies", "technology", "techStack"]);
	const mapping: Record<TemplateSectionNode["section"], { primary: string[]; secondary: string[]; meta: string[] }> = {
		summary: { primary: [], secondary: [], meta: [] },
		profiles: { primary: ["network"], secondary: ["username"], meta: ["url"] },
		experience: { primary: ["position"], secondary: ["company"], meta: ["period", "location"] },
		education: { primary: ["degree"], secondary: ["school"], meta: ["period", "area"] },
		projects: { primary: ["name"], secondary: ["role"], meta: ["period", "date"] },
		skills: { primary: ["name"], secondary: ["proficiency"], meta: [] },
		languages: { primary: ["language"], secondary: ["fluency"], meta: [] },
		certifications: { primary: ["title"], secondary: ["issuer"], meta: ["date"] },
		interests: { primary: ["name"], secondary: [], meta: [] },
		awards: { primary: ["title"], secondary: ["awarder"], meta: ["date"] },
		publications: { primary: ["title"], secondary: ["publisher"], meta: ["date"] },
		volunteer: { primary: ["position", "organization"], secondary: ["organization"], meta: ["period"] },
		references: { primary: ["name"], secondary: ["position"], meta: ["email", "phone"] },
	};
	const fields = mapping[section];
	const primary = textValue(item, fields.primary);
	const secondary = textValue(item, fields.secondary);
	const meta = fields.meta
		.map((key) => textValue(item, [key]))
		.filter(Boolean)
		.join(" · ");
	const description = textValue(item, ["description", "summary"]);
	return {
		id: textValue(item, ["id"]) || `${section}-${index}`,
		primary,
		secondary,
		meta,
		description,
		keywords,
		value: textValue(item, ["value", "responsibility", "responsibilities"]) || description,
		level: typeof item.level === "number" && item.level > 0 ? String(item.level) : textValue(item, ["level"]),
		experience: textValue(item, ["experience", "teamSize", "team"]),
		lastUsed: textValue(item, ["lastUsed"]),
	};
}

function composerItemBindingValue(item: ComposerItem, binding: string | undefined) {
	if (!binding?.startsWith("item.")) return "";
	return String(item[binding.slice(5) as keyof ComposerItem] ?? "");
}

function composerEntryHasKeyValueTable(entry: TemplateComposerContentNode): boolean {
	if (entry.type === "block") return entry.component === "table" && entry.table?.orientation === "key-value";
	if (entry.type === "layout" && entry.component === "table") return true;
	return entry.children.some(composerEntryHasKeyValueTable);
}

function stripHtml(value: string) {
	return value
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function listTextItems(value: string) {
	const htmlItems = [...value.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/giu)]
		.map((match) => stripHtml(match[1] ?? ""))
		.filter(Boolean);
	if (htmlItems.length > 0) return htmlItems;
	const lines = value
		.split(/\r?\n|(?:^|\s)[•▪◦➢✓]\s*/u)
		.map(stripHtml)
		.filter(Boolean);
	return lines.length > 0 ? lines : [stripHtml(value)].filter(Boolean);
}

type ComposerContentProps = {
	entry: TemplateComposerContentNode;
	isRoot?: boolean;
	sectionTitle: string;
	sectionContent: string;
	items: ComposerItem[];
	item?: ComposerItem;
	node: TemplateSectionNode;
	ast: TemplateAst;
	styles: AstStyles;
};

function composerContentLayoutStyle(
	entry: Extract<TemplateComposerContentNode, { type: "layout" }>,
	ast: TemplateAst,
	isRoot: boolean,
): Style {
	const horizontal =
		entry.component === "row" ||
		entry.component === "columns" ||
		entry.component === "table-row" ||
		entry.props.direction === "horizontal";
	return {
		flexDirection: horizontal ? "row" : "column",
		...(entry.component === "grid" ? { flexDirection: "row", flexWrap: "wrap" as const } : {}),
		...(isRoot ? { gap: ast.tokens.itemGap } : entry.props.gap !== undefined ? { gap: entry.props.gap } : {}),
		...(isRoot
			? { rowGap: ast.tokens.itemGap }
			: entry.props.rowGap !== undefined
				? { rowGap: entry.props.rowGap }
				: {}),
		...(entry.props.columnGap !== undefined ? { columnGap: entry.props.columnGap } : {}),
		...(entry.props.padding !== undefined ? { padding: entry.props.padding } : {}),
		...(entry.props.width !== undefined ? { width: `${entry.props.width}%` } : {}),
		...(entry.props.align
			? {
					alignItems:
						entry.props.align === "start"
							? ("flex-start" as const)
							: entry.props.align === "end"
								? ("flex-end" as const)
								: entry.props.align,
				}
			: {}),
		...(entry.props.justify
			? {
					justifyContent:
						entry.props.justify === "between"
							? ("space-between" as const)
							: entry.props.justify === "start"
								? ("flex-start" as const)
								: entry.props.justify === "end"
									? ("flex-end" as const)
									: entry.props.justify,
				}
			: {}),
		...(entry.props.border === "solid"
			? { borderWidth: 1, borderColor: "#d0d5dd" }
			: entry.props.border === "divider"
				? { borderLeftWidth: 2, borderLeftColor: ast.tokens.primaryColor, paddingLeft: ast.tokens.itemGap }
				: {}),
		...(entry.props.background === "page" ? { backgroundColor: ast.tokens.backgroundColor } : {}),
		...(entry.props.background === "sidebar" ? { backgroundColor: ast.tokens.sidebarColor } : {}),
		...(entry.props.background === "primary" ? { backgroundColor: ast.tokens.primaryColor } : {}),
		...(entry.props.backgroundColor ? { backgroundColor: entry.props.backgroundColor } : {}),
		...(entry.props.radius !== undefined ||
		entry.component === "box" ||
		(entry.props.border && entry.props.border !== "none") ||
		(entry.props.background && entry.props.background !== "transparent") ||
		entry.props.backgroundColor
			? { borderRadius: entry.props.radius ?? ast.tokens.radius }
			: {}),
	};
}

function ComposerContent(props: ComposerContentProps): ReactNode {
	const { entry, isRoot = false, sectionTitle, sectionContent, items, item, node, ast, styles } = props;
	if (entry.type === "repeat") {
		const columns = node.itemLayout?.columns ?? node.body?.root.props.columns ?? 1;
		const selectedItems = items.slice(entry.itemStart ?? 0, (entry.itemStart ?? 0) + (entry.itemCount ?? 48));
		const keepEachItemTogether = entry.children.some(composerEntryHasKeyValueTable);
		return (
			<View
				style={{
					flexDirection: columns > 1 ? "row" : "column",
					...(columns > 1 ? { flexWrap: "wrap" as const } : {}),
					columnGap: node.itemLayout?.columnGap ?? ast.tokens.itemGap,
					rowGap: entry.label === "Table rows" ? 0 : ast.tokens.itemGap,
				}}
			>
				{selectedItems.map((currentItem, index) => (
					<View
						key={currentItem.id}
						wrap={!keepEachItemTogether}
						style={{
							...(columns > 1 ? { width: `${Math.max(10, 100 / columns - 2)}%` } : {}),
							flexDirection: entry.itemMarker && entry.itemMarker !== "none" ? "row" : "column",
							columnGap: entry.itemMarker && entry.itemMarker !== "none" ? ast.tokens.itemGap / 2 : 0,
							rowGap: ast.tokens.itemGap / 2,
						}}
					>
						{entry.itemMarker && entry.itemMarker !== "none" && (
							<Text style={{ fontWeight: 700 }}>
								{entry.itemMarker === "number" ? `${(entry.itemStart ?? 0) + index + 1}.` : "•"}
							</Text>
						)}
						<View
							{...(entry.itemMarker && entry.itemMarker !== "none" ? { style: { flexGrow: 1, flexBasis: 0 } } : {})}
						>
							{entry.children.map((child) => (
								<ComposerContent key={child.id} {...props} entry={child} isRoot={false} item={currentItem} />
							))}
						</View>
					</View>
				))}
			</View>
		);
	}
	if (entry.type === "layout") {
		const columns = entry.component === "grid" ? (entry.props.columns ?? 1) : 1;
		return (
			<View style={composerContentLayoutStyle(entry, ast, isRoot)}>
				{entry.children.map((child) =>
					columns > 1 ? (
						<View key={child.id} style={{ width: `${Math.max(10, 100 / columns - 2)}%` }}>
							<ComposerContent {...props} entry={child} isRoot={false} {...(item ? { item } : {})} />
						</View>
					) : (
						<ComposerContent key={child.id} {...props} entry={child} isRoot={false} {...(item ? { item } : {})} />
					),
				)}
			</View>
		);
	}
	if (!entry.visible) return null;
	if (entry.component === "table" && entry.table) {
		const table = entry.table;
		if (table.orientation === "key-value") {
			const record = item ?? items[0];
			return (
				<View>
					{table.columns.map((column, columnIndex) => (
						<View
							key={column.id}
							style={{
								flexDirection: "row",
								borderBottomWidth: 0.5,
								borderTopWidth: columnIndex === 0 ? 0.5 : 0,
								borderLeftWidth: 0.5,
								borderRightWidth: 0.5,
								borderColor: "#c7cdd4",
							}}
						>
							<Text
								style={{
									width: `${column.width ?? 24}%`,
									padding: 4,
									fontSize: ast.tokens.bodySize * 0.74,
									fontWeight: 700,
									color: ast.tokens.primaryColor,
									backgroundColor: ast.tokens.sidebarColor,
								}}
							>
								{column.label}
							</Text>
							<Text
								style={{
									width: `${100 - (column.width ?? 24)}%`,
									padding: 4,
									fontSize: ast.tokens.bodySize * 0.74,
									borderLeftWidth: 0.5,
									borderLeftColor: "#c7cdd4",
								}}
							>
								{record ? stripHtml(composerItemBindingValue(record, column.binding)) : ""}
							</Text>
						</View>
					))}
				</View>
			);
		}
		const rows =
			table.mode === "static"
				? table.rows
				: items.map((currentItem) =>
						table.columns.map((column) => composerItemBindingValue(currentItem, column.binding)),
					);
		return (
			<View style={{ flexGrow: 1, flexBasis: 0 }}>
				{table.title && <Text style={{ marginBottom: 3, fontWeight: 700 }}>{table.title}</Text>}
				{table.headerVisible && (
					<View
						style={{
							flexDirection: "row",
							backgroundColor: ast.tokens.primaryColor,
							borderWidth: 0.5,
							borderColor: ast.tokens.primaryColor,
						}}
					>
						{table.columns.map((column) => (
							<Text
								key={column.id}
								style={{
									width: `${column.width ?? 100 / table.columns.length}%`,
									padding: 3,
									fontSize: ast.tokens.bodySize * 0.72,
									fontWeight: 700,
									color: ast.tokens.backgroundColor,
									textAlign: column.align,
									borderRightWidth: 0.5,
									borderRightColor: ast.tokens.backgroundColor,
								}}
							>
								{column.label}
							</Text>
						))}
					</View>
				)}
				{rows.map((row, rowIndex) => (
					<View
						key={`${entry.id}-row-${rowIndex}`}
						style={{ flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#c7cdd4" }}
					>
						{table.columns.map((column, columnIndex) => (
							<Text
								key={column.id}
								style={{
									width: `${column.width ?? 100 / table.columns.length}%`,
									padding: 3,
									fontSize: ast.tokens.bodySize * 0.72,
									fontWeight: columnIndex === 0 ? 700 : 400,
									textAlign: column.align,
									borderLeftWidth: 0.5,
									borderRightWidth: columnIndex === table.columns.length - 1 ? 0.5 : 0,
									borderColor: "#c7cdd4",
								}}
							>
								{row[columnIndex] ?? ""}
							</Text>
						))}
					</View>
				))}
			</View>
		);
	}
	const bindingValue =
		entry.binding === "literal"
			? (entry.literal ?? "")
			: entry.binding === "section.title"
				? sectionTitle
				: entry.binding === "section.content"
					? sectionContent
					: (item?.[entry.binding.replace("item.", "") as keyof ComposerItem] ?? "");
	if (!stripHtml(String(bindingValue))) return null;
	const value = `${entry.prefix ?? ""}${String(bindingValue)}${entry.suffix ?? ""}`.trim();
	if (!value) return null;
	if (entry.component === "progress") {
		const numericValue = Math.max(0, Math.min(5, Number(value) || 0));
		return (
			<View style={{ height: 4, width: "100%", backgroundColor: "#d7dde3" }}>
				<View style={{ height: 4, width: `${(numericValue / 5) * 100}%`, backgroundColor: ast.tokens.primaryColor }} />
			</View>
		);
	}
	if (entry.component === "heading") {
		if (node.appearance?.heading === "hidden") return null;
		const headingStyle: Style =
			node.appearance?.heading === "filled"
				? {
						...styles.sectionHeading,
						backgroundColor: ast.tokens.primaryColor,
						color: ast.tokens.backgroundColor,
						padding: ast.tokens.itemGap / 2,
						borderBottomWidth: 0,
					}
				: node.appearance?.heading === "badge"
					? {
							...styles.sectionHeading,
							alignSelf: "flex-start",
							backgroundColor: ast.tokens.primaryColor,
							color: ast.tokens.backgroundColor,
							padding: ast.tokens.itemGap / 2,
							borderRadius: ast.tokens.radius,
							borderBottomWidth: 0,
						}
					: node.appearance?.heading === "plain"
						? { ...styles.sectionHeading, borderBottomWidth: 0 }
						: styles.sectionHeading;
		return <Heading style={headingStyle}>{value}</Heading>;
	}
	if (entry.component === "badge") {
		return (
			<View style={styles.skillTag}>
				<Text>{value}</Text>
			</View>
		);
	}
	if (entry.component === "list") {
		return (
			<View style={{ rowGap: 2 }}>
				{listTextItems(value).map((listItem, index) => (
					<View key={`${entry.id}-${index}`} style={{ flexDirection: "row", columnGap: 4 }}>
						<Text>➢</Text>
						<Text style={{ flexGrow: 1, flexBasis: 0 }}>{listItem}</Text>
					</View>
				))}
			</View>
		);
	}
	return (
		<Text
			style={{
				...(entry.variant === "strong" ? { fontWeight: 700 } : {}),
				...(entry.variant === "muted" || entry.component === "meta" ? { opacity: 0.7 } : {}),
				...(entry.variant === "accent" ? { color: ast.tokens.primaryColor } : {}),
			}}
		>
			{entry.component === "rich-text" ? stripHtml(value) : value}
		</Text>
	);
}

function ComposerSection({ node, ast, styles }: AstSectionProps) {
	const data = useRender();
	const sectionData = (data.sections as unknown as Record<string, { title?: string; items?: unknown[] }>)[node.section];
	const sectionTitle = node.title ?? sectionData?.title ?? node.section;
	const sectionContent = node.section === "summary" ? data.summary.content : "";
	const items = (sectionData?.items ?? []).map((item, index) => normalizeComposerItem(item, node.section, index));
	if (!node.body) return null;
	return (
		<View style={styles.section}>
			<ComposerContent
				entry={node.body.root}
				isRoot
				sectionTitle={sectionTitle}
				sectionContent={sectionContent}
				items={items}
				node={node}
				ast={ast}
				styles={styles}
			/>
		</View>
	);
}

function AstSection({ node, ast, styles }: AstSectionProps) {
	const data = useRender();
	const appearance = node.appearance ?? {
		heading: "underline" as const,
		itemHeader: "split" as const,
		itemDecoration: "none" as const,
	};
	const itemLayout = node.itemLayout ?? {
		columns: 1,
		columnGap: ast.tokens.itemGap,
		rowGap: ast.tokens.itemGap,
	};
	const skillItems =
		node.section === "skills"
			? data.sections.skills.items
					.filter((item) => !item.hidden)
					.slice(node.itemStart ?? 0, (node.itemStart ?? 0) + (node.itemCount ?? 48))
			: [];
	const sectionStyles = useMemo(() => {
		const headingAppearance: Style =
			appearance.heading === "plain"
				? { borderBottomWidth: 0, paddingBottom: 0 }
				: appearance.heading === "filled"
					? {
							borderBottomWidth: 0,
							backgroundColor: ast.tokens.primaryColor,
							color: ast.tokens.backgroundColor,
							padding: ast.tokens.itemGap / 2,
						}
					: appearance.heading === "badge"
						? {
								alignSelf: "flex-start",
								borderBottomWidth: 0,
								backgroundColor: ast.tokens.primaryColor,
								color: ast.tokens.backgroundColor,
								paddingHorizontal: ast.tokens.itemGap,
								paddingVertical: ast.tokens.itemGap / 2,
								borderRadius: ast.tokens.radius,
							}
						: {};
		const itemDecoration: Style =
			appearance.itemDecoration === "divider"
				? { borderBottomWidth: 1, borderBottomColor: ast.tokens.primaryColor, paddingBottom: itemLayout.rowGap }
				: appearance.itemDecoration === "border"
					? { borderWidth: 1, borderColor: ast.tokens.primaryColor, padding: ast.tokens.itemGap }
					: appearance.itemDecoration === "card"
						? {
								borderWidth: 1,
								borderColor: "#d0d5dd",
								backgroundColor: ast.tokens.sidebarColor,
								padding: ast.tokens.itemGap,
								borderRadius: ast.tokens.radius,
							}
						: {};

		return {
			...styles,
			section: {
				...styles.section,
				rowGap: node.variant === "compact" ? itemLayout.rowGap / 2 : itemLayout.rowGap,
			},
			sectionHeading: { ...styles.sectionHeading, ...headingAppearance },
			splitRow: {
				...styles.splitRow,
				...(appearance.itemHeader === "stacked"
					? { flexDirection: "column" as const, alignItems: "flex-start" as const }
					: {}),
			},
			item: {
				...styles.item,
				rowGap: node.variant === "compact" ? 1 : itemLayout.rowGap / 2,
				...itemDecoration,
				...(node.variant === "boxed" ? { borderWidth: 1, borderColor: "#d0d5dd", padding: ast.tokens.itemGap } : {}),
			},
		};
	}, [appearance, ast.tokens, itemLayout, node.variant, styles]);

	if (node.body) return <ComposerSection node={node} ast={ast} styles={sectionStyles} />;

	if (node.section === "skills" && ["tags", "bullets", "table"].includes(node.variant)) {
		const title = node.title ?? data.sections.skills.title ?? "Skills";
		return (
			<View style={styles.section}>
				<Heading style={styles.sectionHeading}>{title}</Heading>
				{node.variant === "tags" && (
					<View style={styles.skillTags}>
						{skillItems.map((item) => (
							<View key={item.id} style={styles.skillTag}>
								<Text>{item.name}</Text>
							</View>
						))}
					</View>
				)}
				{node.variant === "bullets" && (
					<View style={styles.sectionItems}>
						{skillItems.map((item) => (
							<View key={item.id} style={styles.skillBulletRow}>
								<Text style={styles.skillBullet}>•</Text>
								<Text>
									{item.name}
									{item.keywords.length > 0 ? `: ${item.keywords.join(", ")}` : ""}
								</Text>
							</View>
						))}
					</View>
				)}
				{node.variant === "table" && (
					<View style={styles.skillTable}>
						<View style={[styles.skillTableRow, styles.skillTableHeader]}>
							<Text style={styles.skillTableName}>Skill</Text>
							<Text style={styles.skillTableMeta}>Proficiency</Text>
							<Text style={styles.skillTableMeta}>Keywords</Text>
						</View>
						{skillItems.map((item) => (
							<View key={item.id} style={styles.skillTableRow}>
								<Text style={styles.skillTableName}>{item.name}</Text>
								<Text style={styles.skillTableMeta}>{item.proficiency}</Text>
								<Text style={styles.skillTableMeta}>{item.keywords.join(", ")}</Text>
							</View>
						))}
					</View>
				)}
			</View>
		);
	}

	return (
		<TemplateProvider
			styles={sectionStyles}
			colors={{
				foreground: ast.tokens.textColor,
				background: ast.tokens.backgroundColor,
				primary: ast.tokens.primaryColor,
			}}
			features={{
				sectionTimeline: node.variant === "timeline",
				inlineItemHeader: appearance.itemHeader === "inline",
				stackSidebarItemHeader: appearance.itemHeader === "stacked",
				mainItemHeaderBorder: node.variant === "boxed" || appearance.itemDecoration === "border",
			}}
		>
			<Section
				section={node.section}
				placement={node.column === "sidebar" || /(?:side|rail|aside)/i.test(node.region ?? "") ? "sidebar" : "main"}
				showHeading={appearance.heading !== "hidden"}
				itemLayoutOverride={itemLayout}
				{...(node.title ? { titleOverride: node.title } : {})}
			/>
		</TemplateProvider>
	);
}

type AstHeaderProps = { node: TemplateHeaderNode; styles: AstStyles; ast: TemplateAst };

function AstHeader({ node, styles, ast }: AstHeaderProps) {
	const data = useRender();
	const compact = node.variant !== "standard";
	const split = node.variant === "split";
	return (
		<View style={composeStyles(styles.header, compact ? { paddingBottom: ast.tokens.itemGap } : undefined)}>
			<View style={composeStyles(styles.headerRow, split ? { justifyContent: "space-between" } : undefined)}>
				{node.showPicture && !data.picture.hidden && data.picture.url && (
					<Image src={data.picture.url} style={styles.picture} />
				)}
				<View style={{ flex: split ? 0.62 : 1 }}>
					<Heading
						style={composeStyles(styles.headerName, compact ? { fontSize: ast.tokens.bodySize * 1.7 } : undefined)}
					>
						{data.basics.name}
					</Heading>
					<Text>{data.basics.headline}</Text>
				</View>
				{split && node.showContact && (
					<View style={{ flex: 0.35, alignItems: "flex-end", rowGap: 2 }}>
						{[data.basics.email, data.basics.phone, data.basics.location].filter(Boolean).map((value) => (
							<Text key={value} style={styles.contact}>
								{value}
							</Text>
						))}
					</View>
				)}
			</View>
			{!split && node.showContact && (
				<Text style={styles.contact}>
					{[data.basics.email, data.basics.phone, data.basics.location].filter(Boolean).join("  ·  ")}
				</Text>
			)}
		</View>
	);
}

type AstFlowNodeProps = { node: TemplateFlowNode; ast: TemplateAst; styles: AstStyles };

function AstFlowNode({ node, ast, styles }: AstFlowNodeProps) {
	let content: ReactNode;
	if (node.type === "section") content = <AstSection node={node} ast={ast} styles={styles} />;
	if (node.type === "header") content = <AstHeader node={node} ast={ast} styles={styles} />;
	if (node.type === "divider") {
		content = (
			<View
				style={{
					borderTopColor: node.color,
					borderTopWidth: node.thickness,
					borderTopStyle: node.style,
				}}
			/>
		);
	}
	if (node.type === "spacer") content = <View style={{ height: node.height }} />;

	return (
		<>
			<View
				break={node.breakBefore}
				fixed={node.repeatOnPage}
				minPresenceAhead={Math.max(node.minPresenceAhead, node.keepWithNext ? ast.tokens.sectionGap * 2 : 0)}
				wrap={node.breakInside !== "avoid"}
				{...(node.overflow === "clip" ? { style: { overflow: "hidden" as const } } : {})}
			>
				{content}
			</View>
			{node.breakAfter && <View break />}
		</>
	);
}

function AstShape({ node }: { node: TemplateShapeNode }) {
	return (
		<View
			fixed={node.repeatOnPage}
			style={{
				position: "absolute",
				left: node.x,
				top: node.y,
				width: node.width,
				height: node.height,
				backgroundColor: node.color,
				opacity: node.opacity,
				borderRadius: node.shape === "circle" ? 999 : node.radius,
				transform: `rotate(${node.rotation}deg)`,
				zIndex: node.zIndex,
			}}
		/>
	);
}

type AstPageComposerProps = {
	entry: TemplateComposerPageNode;
	nodeMap: Map<string, TemplateFlowNode>;
	ast: TemplateAst;
	styles: AstStyles;
};

function composerLayoutStyle(entry: Extract<TemplateComposerPageNode, { type: "layout" }>, ast: TemplateAst): Style {
	const { props } = entry;
	const horizontal = entry.component === "row" || entry.component === "columns" || props.direction === "horizontal";
	const backgroundColor =
		props.backgroundColor ??
		(props.background === "sidebar"
			? ast.tokens.sidebarColor
			: props.background === "primary"
				? ast.tokens.primaryColor
				: props.background === "page"
					? ast.tokens.backgroundColor
					: undefined);
	const gap =
		entry.id === "page-root" && ast.layout.preset === "two-column"
			? (ast.layout.columnGap ?? props.gap ?? 18)
			: entry.id === "page-root" && ast.layout.preset === "grid"
				? ast.layout.pageGrid?.gap
				: entry.id === "page-root" || entry.id.startsWith("region-")
					? ast.tokens.sectionGap
					: props.gap;
	return {
		flexDirection: horizontal ? "row" : "column",
		...(entry.component === "grid" ? { flexWrap: "wrap" as const } : {}),
		...(props.width ? { flexBasis: `${props.width}%`, flexGrow: props.width, flexShrink: 1, minWidth: 0 } : {}),
		...(gap !== undefined ? { gap } : {}),
		...(props.rowGap !== undefined ? { rowGap: props.rowGap } : {}),
		...(props.columnGap !== undefined ? { columnGap: props.columnGap } : {}),
		...(props.padding !== undefined ? { padding: props.padding } : {}),
		...(backgroundColor ? { backgroundColor } : {}),
		...(props.border === "solid"
			? { borderWidth: 1, borderColor: ast.tokens.primaryColor }
			: props.border === "divider"
				? { borderLeftWidth: 2, borderLeftColor: ast.tokens.primaryColor }
				: {}),
		...(props.radius !== undefined ? { borderRadius: props.radius } : {}),
		alignItems: props.align === "center" ? "center" : props.align === "end" ? "flex-end" : "stretch",
		justifyContent:
			props.justify === "center"
				? "center"
				: props.justify === "end"
					? "flex-end"
					: props.justify === "between"
						? "space-between"
						: "flex-start",
	};
}

function AstPageComposer({ entry, nodeMap, ast, styles }: AstPageComposerProps) {
	if (entry.type === "slot") {
		const node = nodeMap.get(entry.nodeId);
		return node ? <AstFlowNode node={node} ast={ast} styles={styles} /> : null;
	}
	return (
		<View style={composerLayoutStyle(entry, ast)}>
			{entry.children.map((child) => (
				<AstPageComposer key={child.id} entry={child} nodeMap={nodeMap} ast={ast} styles={styles} />
			))}
		</View>
	);
}

export const AstTemplatePage = ({ pageIndex }: TemplatePageProps) => {
	const data = useRender();
	const ast = data.metadata.customTemplate?.ast ?? defaultTemplateAst;
	const styles = useAstStyles(ast);
	const pageSize = getTemplatePageSize(data.metadata.page.format);
	const pageMinHeightStyle = getTemplatePageMinHeightStyle(data.metadata.page.format);
	const flowNodes = ast.nodes.filter((node): node is TemplateFlowNode => node.type !== "shape" && node.visible);
	const shapeNodes = ast.nodes.filter((node): node is TemplateShapeNode => node.type === "shape" && node.visible);
	const hasHeader = flowNodes.some((node) => node.type === "header");
	const nodeMap = new Map(flowNodes.map((node) => [node.id, node]));
	const fallbackHeader: TemplateHeaderNode = {
		id: "legacy-header-fallback",
		type: "header",
		column: "main",
		variant: "standard",
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
	};

	return (
		<Page size={pageSize} style={composeStyles(styles.page, pageMinHeightStyle)}>
			{shapeNodes.map((node) => (
				<AstShape key={node.id} node={node} />
			))}
			<TemplateProvider
				styles={styles}
				colors={{
					foreground: ast.tokens.textColor,
					background: ast.tokens.backgroundColor,
					primary: ast.tokens.primaryColor,
				}}
			>
				{!hasHeader && pageIndex === 0 && <AstFlowNode node={fallbackHeader} ast={ast} styles={styles} />}
				<AstPageComposer entry={ast.page.root} nodeMap={nodeMap} ast={ast} styles={styles} />
			</TemplateProvider>
		</Page>
	);
};

function useAstStyles(ast: TemplateAst): AstStyles {
	return useMemo(() => {
		const bodyText = {
			fontFamily: ast.tokens.bodyFont,
			fontSize: ast.tokens.bodySize,
			lineHeight: 1.45,
			color: ast.tokens.textColor,
		} satisfies Style;

		return StyleSheet.create({
			page: {
				color: ast.tokens.textColor,
				backgroundColor: ast.tokens.backgroundColor,
				padding: ast.layout.pagePadding,
				fontFamily: ast.tokens.bodyFont,
				fontSize: ast.tokens.bodySize,
				lineHeight: 1.45,
				rowGap: ast.tokens.sectionGap,
			},
			header: {
				borderBottomWidth: 2,
				borderBottomColor: ast.tokens.primaryColor,
				paddingBottom: ast.tokens.sectionGap / 2,
				rowGap: ast.tokens.itemGap / 2,
			},
			headerRow: { flexDirection: "row", alignItems: "center", columnGap: ast.tokens.itemGap },
			headerName: {
				color: ast.tokens.headingColor ?? ast.tokens.primaryColor,
				fontFamily: ast.tokens.headingFont,
				fontSize: ast.tokens.bodySize * 2.2,
				fontWeight: 700,
			},
			contact: { color: ast.tokens.textColor, opacity: 0.75 },
			picture: {
				width: ast.tokens.bodySize * 5,
				height: ast.tokens.bodySize * 5,
				borderRadius: ast.tokens.radius,
				objectFit: "cover",
			},
			splitRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", columnGap: 4 },
			alignEnd: { textAlign: "right" },
			inlineItemHeader: { flexDirection: "row", alignItems: "flex-start", columnGap: ast.tokens.itemGap / 2 },
			contentRow: {
				flexDirection: "row",
				columnGap: ast.tokens.sectionGap,
			},
			sidebarColumn: {
				flexBasis: `${ast.layout.sidebarWidth}%`,
				flexShrink: 0,
				rowGap: ast.tokens.sectionGap,
				padding: ast.tokens.itemGap,
				backgroundColor: ast.tokens.sidebarColor,
				borderRadius: ast.tokens.radius,
			},
			mainColumn: { flex: 1, rowGap: ast.tokens.sectionGap },
			text: bodyText,
			heading: { fontFamily: ast.tokens.headingFont, color: ast.tokens.textColor },
			richParagraph: { margin: 0, ...bodyText },
			richListItemRow: { flexDirection: "row", columnGap: ast.tokens.itemGap / 2, alignItems: "flex-start" },
			richListItemMarker: { ...bodyText, width: ast.tokens.bodySize, flex: "initial" },
			richListItemContent: {
				...bodyText,
				flex: "initial",
			},
			section: { flexDirection: "column", rowGap: ast.tokens.itemGap },
			sectionHeading: {
				color: ast.tokens.headingColor ?? ast.tokens.textColor,
				fontFamily: ast.tokens.headingFont,
				fontSize: ast.tokens.bodySize * 1.25,
				borderBottomWidth: 1,
				borderBottomColor: ast.tokens.primaryColor,
				paddingBottom: 2,
			},
			sectionItems: { rowGap: ast.tokens.itemGap },
			item: { rowGap: ast.tokens.itemGap / 2 },
			sectionItemHeader: {
				backgroundColor: ast.tokens.primaryColor,
				padding: ast.tokens.itemGap / 2,
			},
			levelContainer: { width: "100%" },
			levelItem: { borderColor: ast.tokens.primaryColor },
			levelItemActive: { backgroundColor: ast.tokens.primaryColor },
			levelItemInactive: { backgroundColor: ast.tokens.backgroundColor },
			icon: { color: ast.tokens.primaryColor, size: ast.tokens.bodySize },
			skillTags: { flexDirection: "row", flexWrap: "wrap", gap: ast.tokens.itemGap / 2 },
			skillTag: {
				backgroundColor: ast.tokens.sidebarColor,
				borderRadius: ast.tokens.radius,
				paddingHorizontal: ast.tokens.itemGap,
				paddingVertical: ast.tokens.itemGap / 2,
			},
			skillBulletRow: { flexDirection: "row", columnGap: ast.tokens.itemGap / 2 },
			skillBullet: { color: ast.tokens.primaryColor, width: ast.tokens.bodySize },
			skillTable: { borderWidth: 1, borderColor: "#d0d5dd" },
			skillTableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#d0d5dd" },
			skillTableHeader: { backgroundColor: ast.tokens.primaryColor, fontWeight: 700 },
			skillTableName: { flexBasis: "32%", padding: ast.tokens.itemGap / 2, fontWeight: 700 },
			skillTableMeta: {
				flexBasis: "34%",
				padding: ast.tokens.itemGap / 2,
				borderLeftWidth: 1,
				borderLeftColor: "#d0d5dd",
			},
		});
	}, [ast]);
}
