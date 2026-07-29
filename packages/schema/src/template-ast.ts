import z from "zod";

export const templateLifecycleStatusSchema = z.enum(["draft", "review", "published", "deprecated", "archived"]);

export const templateLayoutPresetSchema = z.enum(["one-column", "two-column", "grid"]);

export const templateSectionKindSchema = z.enum([
	"summary",
	"profiles",
	"experience",
	"education",
	"projects",
	"skills",
	"languages",
	"certifications",
	"interests",
	"awards",
	"publications",
	"volunteer",
	"references",
]);

export const templateSectionVariantSchema = z.enum([
	"standard",
	"compact",
	"timeline",
	"tags",
	"bullets",
	"table",
	"boxed",
]);

const sectionVariantRegistry = {
	summary: ["standard", "compact", "boxed"],
	profiles: ["standard", "compact", "tags"],
	experience: ["standard", "compact", "timeline", "boxed"],
	education: ["standard", "compact", "timeline", "boxed"],
	projects: ["standard", "compact", "timeline", "boxed"],
	skills: ["standard", "compact", "tags", "bullets", "table", "boxed"],
	languages: ["standard", "compact", "tags", "bullets"],
	certifications: ["standard", "compact", "timeline", "tags", "boxed"],
	interests: ["standard", "compact", "tags", "bullets"],
	awards: ["standard", "compact", "timeline", "boxed"],
	publications: ["standard", "compact", "timeline", "boxed"],
	volunteer: ["standard", "compact", "timeline", "boxed"],
	references: ["standard", "compact", "boxed"],
} as const;

export const templateSectionComponentRegistry = Object.fromEntries(
	templateSectionKindSchema.options.map((section) => [
		section,
		{
			identifier: `resume.section.${section}`,
			schemaVersion: "0.2" as const,
			binding: `resume.${section}`,
			supportedVariants: sectionVariantRegistry[section],
			editableProperties: ["title", "variant", "itemLayout", "appearance", "pagination"] as const,
			tokenSlots: [
				"color.primary",
				"color.heading",
				"type.heading",
				"type.body",
				"space.section",
				"space.item",
			] as const,
			pagination: {
				canSplit: section !== "summary",
				supportsKeepWithNext: true,
				supportsRepeat: true,
			},
			rendererCompatibility: ["html-preview", "react-pdf"] as const,
			fallbackVariant: "standard" as const,
		},
	]),
) as {
	[Section in keyof typeof sectionVariantRegistry]: {
		identifier: `resume.section.${Section}`;
		schemaVersion: "0.2";
		binding: `resume.${Section}`;
		supportedVariants: (typeof sectionVariantRegistry)[Section];
		editableProperties: readonly ["title", "variant", "itemLayout", "appearance", "pagination"];
		tokenSlots: readonly ["color.primary", "color.heading", "type.heading", "type.body", "space.section", "space.item"];
		pagination: { canSplit: boolean; supportsKeepWithNext: true; supportsRepeat: true };
		rendererCompatibility: readonly ["html-preview", "react-pdf"];
		fallbackVariant: "standard";
	};
};

