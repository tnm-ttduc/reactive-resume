import { describe, expect, it } from "vitest";
import { templateVisionBlueprintSchema } from "./template-vision";

const blueprint = {
	version: "0.1",
	analysisMode: "visual",
	page: {
		preset: "two-column",
		sidebarWidth: 32,
		sidebarPosition: "left",
		pagePadding: 32,
		gap: 18,
		regions: [
			{ id: "sidebar", width: 32, padding: 8, backgroundColor: "#f3f6f8" },
			{ id: "main", width: 68, padding: 0 },
		],
	},
	header: { region: "main", variant: "split", showPicture: false, showContact: true },
	tokens: { primaryColor: "#feb806", bodySize: 10 },
	sections: [
		{
			section: "experience",
			sourceTitle: "PROFESSIONAL EXPERIENCE",
			region: "main",
			order: 0,
			layout: {
				component: "timeline",
				columns: 1,
				columnGap: 8,
				rowGap: 8,
				heading: "underline",
			},
			blocks: [
				{ component: "heading", binding: "section.title", variant: "accent", visible: true },
				{ component: "text", binding: "item.primary", variant: "strong", visible: true },
				{ component: "rich-text", binding: "item.description", variant: "plain", visible: true },
			],
			confidence: 0.92,
			evidence: ["Experience heading and vertical divider are visible."],
		},
	],
	overallConfidence: 0.9,
	warnings: [],
};

describe("templateVisionBlueprintSchema", () => {
	it("accepts a bounded visual blueprint", () => {
		expect(templateVisionBlueprintSchema.parse(blueprint)).toMatchObject({
			analysisMode: "visual",
			page: { preset: "two-column" },
			sections: [{ layout: { component: "timeline" } }],
		});
	});

	it("rejects dangling regions and arbitrary components", () => {
		expect(
			templateVisionBlueprintSchema.safeParse({
				...blueprint,
				sections: [{ ...blueprint.sections[0], region: "missing" }],
			}).success,
		).toBe(false);
		expect(
			templateVisionBlueprintSchema.safeParse({
				...blueprint,
				sections: [
					{
						...blueprint.sections[0],
						blocks: [{ component: "script", binding: "item.primary", variant: "plain", visible: true }],
					},
				],
			}).success,
		).toBe(false);
	});

	it("captures semantic record fields and table roles without storing candidate rows", () => {
		const [sourceSection] = blueprint.sections;
		expect(sourceSection).toBeDefined();
		if (!sourceSection) return;
		const result = templateVisionBlueprintSchema.parse({
			...blueprint,
			sections: [
				{
					...sourceSection,
					section: "skills",
					sourceTitle: "TECHNICAL EXPERTISE & SKILLS",
					layout: { ...sourceSection.layout, component: "table", columns: 2 },
					dataModel: {
						kind: "tabular-records",
						itemLabel: "Technology skill",
						numbered: false,
						fields: [
							{
								label: "Skill",
								role: "primary",
								binding: "item.primary",
								dynamic: true,
								confidence: 0.96,
							},
						],
					},
					tables: [
						{
							title: "Technology skill",
							kind: "section-items",
							columns: [
								{
									label: "Last used",
									role: "last-used",
									binding: "item.lastUsed",
									confidence: 0.94,
								},
							],
							confidence: 0.94,
							evidence: ["A ruled header and repeated year column are visible."],
						},
					],
				},
			],
		});

		expect(result.sections[0]?.tables?.[0]).toMatchObject({
			kind: "section-items",
			columns: [{ binding: "item.lastUsed" }],
		});
	});
});
