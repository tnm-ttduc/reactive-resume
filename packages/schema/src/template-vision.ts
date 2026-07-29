import z from "zod";
import {
	templateComposerBindingSchema,
	templateComposerBlockComponentSchema,
	templateComposerBlockVariantSchema,
	templateLayoutPresetSchema,
	templateSectionKindSchema,
} from "./template-ast";

const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

export const templateVisionSectionSchema = z
	.object({
		section: templateSectionKindSchema,
		sourceTitle: z.string().trim().min(1).max(120).optional(),
		region: z.string().trim().min(1).max(40).default("main"),
		order: z.number().int().min(0).max(47),
		layout: z
			.object({
				component: z.enum(["flow", "timeline", "cards", "tags", "table", "list"]),
				columns: z.number().int().min(1).max(6).default(1),
				columnGap: z.number().min(0).max(32).default(8),
				rowGap: z.number().min(0).max(32).default(8),
				heading: z.enum(["underline", "plain", "filled", "badge", "hidden"]).default("underline"),
			})
			.strict(),
		blocks: z
			.array(
				z
					.object({
						component: templateComposerBlockComponentSchema,
						binding: templateComposerBindingSchema,
						variant: templateComposerBlockVariantSchema.default("plain"),
						visible: z.boolean().default(true),
					})
					.strict(),
			)
			.min(1)
			.max(12),
		dataModel: z
			.object({
				kind: z.enum(["single-content", "repeated-records", "grouped-fields", "tabular-records", "static-reference"]),
				itemLabel: z.string().trim().min(1).max(80).optional(),
				numbered: z.boolean().default(false),
				fields: z
					.array(
						z
							.object({
								label: z.string().trim().min(1).max(80),
								role: z.enum([
									"primary",
									"secondary",
									"meta",
									"description",
									"keywords",
									"level",
									"experience",
									"last-used",
									"reference",
								]),
								binding: templateComposerBindingSchema.optional(),
								dynamic: z.boolean(),
								confidence: z.number().min(0).max(1),
							})
							.strict(),
					)
					.max(16)
					.default([]),
			})
			.strict()
			.optional(),
		tables: z
			.array(
				z
					.object({
						title: z.string().trim().min(1).max(120).optional(),
						kind: z.enum(["static-reference", "section-items"]),
						orientation: z.enum(["horizontal-records", "key-value-cards"]).default("horizontal-records"),
						columnCount: z.number().int().min(1).max(8).optional(),
						rowCount: z.number().int().min(1).max(48).optional(),
						recordCount: z.number().int().min(0).max(48).optional(),
						columns: z
							.array(
								z
									.object({
										label: z.string().trim().min(1).max(80),
										role: z.enum([
											"primary",
											"secondary",
											"meta",
											"description",
											"keywords",
											"level",
											"experience",
											"last-used",
											"reference",
										]),
										binding: templateComposerBindingSchema.optional(),
										confidence: z.number().min(0).max(1),
									})
									.strict(),
							)
							.min(1)
							.max(8),
						confidence: z.number().min(0).max(1),
						evidence: z.array(z.string().trim().min(1).max(240)).max(6).default([]),
					})
					.strict(),
			)
			.max(4)
			.optional(),
		confidence: z.number().min(0).max(1),
		evidence: z.array(z.string().trim().min(1).max(240)).max(6).default([]),
	})
	.strict();

export const templateVisionBlueprintSchema = z
	.object({
		version: z.literal("0.1"),
		analysisMode: z.enum(["visual", "structural"]),
		page: z
			.object({
				preset: templateLayoutPresetSchema,
				sidebarWidth: z.number().min(20).max(45).default(32),
				sidebarPosition: z.enum(["left", "right"]).default("left"),
				pagePadding: z.number().min(16).max(64).default(32),
				gap: z.number().min(0).max(40).default(18),
				regions: z
					.array(
						z
							.object({
								id: z.string().trim().min(1).max(40),
								width: z.number().min(10).max(100),
								padding: z.number().min(0).max(32).default(0),
								backgroundColor: hexColorSchema.optional(),
							})
							.strict(),
					)
					.min(1)
					.max(4),
			})
			.strict(),
		header: z
			.object({
				region: z.string().trim().min(1).max(40).default("main"),
				variant: z.enum(["standard", "compact", "sidebar", "split"]).default("standard"),
				showPicture: z.boolean().default(false),
				showContact: z.boolean().default(true),
			})
			.strict(),
		tokens: z
			.object({
				primaryColor: hexColorSchema.optional(),
				textColor: hexColorSchema.optional(),
				backgroundColor: hexColorSchema.optional(),
				sidebarColor: hexColorSchema.optional(),
				headingColor: hexColorSchema.optional(),
				headingFont: z.enum(["Inter", "IBM Plex Serif", "Lora"]).optional(),
				bodyFont: z.enum(["Inter", "IBM Plex Serif", "Lora"]).optional(),
				bodySize: z.number().min(8).max(14).optional(),
				sectionGap: z.number().min(8).max(32).optional(),
				itemGap: z.number().min(2).max(20).optional(),
				radius: z.number().min(0).max(24).optional(),
			})
			.strict(),
		sections: z.array(templateVisionSectionSchema).min(1).max(48),
		overallConfidence: z.number().min(0).max(1),
		warnings: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
	})
	.strict()
	.superRefine((value, context) => {
		const regionIds = new Set<string>();
		let totalWidth = 0;
		for (const [index, region] of value.page.regions.entries()) {
			if (regionIds.has(region.id)) {
				context.addIssue({
					code: "custom",
					path: ["page", "regions", index, "id"],
					message: "Vision region IDs must be unique.",
				});
			}
			regionIds.add(region.id);
			totalWidth += region.width;
		}
		if (totalWidth < 95 || totalWidth > 105) {
			context.addIssue({
				code: "custom",
				path: ["page", "regions"],
				message: "Vision region widths must total approximately 100%.",
			});
		}
		if (!regionIds.has(value.header.region)) {
			context.addIssue({
				code: "custom",
				path: ["header", "region"],
				message: "Header region must reference a page region.",
			});
		}
		for (const [index, section] of value.sections.entries()) {
			if (!regionIds.has(section.region)) {
				context.addIssue({
					code: "custom",
					path: ["sections", index, "region"],
					message: "Section region must reference a page region.",
				});
			}
		}
	});

export type TemplateVisionBlueprint = z.infer<typeof templateVisionBlueprintSchema>;