export const templateFlowColumnSchema = z.enum(["main", "sidebar"]);
export const templateOverflowSchema = z.enum(["split", "clip", "shrink", "error"]);
export const templatePageRegionSchema = z
	.object({
		id: z.string().trim().min(1).max(40),
		width: z.number().min(10).max(100),
		padding: z.number().min(0).max(32).default(0),
		backgroundColor: z
			.string()
			.regex(/^#[0-9a-f]{6}$/i)
			.optional(),
	})
	.strict();

export const templateSectionItemLayoutSchema = z
	.object({
		columns: z.number().int().min(1).max(6).default(1),
		columnGap: z.number().min(0).max(32).default(8),
		rowGap: z.number().min(0).max(32).default(8),
	})
	.strict();

export const templateSectionAppearanceSchema = z
	.object({
		heading: z.enum(["underline", "plain", "filled", "badge", "hidden"]).default("underline"),
		itemHeader: z.enum(["split", "stacked", "inline"]).default("split"),
		itemDecoration: z.enum(["none", "divider", "border", "card"]).default("none"),
	})
	.strict();

export const templateComposerLayoutComponentSchema = z.enum([
	"stack",
	"row",
	"grid",
	"columns",
	"box",
	"table",
	"table-row",
	"table-cell",
]);
export const templateComposerBlockComponentSchema = z.enum([
	"heading",
	"text",
	"rich-text",
	"meta",
	"badge",
	"list",
	"table",
	"progress",
	"image",
	"contact",
]);
export const templateComposerBlockVariantSchema = z.enum([
	"plain",
	"strong",
	"muted",
	"accent",
	"pill",
	"bullet",
	"compact",
]);
export const templateComposerBindingSchema = z.enum([
	"literal",
	"section.title",
	"section.content",
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

export const templateComposerTableColumnSchema = z
	.object({
		id: z.string().trim().min(1).max(80),
		label: z.string().trim().min(1).max(80),
		binding: templateComposerBindingSchema.optional(),
		width: z.number().min(5).max(80).optional(),
		align: z.enum(["left", "center", "right"]).default("left"),
	})
	.strict();

export const templateComposerTableSchema = z
	.object({
		mode: z.enum(["static", "section-items"]),
		orientation: z.enum(["horizontal", "key-value"]).default("horizontal"),
		title: z.string().trim().min(1).max(120).optional(),
		columns: z.array(templateComposerTableColumnSchema).min(1).max(8),
		rows: z
			.array(z.array(z.string().max(500)).min(1).max(8))
			.max(48)
			.default([]),
		headerVisible: z.boolean().default(true),
	})
	.strict()
	.superRefine((table, context) => {
		for (const [index, row] of table.rows.entries()) {
			if (row.length !== table.columns.length) {
				context.addIssue({
					code: "custom",
					path: ["rows", index],
					message: "Table rows must contain one value for every column.",
				});
			}
		}
		if (table.mode === "section-items" && table.columns.every((column) => !column.binding)) {
			context.addIssue({
				code: "custom",
				path: ["columns"],
				message: "A dynamic table needs at least one bound column.",
			});
		}
	});

export type TemplateComposerTable = z.infer<typeof templateComposerTableSchema>;

export type TemplateComposerLayoutProps = {
	direction?: "horizontal" | "vertical" | undefined;
	columns?: number | undefined;
	gap?: number | undefined;
	rowGap?: number | undefined;
	columnGap?: number | undefined;
	padding?: number | undefined;
	width?: number | undefined;
	align?: "start" | "center" | "end" | "stretch" | undefined;
	justify?: "start" | "center" | "end" | "between" | undefined;
	background?: "transparent" | "page" | "sidebar" | "primary" | undefined;
	backgroundColor?: string | undefined;
	border?: "none" | "solid" | "divider" | undefined;
	radius?: number | undefined;
};

export type TemplateComposerBlockNode = {
	id: string;
	type: "block";
	component: z.infer<typeof templateComposerBlockComponentSchema>;
	binding: z.infer<typeof templateComposerBindingSchema>;
	variant: z.infer<typeof templateComposerBlockVariantSchema>;
	visible: boolean;
	literal?: string | undefined;
	prefix?: string | undefined;
	suffix?: string | undefined;
	table?: z.infer<typeof templateComposerTableSchema> | undefined;
};

export type TemplateComposerRepeatNode = {
	id: string;
	type: "repeat";
	binding: "section.items";
	label?: string | undefined;
	itemMarker?: "none" | "number" | "bullet" | undefined;
	itemStart?: number | undefined;
	itemCount?: number | undefined;
	children: TemplateComposerContentNode[];
};

export type TemplateComposerContentLayoutNode = {
	id: string;
	type: "layout";
	component: z.infer<typeof templateComposerLayoutComponentSchema>;
	props: TemplateComposerLayoutProps;
	children: TemplateComposerContentNode[];
};

export type TemplateComposerContentNode =
	| TemplateComposerBlockNode
	| TemplateComposerRepeatNode
	| TemplateComposerContentLayoutNode;

export type TemplateComposerSlotNode = {
	id: string;
	type: "slot";
	nodeId: string;
};

export type TemplateComposerPageLayoutNode = {
	id: string;
	type: "layout";
	component: z.infer<typeof templateComposerLayoutComponentSchema>;
	props: TemplateComposerLayoutProps;
	children: TemplateComposerPageNode[];
};

export type TemplateComposerPageNode = TemplateComposerSlotNode | TemplateComposerPageLayoutNode;

export const templateComposerLayoutPropsSchema = z
	.object({
		direction: z.enum(["horizontal", "vertical"]).optional(),
		columns: z.number().int().min(1).max(6).optional(),
		gap: z.number().min(0).max(40).optional(),
		rowGap: z.number().min(0).max(40).optional(),
		columnGap: z.number().min(0).max(40).optional(),
		padding: z.number().min(0).max(48).optional(),
		width: z.number().min(5).max(100).optional(),
		align: z.enum(["start", "center", "end", "stretch"]).optional(),
		justify: z.enum(["start", "center", "end", "between"]).optional(),
		background: z.enum(["transparent", "page", "sidebar", "primary"]).optional(),
		backgroundColor: z
			.string()
			.regex(/^#[0-9a-f]{6}$/i)
			.optional(),
		border: z.enum(["none", "solid", "divider"]).optional(),
		radius: z.number().min(0).max(32).optional(),
	})
	.strict();

export const templateComposerBlockNodeSchema: z.ZodType<TemplateComposerBlockNode> = z
	.object({
		id: z.string().trim().min(1).max(80),
		type: z.literal("block"),
		component: templateComposerBlockComponentSchema,
		binding: templateComposerBindingSchema,
		variant: templateComposerBlockVariantSchema.default("plain"),
		visible: z.boolean().default(true),
		literal: z.string().max(500).optional(),
		prefix: z.string().max(40).optional(),
		suffix: z.string().max(40).optional(),
		table: templateComposerTableSchema.optional(),
	})
	.strict()
	.superRefine((block, context) => {
		if (block.table && block.component !== "table") {
			context.addIssue({
				code: "custom",
				path: ["table"],
				message: "Table configuration is only valid for table blocks.",
			});
		}
		if (block.binding === "literal" && block.literal === undefined) {
			context.addIssue({
				code: "custom",
				path: ["literal"],
				message: "Literal content blocks require a literal value.",
			});
		}
	});

export const templateComposerContentLayoutNodeSchema: z.ZodType<TemplateComposerContentLayoutNode> = z.lazy(() =>
	z
		.object({
			id: z.string().trim().min(1).max(80),
			type: z.literal("layout"),
			component: templateComposerLayoutComponentSchema,
			props: templateComposerLayoutPropsSchema.default({}),
			children: z.array(templateComposerContentNodeSchema).min(1).max(24),
		})
		.strict(),
);

export const templateComposerContentNodeSchema: z.ZodType<TemplateComposerContentNode> = z.lazy(() =>
	z.union([
		templateComposerBlockNodeSchema,
		z
			.object({
				id: z.string().trim().min(1).max(80),
				type: z.literal("repeat"),
				binding: z.literal("section.items"),
				label: z.string().trim().min(1).max(80).optional(),
				itemMarker: z.enum(["none", "number", "bullet"]).optional(),
				itemStart: z.number().int().min(0).max(47).optional(),
				itemCount: z.number().int().min(1).max(48).optional(),
				children: z.array(templateComposerContentNodeSchema).min(1).max(16),
			})
			.strict(),
		templateComposerContentLayoutNodeSchema,
	]),
);

function composerLiteralBlock(
	id: string,
	literal: string,
	variant: TemplateComposerBlockNode["variant"] = "plain",
): TemplateComposerBlockNode {
	return {
		id,
		type: "block",
		component: "text",
		binding: "literal",
		literal,
		variant,
		visible: true,
	};
}

function composerBoundBlock(
	id: string,
	binding: TemplateComposerBlockNode["binding"] | undefined,
): TemplateComposerBlockNode {
	return binding
		? {
				id,
				type: "block",
				component: binding === "item.description" || binding === "item.value" ? "rich-text" : "text",
				binding,
				variant: "plain",
				visible: true,
			}
		: composerLiteralBlock(id, "");
}

function composerTableCell(
	id: string,
	width: number,
	child: TemplateComposerContentNode,
	background: TemplateComposerLayoutProps["background"] = "page",
): TemplateComposerContentLayoutNode {
	return {
		id,
		type: "layout",
		component: "table-cell",
		props: { width, padding: 4, border: "solid", radius: 0, background },
		children: [child],
	};
}

function composerTableRow(id: string, cells: TemplateComposerContentNode[]): TemplateComposerContentLayoutNode {
	return {
		id,
		type: "layout",
		component: "table-row",
		props: { direction: "horizontal", gap: 0, align: "stretch" },
		children: cells,
	};
}

function composerTableId(base: string, suffix: string) {
	const availableBaseLength = Math.max(1, 79 - suffix.length);
	return `${base.slice(0, availableBaseLength)}-${suffix}`;
}

export function createComposerTableLayout(id: string, table: TemplateComposerTable): TemplateComposerContentLayoutNode {
	const layoutId = id.slice(0, 80);
	const tableChildren: TemplateComposerContentNode[] = [];
	if (table.title) tableChildren.push(composerLiteralBlock(composerTableId(layoutId, "title"), table.title, "strong"));

	if (table.orientation === "key-value") {
		for (const [rowIndex, column] of table.columns.entries()) {
			const labelWidth = column.width ?? 24;
			const rowId = composerTableId(layoutId, `r${rowIndex + 1}`);
			tableChildren.push(
				composerTableRow(rowId, [
					composerTableCell(
						composerTableId(layoutId, `r${rowIndex + 1}-label`),
						labelWidth,
						composerLiteralBlock(composerTableId(layoutId, `r${rowIndex + 1}-label-text`), column.label, "accent"),
						"sidebar",
					),
					composerTableCell(
						composerTableId(layoutId, `r${rowIndex + 1}-value`),
						100 - labelWidth,
						composerBoundBlock(composerTableId(layoutId, `r${rowIndex + 1}-value-content`), column.binding),
					),
				]),
			);
		}
	} else {
		const widths = table.columns.map((column) => column.width ?? 100 / table.columns.length);
		if (table.headerVisible) {
			tableChildren.push(
				composerTableRow(
					composerTableId(layoutId, "header"),
					table.columns.map((column, columnIndex) =>
						composerTableCell(
							composerTableId(layoutId, `header-cell-${columnIndex + 1}`),
							widths[columnIndex] ?? 100 / table.columns.length,
							composerLiteralBlock(
								composerTableId(layoutId, `header-content-${columnIndex + 1}`),
								column.label,
								"strong",
							),
							"sidebar",
						),
					),
				),
			);
		}

		const rowFor = (
			rowId: string,
			contentFor: (columnIndex: number) => TemplateComposerContentNode,
		): TemplateComposerContentLayoutNode =>
			composerTableRow(
				rowId,
				table.columns.map((_column, columnIndex) =>
					composerTableCell(
						composerTableId(rowId, `cell-${columnIndex + 1}`),
						widths[columnIndex] ?? 100 / table.columns.length,
						contentFor(columnIndex),
					),
				),
			);

		if (table.mode === "static") {
			for (const [rowIndex, row] of table.rows.entries()) {
				const rowId = composerTableId(layoutId, `r${rowIndex + 1}`);
				tableChildren.push(
					rowFor(rowId, (columnIndex) =>
						composerLiteralBlock(
							composerTableId(layoutId, `r${rowIndex + 1}-content-${columnIndex + 1}`),
							row[columnIndex] ?? "",
						),
					),
				);
			}
		} else {
			tableChildren.push({
				id: composerTableId(layoutId, "rows"),
				type: "repeat",
				binding: "section.items",
				label: "Table rows",
				itemMarker: "none",
				children: [
					rowFor(composerTableId(layoutId, "dynamic-row"), (columnIndex) =>
						composerBoundBlock(
							composerTableId(layoutId, `dynamic-content-${columnIndex + 1}`),
							table.columns[columnIndex]?.binding,
						),
					),
				],
			});
		}
	}

	return {
		id: layoutId,
		type: "layout",
		component: "table",
		props: { direction: "vertical", gap: 0, rowGap: 0, columnGap: 0, width: 100, radius: 0 },
		children: tableChildren.length > 0 ? tableChildren : [composerLiteralBlock(composerTableId(layoutId, "empty"), "")],
	};
}

function migrateComposerTableBlocks(entry: TemplateComposerContentLayoutNode): TemplateComposerContentLayoutNode;
function migrateComposerTableBlocks(entry: TemplateComposerContentNode): TemplateComposerContentNode;
function migrateComposerTableBlocks(entry: TemplateComposerContentNode): TemplateComposerContentNode {
	if (entry.type === "block") {
		if (entry.component === "table" && entry.table) return createComposerTableLayout(entry.id, entry.table);
		return entry;
	}
	return { ...entry, children: entry.children.map(migrateComposerTableBlocks) };
}

export const templateComposerPageNodeSchema: z.ZodType<TemplateComposerPageNode> = z.lazy(() =>
	z.discriminatedUnion("type", [
		z
			.object({
				id: z.string().trim().min(1).max(80),
				type: z.literal("slot"),
				nodeId: z.string().trim().min(1).max(80),
			})
			.strict(),
		z
			.object({
				id: z.string().trim().min(1).max(80),
				type: z.literal("layout"),
				component: templateComposerLayoutComponentSchema,
				props: templateComposerLayoutPropsSchema.default({}),
				children: z.array(templateComposerPageNodeSchema).max(48),
			})
			.strict(),
	]),
);

export const templateSectionBodySchema = z
	.object({
		component: z.enum(["flow", "timeline", "cards", "tags", "table", "list"]),
		root: templateComposerContentLayoutNodeSchema,
	})
	.strict();

const flowNodeFields = {
	column: templateFlowColumnSchema.default("main"),
	region: z.string().trim().min(1).max(40).optional(),
	visible: z.boolean().default(true),
	breakBefore: z.boolean().default(false),
	breakAfter: z.boolean().default(false),
	breakInside: z.enum(["auto", "avoid"]).default("avoid"),
	keepWithNext: z.boolean().default(true),
	minPresenceAhead: z.number().min(0).max(240).default(0),
	repeatOnPage: z.boolean().default(false),
	overflow: templateOverflowSchema.default("split"),
} as const;

export const templateSectionNodeSchema = z
	.object({
		id: z.string().min(1).max(80),
		type: z.literal("section"),
		section: templateSectionKindSchema,
		title: z.string().trim().min(1).max(120).optional(),
		variant: templateSectionVariantSchema.default("standard"),
		itemStart: z.number().int().min(0).max(47).optional(),
		itemCount: z.number().int().min(1).max(48).optional(),
		itemLayout: templateSectionItemLayoutSchema.optional(),
		appearance: templateSectionAppearanceSchema.optional(),
		body: templateSectionBodySchema.optional(),
		...flowNodeFields,
	})
	.strict()
	.superRefine((node, context) => {
		const definition = templateSectionComponentRegistry[node.section];
		if (!(definition.supportedVariants as readonly string[]).includes(node.variant)) {
			context.addIssue({
				code: "custom",
				path: ["variant"],
				message: `${node.variant} is not supported by ${definition.identifier}.`,
			});
		}
	});

export const templateHeaderNodeSchema = z
	.object({
		id: z.string().min(1).max(80),
		type: z.literal("header"),
		variant: z.enum(["standard", "compact", "sidebar", "split"]).default("standard"),
		showPicture: z.boolean().default(false),
		showContact: z.boolean().default(true),
		...flowNodeFields,
	})
	.strict();

export const templateDividerNodeSchema = z
	.object({
		id: z.string().min(1).max(80),
		type: z.literal("divider"),
		color: z.string().regex(/^#[0-9a-f]{6}$/i),
		thickness: z.number().min(0.5).max(8).default(1),
		style: z.enum(["solid", "dashed", "dotted"]).default("solid"),
		...flowNodeFields,
	})
	.strict();

export const templateSpacerNodeSchema = z
	.object({
		id: z.string().min(1).max(80),
		type: z.literal("spacer"),
		height: z.number().min(2).max(120).default(12),
		...flowNodeFields,
	})
	.strict();

export const templateShapeNodeSchema = z
	.object({
		id: z.string().min(1).max(80),
		type: z.literal("shape"),
		visible: z.boolean().default(true),
		shape: z.enum(["rectangle", "circle"]).default("rectangle"),
		x: z.number().min(-100).max(600),
		y: z.number().min(-100).max(900),
		width: z.number().min(4).max(700),
		height: z.number().min(4).max(1000),
		color: z.string().regex(/^#[0-9a-f]{6}$/i),
		opacity: z.number().min(0).max(1).default(1),
		rotation: z.number().min(-180).max(180).default(0),
		radius: z.number().min(0).max(999).default(0),
		zIndex: z.number().int().min(-10).max(10).default(-1),
		repeatOnPage: z.boolean().default(true),
	})
	.strict();

export const templateNodeSchema = z.discriminatedUnion("type", [
	templateSectionNodeSchema,
	templateHeaderNodeSchema,
	templateDividerNodeSchema,
	templateSpacerNodeSchema,
	templateShapeNodeSchema,
]);

export function createDefaultSectionBody(
	node: Pick<
		z.infer<typeof templateSectionNodeSchema>,
		"id" | "section" | "variant" | "itemLayout" | "itemStart" | "itemCount"
	>,
): z.infer<typeof templateSectionBodySchema> {
	const component =
		node.variant === "timeline"
			? ("timeline" as const)
			: node.variant === "tags"
				? ("tags" as const)
				: node.variant === "table"
					? ("table" as const)
					: node.variant === "bullets"
						? ("list" as const)
						: node.variant === "boxed"
							? ("cards" as const)
							: ("flow" as const);
	const itemLayout = node.itemLayout ?? { columns: 1, columnGap: 8, rowGap: 8 };
	const itemBlocks: TemplateComposerContentNode[] =
		node.section === "skills"
			? [
					{
						id: `${node.id}-primary`,
						type: "block",
						component: component === "tags" ? "badge" : "text",
						binding: "item.primary",
						variant: component === "tags" ? "pill" : "strong",
						visible: true,
					},
					{
						id: `${node.id}-keywords`,
						type: "block",
						component: "text",
						binding: "item.keywords",
						variant: "muted",
						visible: component !== "tags",
					},
				]
			: [
					{
						id: `${node.id}-primary`,
						type: "block",
						component: "text",
						binding: "item.primary",
						variant: "strong",
						visible: true,
					},
					{
						id: `${node.id}-secondary`,
						type: "block",
						component: "text",
						binding: "item.secondary",
						variant: "plain",
						visible: true,
					},
					{
						id: `${node.id}-meta`,
						type: "block",
						component: "meta",
						binding: "item.meta",
						variant: "muted",
						visible: true,
					},
					{
						id: `${node.id}-description`,
						type: "block",
						component: "rich-text",
						binding: "item.description",
						variant: "plain",
						visible: true,
					},
				];

	const children: TemplateComposerContentNode[] = [
		{
			id: `${node.id}-heading`,
			type: "block",
			component: "heading",
			binding: "section.title",
			variant: "accent",
			visible: true,
		},
	];
	if (node.section === "summary") {
		children.push({
			id: `${node.id}-content`,
			type: "block",
			component: "rich-text",
			binding: "section.content",
			variant: "plain",
			visible: true,
		});
	} else if (node.section === "skills" && component === "table") {
		children.push(
			createComposerTableLayout(`${node.id}-table`, {
				mode: "section-items",
				orientation: "horizontal",
				columns: [
					{ id: "skill", label: "Skill", binding: "item.primary", width: 42, align: "left" },
					{ id: "proficiency", label: "Proficiency", binding: "item.secondary", width: 24, align: "center" },
					{ id: "keywords", label: "Keywords", binding: "item.keywords", width: 34, align: "left" },
				],
				rows: [],
				headerVisible: true,
			}),
		);
	} else {
		children.push({
			id: `${node.id}-items`,
			type: "repeat",
			binding: "section.items",
			...(node.itemStart !== undefined ? { itemStart: node.itemStart } : {}),
			...(node.itemCount !== undefined ? { itemCount: node.itemCount } : {}),
			children: [
				{
					id: `${node.id}-item-layout`,
					type: "layout",
					component: component === "tags" ? "row" : "stack",
					props: {
						gap: Math.max(1, itemLayout.rowGap / 2),
						border: component === "cards" ? "solid" : component === "timeline" ? "divider" : "none",
						padding: component === "cards" ? 8 : 0,
					},
					children: itemBlocks,
				},
			],
		});
	}

	return {
		component,
		root: {
			id: `${node.id}-body`,
			type: "layout",
			component: "stack",
			props: {
				columns: itemLayout.columns,
				columnGap: itemLayout.columnGap,
				rowGap: itemLayout.rowGap,
			},
			children,
		},
	};
}

function createPageComposition(
	nodes: z.infer<typeof templateNodeSchema>[],
	layout: {
		preset: z.infer<typeof templateLayoutPresetSchema>;
		sidebarWidth: number;
		sidebarPosition: "left" | "right";
		columnGap: number;
		pageGrid?: { gap: number; regions: z.infer<typeof templatePageRegionSchema>[] } | undefined;
	},
) {
	const flowNodes = nodes.filter((node) => node.type !== "shape");
	const slot = (node: (typeof flowNodes)[number]): TemplateComposerSlotNode => ({
		id: `slot-${node.id}`,
		type: "slot",
		nodeId: node.id,
	});
	if (layout.preset === "one-column") {
		return {
			root: {
				id: "page-root",
				type: "layout",
				component: "stack",
				props: { direction: "vertical", gap: 18 },
				children: flowNodes.map(slot),
			} satisfies TemplateComposerPageLayoutNode,
		};
	}

	const regions =
		layout.preset === "grid" && layout.pageGrid
			? layout.pageGrid.regions
			: layout.sidebarPosition === "left"
				? [
						{ id: "sidebar", width: layout.sidebarWidth, padding: 8, backgroundColor: undefined },
						{ id: "main", width: 100 - layout.sidebarWidth, padding: 0, backgroundColor: undefined },
					]
				: [
						{ id: "main", width: 100 - layout.sidebarWidth, padding: 0, backgroundColor: undefined },
						{ id: "sidebar", width: layout.sidebarWidth, padding: 8, backgroundColor: undefined },
					];
	return {
		root: {
			id: "page-root",
			type: "layout",
			component: "columns",
			props: {
				direction: "horizontal",
				gap: layout.preset === "grid" ? (layout.pageGrid?.gap ?? layout.columnGap) : layout.columnGap,
			},
			children: regions.map(
				(region): TemplateComposerPageLayoutNode => ({
					id: `region-${region.id}`,
					type: "layout",
					component: "stack",
					props: {
						direction: "vertical",
						width: region.width,
						padding: region.padding,
						gap: 18,
						background: region.id === "sidebar" ? "sidebar" : "transparent",
						...(region.backgroundColor ? { backgroundColor: region.backgroundColor } : {}),
					},
					children: flowNodes.filter((node) => (node.region ?? node.column) === region.id).map(slot),
				}),
			),
		} satisfies TemplateComposerPageLayoutNode,
	};
}

export const templateAstSchema = z
	.object({
		schemaVersion: z.literal("0.2"),
		layout: z
			.object({
				preset: templateLayoutPresetSchema,
				sidebarWidth: z.number().min(20).max(45).default(32),
				sidebarPosition: z.enum(["left", "right"]).default("left"),
				columnGap: z.number().min(0).max(40).default(18),
				pagePadding: z.number().min(16).max(64).default(32),
				pageGrid: z
					.object({
						gap: z.number().min(0).max(40).default(18),
						regions: z.array(templatePageRegionSchema).min(1).max(4),
					})
					.strict()
					.optional(),
			})
			.strict(),
		tokens: z
			.object({
				primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
				textColor: z.string().regex(/^#[0-9a-f]{6}$/i),
				backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
				sidebarColor: z
					.string()
					.regex(/^#[0-9a-f]{6}$/i)
					.default("#f3f6f8"),
				headingColor: z
					.string()
					.regex(/^#[0-9a-f]{6}$/i)
					.optional(),
				headingFont: z.enum(["Inter", "IBM Plex Serif", "Lora"]),
				bodyFont: z.enum(["Inter", "IBM Plex Serif", "Lora"]),
				bodySize: z.number().min(8).max(14),
				sectionGap: z.number().min(8).max(32),
				itemGap: z.number().min(2).max(20),
				radius: z.number().min(0).max(24),
			})
			.strict(),
		nodes: z.array(templateNodeSchema).min(1).max(48),
		page: z
			.object({
				root: templateComposerPageNodeSchema
					.refine(
						(value): value is TemplateComposerPageLayoutNode => value.type === "layout",
						"Page root must be a layout node.",
					)
					.transform((value) => value as TemplateComposerPageLayoutNode),
			})
			.strict()
			.optional(),
	})
	.strict()
	.superRefine((value, context) => {
		const ids = new Set<string>();
		const pageRegionIds = new Set(value.layout.pageGrid?.regions.map((region) => region.id) ?? []);
		if (value.layout.preset === "grid" && !value.layout.pageGrid) {
			context.addIssue({
				code: "custom",
				path: ["layout", "pageGrid"],
				message: "Grid templates require pageGrid regions.",
			});
		}
		if (value.layout.pageGrid) {
			const widthTotal = value.layout.pageGrid.regions.reduce((total, region) => total + region.width, 0);
			if (widthTotal < 95 || widthTotal > 105) {
				context.addIssue({
					code: "custom",
					path: ["layout", "pageGrid", "regions"],
					message: "Page grid region widths must total approximately 100%.",
				});
			}
			const seenRegions = new Set<string>();
			for (const [index, region] of value.layout.pageGrid.regions.entries()) {
				if (seenRegions.has(region.id)) {
					context.addIssue({
						code: "custom",
						path: ["layout", "pageGrid", "regions", index, "id"],
						message: "Page grid region IDs must be unique.",
					});
				}
				seenRegions.add(region.id);
			}
		}

		for (const [index, node] of value.nodes.entries()) {
			if (ids.has(node.id)) {
				context.addIssue({ code: "custom", path: ["nodes", index, "id"], message: "Node IDs must be unique." });
			}
			ids.add(node.id);

			if (value.layout.preset === "one-column" && "column" in node && (node.region ?? node.column) !== "main") {
				context.addIssue({
					code: "custom",
					path: ["nodes", index, "region"],
					message: "One-column templates can only contain nodes in the main region.",
				});
			}
			if (value.layout.preset === "grid" && "column" in node && !pageRegionIds.has(node.region ?? node.column)) {
				context.addIssue({
					code: "custom",
					path: ["nodes", index, "region"],
					message: "Flow node region must reference a pageGrid region.",
				});
			}
		}

		if (value.page) {
			const treeIds = new Set<string>();
			const slotNodeIds = new Set<string>();
			const flowNodeIds = new Set(value.nodes.flatMap((node) => (node.type === "shape" ? [] : [node.id])));
			const visit = (node: TemplateComposerPageNode, path: (string | number)[]) => {
				if (treeIds.has(node.id)) {
					context.addIssue({ code: "custom", path: [...path, "id"], message: "Composer IDs must be unique." });
				}
				treeIds.add(node.id);
				if (node.type === "slot") {
					if (!flowNodeIds.has(node.nodeId)) {
						context.addIssue({
							code: "custom",
							path: [...path, "nodeId"],
							message: "Page slots must reference an existing flow node.",
						});
					}
					if (slotNodeIds.has(node.nodeId)) {
						context.addIssue({
							code: "custom",
							path: [...path, "nodeId"],
							message: "A flow node can only be placed in one page slot.",
						});
					}
					slotNodeIds.add(node.nodeId);
					return;
				}
				node.children.forEach((child, index) => {
					visit(child, [...path, "children", index]);
				});
			};
			visit(value.page.root, ["page", "root"]);
			for (const nodeId of flowNodeIds) {
				if (!slotNodeIds.has(nodeId)) {
					context.addIssue({
						code: "custom",
						path: ["page", "root"],
						message: `Flow node ${nodeId} must be placed in the page composition tree.`,
					});
				}
			}
		}

		for (const [index, node] of value.nodes.entries()) {
			if (node.type !== "section" || !node.body) continue;
			const bodyIds = new Set<string>();
			const visit = (entry: TemplateComposerContentNode, path: (string | number)[]) => {
				if (bodyIds.has(entry.id)) {
					context.addIssue({ code: "custom", path: [...path, "id"], message: "Section body IDs must be unique." });
				}
				bodyIds.add(entry.id);
				if (entry.type !== "block") {
					entry.children.forEach((child, childIndex) => {
						visit(child, [...path, "children", childIndex]);
					});
				}
			};
			visit(node.body.root, ["nodes", index, "body", "root"]);
		}
	})
	.transform((value) => {
		const nodes = value.nodes.map((node): z.infer<typeof templateNodeSchema> => {
			if (node.type !== "section") return node;
			const body = node.body ?? createDefaultSectionBody(node);
			return {
				...node,
				body: {
					...body,
					root: migrateComposerTableBlocks(body.root),
				},
			};
		});
		return {
			...value,
			schemaVersion: "0.2" as const,
			nodes,
			page: value.page ?? createPageComposition(nodes, value.layout),
		};
	});

export type TemplateLifecycleStatus = z.infer<typeof templateLifecycleStatusSchema>;
export type TemplateLayoutPreset = z.infer<typeof templateLayoutPresetSchema>;
export type TemplateSectionKind = z.infer<typeof templateSectionKindSchema>;
export type TemplateSectionNode = z.infer<typeof templateSectionNodeSchema>;
export type TemplatePageRegion = z.infer<typeof templatePageRegionSchema>;
export type TemplateSectionItemLayout = z.infer<typeof templateSectionItemLayoutSchema>;
export type TemplateSectionAppearance = z.infer<typeof templateSectionAppearanceSchema>;
export type TemplateHeaderNode = z.infer<typeof templateHeaderNodeSchema>;
export type TemplateDividerNode = z.infer<typeof templateDividerNodeSchema>;
export type TemplateSpacerNode = z.infer<typeof templateSpacerNodeSchema>;
export type TemplateShapeNode = z.infer<typeof templateShapeNodeSchema>;
export type TemplateNode = z.infer<typeof templateNodeSchema>;
export type TemplateFlowNode = Exclude<TemplateNode, TemplateShapeNode>;
export type TemplateAst = z.infer<typeof templateAstSchema>;
export type TemplateSectionBody = z.infer<typeof templateSectionBodySchema>;

export const templateCompilerReportSchema = z
	.object({
		sourceFormat: z.enum(["pdf", "docx"]),
		confidence: z.number().min(0).max(1),
		confidenceBreakdown: z
			.object({
				semantic: z.number().min(0).max(1),
				layout: z.number().min(0).max(1),
				typography: z.number().min(0).max(1),
				extraction: z.number().min(0).max(1),
			})
			.strict()
			.default({ semantic: 0, layout: 0, typography: 0, extraction: 0 }),
		visualFidelity: z.number().min(0).max(1).default(0.5),
		pageCount: z.number().int().positive(),
		detectedLayout: templateLayoutPresetSchema,
		detectedSections: z.array(templateSectionKindSchema),
		warnings: z.array(z.string()),
		mappingSummary: z
			.object({
				supported: z.array(z.string()),
				approximated: z.array(z.string()),
				unsupported: z.array(z.string()),
			})
			.strict()
			.default({ supported: [], approximated: [], unsupported: [] }),
		manualReviewRequired: z.boolean().default(true),
		generatedAt: z.string().datetime(),
	})
	.strict();

export type TemplateCompilerReport = z.infer<typeof templateCompilerReportSchema>;

export const customTemplateSnapshotSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1).max(120),
		version: z.number().int().positive(),
		ast: templateAstSchema,
	})
	.strict();

export type CustomTemplateSnapshot = z.infer<typeof customTemplateSnapshotSchema>;

export const defaultTemplateAst: TemplateAst = templateAstSchema.parse({
	schemaVersion: "0.2",
	layout: { preset: "two-column", sidebarWidth: 32, sidebarPosition: "left", columnGap: 18, pagePadding: 32 },
	tokens: {
		primaryColor: "#173b57",
		textColor: "#101828",
		backgroundColor: "#ffffff",
		sidebarColor: "#f3f6f8",
		headingFont: "IBM Plex Serif",
		bodyFont: "Inter",
		bodySize: 10,
		sectionGap: 18,
		itemGap: 8,
		radius: 6,
	},
	nodes: [
		{
			id: "header",
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
		},
		{
			id: "summary",
			type: "section",
			section: "summary",
			column: "main",
			variant: "standard",
			visible: true,
			breakBefore: false,
			breakAfter: false,
			keepWithNext: true,
			breakInside: "avoid",
			minPresenceAhead: 32,
			repeatOnPage: false,
			overflow: "split",
		},
		{
			id: "skills",
			type: "section",
			section: "skills",
			column: "sidebar",
			variant: "tags",
			visible: true,
			breakBefore: false,
			breakAfter: false,
			keepWithNext: true,
			breakInside: "avoid",
			minPresenceAhead: 24,
			repeatOnPage: false,
			overflow: "split",
		},
		{
			id: "experience",
			type: "section",
			section: "experience",
			column: "main",
			variant: "timeline",
			visible: true,
			breakBefore: false,
			breakAfter: false,
			keepWithNext: true,
			breakInside: "avoid",
			minPresenceAhead: 32,
			repeatOnPage: false,
			overflow: "split",
		},
		{
			id: "education",
			type: "section",
			section: "education",
			column: "sidebar",
			variant: "compact",
			visible: true,
			breakBefore: false,
			breakAfter: false,
			keepWithNext: true,
			breakInside: "avoid",
			minPresenceAhead: 24,
			repeatOnPage: false,
			overflow: "split",
		},
	],
});
