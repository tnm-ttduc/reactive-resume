import { describe, expect, it } from "vitest";
import { defaultTemplateAst, templateAstSchema, templateSectionComponentRegistry } from "./template-ast";

describe("templateAstSchema", () => {
	it("accepts the safe default AST", () => {
		expect(templateAstSchema.parse(defaultTemplateAst)).toEqual(defaultTemplateAst);
	});

	it("uses the configured gap when composing a two-column page", () => {
		const result = templateAstSchema.parse({
			...defaultTemplateAst,
			layout: { ...defaultTemplateAst.layout, columnGap: 24 },
			page: undefined,
		});

		expect(result.page.root.props.gap).toBe(24);
	});

	it("rejects duplicate node IDs", () => {
		const result = templateAstSchema.safeParse({
			...defaultTemplateAst,
			nodes: [defaultTemplateAst.nodes[0], defaultTemplateAst.nodes[0]],
		});

		expect(result.success).toBe(false);
	});

	it("rejects sidebar nodes in a one-column layout", () => {
		const result = templateAstSchema.safeParse({
			...defaultTemplateAst,
			layout: { ...defaultTemplateAst.layout, preset: "one-column" },
		});

		expect(result.success).toBe(false);
	});

	it("rejects unknown or executable node properties", () => {
		const result = templateAstSchema.safeParse({
			...defaultTemplateAst,
			nodes: [{ ...defaultTemplateAst.nodes[0], expression: "process.env.SECRET" }],
		});

		expect(result.success).toBe(false);
	});

	it("supports safe flow and visual decoration nodes", () => {
		const result = templateAstSchema.safeParse({
			...defaultTemplateAst,
			nodes: [
				...defaultTemplateAst.nodes,
				{
					id: "accent",
					type: "shape",
					visible: true,
					shape: "rectangle",
					x: 0,
					y: 0,
					width: 120,
					height: 24,
					color: "#173b57",
					opacity: 0.2,
					rotation: 0,
					radius: 4,
					zIndex: -1,
					repeatOnPage: true,
				},
				{
					id: "gap",
					type: "spacer",
					column: "main",
					height: 12,
				},
			],
			page: undefined,
		});

		expect(result.success).toBe(true);
	});

	it("supports independent page regions and per-section item grids", () => {
		const result = templateAstSchema.safeParse({
			...defaultTemplateAst,
			layout: {
				...defaultTemplateAst.layout,
				preset: "grid",
				pageGrid: {
					gap: 16,
					regions: [
						{ id: "rail", width: 28, padding: 8, backgroundColor: "#f3f6f8" },
						{ id: "content", width: 72, padding: 0 },
					],
				},
			},
			nodes: defaultTemplateAst.nodes.map((node) =>
				node.type === "shape"
					? node
					: {
							...node,
							region: node.column === "sidebar" ? "rail" : "content",
							...(node.type === "section"
								? {
										itemLayout: { columns: 2, columnGap: 12, rowGap: 8 },
										appearance: { heading: "filled", itemHeader: "inline", itemDecoration: "card" },
									}
								: {}),
						},
			),
			page: undefined,
		});

		expect(result.success).toBe(true);
	});

	it("rejects unknown page regions and unsafe grid totals", () => {
		const result = templateAstSchema.safeParse({
			...defaultTemplateAst,
			layout: {
				...defaultTemplateAst.layout,
				preset: "grid",
				pageGrid: { gap: 16, regions: [{ id: "content", width: 70, padding: 0 }] },
			},
			nodes: defaultTemplateAst.nodes.map((node) =>
				node.type === "shape" ? node : { ...node, region: "missing-region" },
			),
		});

		expect(result.success).toBe(false);
	});

	it("enforces section variants through the component registry", () => {
		const invalid = {
			...defaultTemplateAst,
			nodes: defaultTemplateAst.nodes.map((node) =>
				node.type === "section" && node.section === "summary" ? { ...node, variant: "table" as const } : node,
			),
		};

		expect(templateAstSchema.safeParse(invalid).success).toBe(false);
		expect(templateSectionComponentRegistry.skills.supportedVariants).toContain("table");
		expect(templateSectionComponentRegistry.summary.rendererCompatibility).toEqual(["html-preview", "react-pdf"]);
	});

	it("adds safe pagination defaults when parsing older section nodes", () => {
		const section = defaultTemplateAst.nodes.find((node) => node.type === "section");
		expect(section).toBeDefined();
		if (!section) return;
		const {
			breakBefore: _breakBefore,
			breakAfter: _breakAfter,
			minPresenceAhead: _minPresenceAhead,
			repeatOnPage: _repeatOnPage,
			overflow: _overflow,
			...legacySection
		} = section;
		const parsed = templateAstSchema.parse({ ...defaultTemplateAst, nodes: [legacySection], page: undefined });
		const parsedSection = parsed.nodes[0];

		expect(parsedSection?.type).toBe("section");
		if (parsedSection?.type === "section") {
			expect(parsedSection.breakBefore).toBe(false);
			expect(parsedSection.overflow).toBe("split");
		}
	});

	it("builds canonical page and section composer trees", () => {
		expect(defaultTemplateAst.schemaVersion).toBe("0.2");
		expect(defaultTemplateAst.page.root.type).toBe("layout");
		const slotIds: string[] = [];
		const visitPage = (entry: (typeof defaultTemplateAst.page.root.children)[number]) => {
			if (entry.type === "slot") slotIds.push(entry.nodeId);
			else entry.children.forEach(visitPage);
		};
		defaultTemplateAst.page.root.children.forEach(visitPage);
		expect(slotIds).toEqual(expect.arrayContaining(defaultTemplateAst.nodes.map((node) => node.id)));
		for (const node of defaultTemplateAst.nodes) {
			if (node.type !== "section") continue;
			expect(node.body?.root.type).toBe("layout");
			expect(node.body?.root.children.length).toBeGreaterThan(0);
		}
	});

	it("supports labeled repeat groups with bounded item markers and dynamic field blocks", () => {
		const draft = structuredClone(defaultTemplateAst);
		const experience = draft.nodes.find((node) => node.type === "section" && node.section === "experience");
		expect(experience?.type).toBe("section");
		if (experience?.type !== "section" || !experience.body) return;
		const repeat = experience.body.root.children.find((entry) => entry.type === "repeat");
		expect(repeat?.type).toBe("repeat");
		if (repeat?.type !== "repeat") return;
		repeat.label = "Experience item";
		repeat.itemMarker = "number";

		const parsed = templateAstSchema.parse(draft);
		const parsedExperience = parsed.nodes.find((node) => node.type === "section" && node.section === "experience");
		const parsedRepeat =
			parsedExperience?.type === "section"
				? parsedExperience.body?.root.children.find((entry) => entry.type === "repeat")
				: undefined;
		expect(parsedRepeat).toMatchObject({
			type: "repeat",
			label: "Experience item",
			itemMarker: "number",
			binding: "section.items",
		});
	});

	it("supports separate static reference and dynamic section-item tables", () => {
		const draft = structuredClone(defaultTemplateAst);
		const skills = draft.nodes.find((node) => node.type === "section" && node.section === "skills");
		expect(skills?.type).toBe("section");
		if (skills?.type !== "section" || !skills.body) return;
		skills.body.component = "table";
		skills.body.root.children = [
			{
				id: "skills-heading",
				type: "block",
				component: "heading",
				binding: "section.title",
				variant: "accent",
				visible: true,
			},
			{
				id: "skills-tables",
				type: "layout",
				component: "columns",
				props: { gap: 8 },
				children: [
					{
						id: "proficiency-reference",
						type: "block",
						component: "table",
						binding: "section.content",
						variant: "plain",
						visible: true,
						table: {
							mode: "static",
							orientation: "horizontal",
							columns: [
								{ id: "level", label: "Lv", width: 20, align: "center" },
								{ id: "description", label: "Description", width: 80, align: "left" },
							],
							rows: [["1", "Basic knowledge"]],
							headerVisible: true,
						},
					},
					{
						id: "technology-skills",
						type: "block",
						component: "table",
						binding: "section.content",
						variant: "plain",
						visible: true,
						table: {
							mode: "section-items",
							orientation: "key-value",
							columns: [
								{ id: "skill", label: "Skill", binding: "item.primary", width: 60, align: "left" },
								{
									id: "last-used",
									label: "Last used",
									binding: "item.lastUsed",
									width: 40,
									align: "center",
								},
							],
							rows: [],
							headerVisible: true,
						},
					},
				],
			},
		];

		const parsed = templateAstSchema.parse(draft);
		const parsedSkills = parsed.nodes.find((node) => node.type === "section" && node.section === "skills");
		const columnsLayout =
			parsedSkills?.type === "section"
				? parsedSkills.body?.root.children.find((entry) => entry.type === "layout" && entry.component === "columns")
				: undefined;
		const tableLayouts =
			columnsLayout?.type === "layout"
				? columnsLayout.children.filter((entry) => entry.type === "layout" && entry.component === "table")
				: [];
		expect(tableLayouts).toHaveLength(2);
		expect(
			tableLayouts?.flatMap((table) =>
				table.type === "layout"
					? table.children.filter((entry) => entry.type === "layout" && entry.component === "table-row")
					: [],
			),
		).toHaveLength(4);
	});

	it("rejects executable composer properties and dangling page slots", () => {
		const executable = {
			...defaultTemplateAst,
			page: {
				root: {
					...defaultTemplateAst.page.root,
					onRender: "process.env.SECRET",
				},
			},
		};
		expect(templateAstSchema.safeParse(executable).success).toBe(false);

		const dangling = structuredClone(defaultTemplateAst);
		dangling.page.root.children = [{ id: "bad-slot", type: "slot", nodeId: "missing-node" }];
		expect(templateAstSchema.safeParse(dangling).success).toBe(false);
	});
});
