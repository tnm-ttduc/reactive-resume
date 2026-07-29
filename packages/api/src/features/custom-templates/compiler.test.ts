import { describe, expect, it } from "vitest";
import { templateAstSchema, templateCompilerReportSchema } from "@reactive-resume/schema/template-ast";
import { compileCustomTemplate, detectPdfProjectTables, detectPdfSectionItemTables } from "./compiler";

function createStoredZip(entryName: string, contents: string) {
	const name = Buffer.from(entryName);
	const data = Buffer.from(contents);
	const local = Buffer.alloc(30);
	local.writeUInt32LE(0x04034b50, 0);
	local.writeUInt16LE(20, 4);
	local.writeUInt32LE(0, 14);
	local.writeUInt32LE(data.length, 18);
	local.writeUInt32LE(data.length, 22);
	local.writeUInt16LE(name.length, 26);

	const central = Buffer.alloc(46);
	central.writeUInt32LE(0x02014b50, 0);
	central.writeUInt16LE(20, 4);
	central.writeUInt16LE(20, 6);
	central.writeUInt32LE(0, 16);
	central.writeUInt32LE(data.length, 20);
	central.writeUInt32LE(data.length, 24);
	central.writeUInt16LE(name.length, 28);
	central.writeUInt32LE(0, 42);

	const directoryOffset = local.length + name.length + data.length;
	const directorySize = central.length + name.length;
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0);
	eocd.writeUInt16LE(1, 8);
	eocd.writeUInt16LE(1, 10);
	eocd.writeUInt32LE(directorySize, 12);
	eocd.writeUInt32LE(directoryOffset, 16);

	return Buffer.concat([local, name, data, central, name, eocd]);
}

describe("compileCustomTemplate", () => {
	it("detects repeated project key-value cards from aligned PDF geometry", () => {
		const heading = { text: "D. PROJECTS", x: 0.11, y: 700, fontSize: 14, page: 1 };
		const items = [
			heading,
			{ text: "Project 1: MTJS", x: 0.11, y: 660, fontSize: 12, page: 1 },
			{ text: "Duration: 02/2025 - Present", x: 0.11, y: 648, fontSize: 11, page: 1 },
			{ text: "Description", x: 0.11, y: 620, fontSize: 10, page: 1 },
			{ text: "Medical e-learning platform", x: 0.27, y: 620, fontSize: 10, page: 1 },
			{ text: "Team size", x: 0.11, y: 590, fontSize: 10, page: 1 },
			{ text: "12", x: 0.27, y: 590, fontSize: 10, page: 1 },
			{ text: "Tech stack", x: 0.11, y: 560, fontSize: 10, page: 1 },
			{ text: "Ruby", x: 0.27, y: 560, fontSize: 10, page: 1 },
			{ text: "Position", x: 0.11, y: 530, fontSize: 10, page: 1 },
			{ text: "BrSE", x: 0.27, y: 530, fontSize: 10, page: 1 },
			{ text: "Responsibility", x: 0.11, y: 500, fontSize: 10, page: 1 },
			{ text: "Requirements analysis", x: 0.27, y: 500, fontSize: 10, page: 1 },
			{ text: "Project 2: EDM", x: 0.11, y: 700, fontSize: 12, page: 2 },
			{ text: "Description", x: 0.11, y: 660, fontSize: 10, page: 2 },
			{ text: "School platform", x: 0.27, y: 660, fontSize: 10, page: 2 },
			{ text: "Team size", x: 0.11, y: 630, fontSize: 10, page: 2 },
			{ text: "5", x: 0.27, y: 630, fontSize: 10, page: 2 },
			{ text: "Tech stack", x: 0.11, y: 600, fontSize: 10, page: 2 },
			{ text: "PHP", x: 0.27, y: 600, fontSize: 10, page: 2 },
		];

		const tables = detectPdfProjectTables(heading, items, [heading]);

		expect(tables).toHaveLength(1);
		expect(tables[0]).toMatchObject({
			mode: "section-items",
			orientation: "key-value",
			headerVisible: false,
			sourceRowCount: 2,
		});
		expect(tables[0]?.columns.map((column) => column.label)).toEqual([
			"Description",
			"Team size",
			"Tech stack",
			"Position",
			"Responsibility",
		]);
	});

	it("detects repeated experience cards with full-width and paired key-value rows", () => {
		const heading = { text: "PROFESSIONAL EXPERIENCE", x: 0.095, y: 708.4, fontSize: 14.1, page: 2 };
		const items = [
			heading,
			{ text: "MINI CONCERT BOOKING APP", x: 0.095, y: 656.9, fontSize: 11.1, page: 2 },
			{ text: "03/2026 – Present", x: 0.749, y: 656.9, fontSize: 11.1, page: 2 },
			{ text: "OBJECTIVES & DESCRIPTION", x: 0.095, y: 635, fontSize: 9, page: 2 },
			{ text: "Position: Software Engineer", x: 0.095, y: 576, fontSize: 11.1, page: 2 },
			{ text: "Team size: Large-scale", x: 0.513, y: 576, fontSize: 11.1, page: 2 },
			{ text: "RESPONSIBILITY", x: 0.095, y: 555.2, fontSize: 9, page: 2 },
			{ text: "TECHNOLOGY", x: 0.095, y: 460, fontSize: 9, page: 2 },
			{ text: "HUE GENERAL LIBRARY WEBSITE", x: 0.095, y: 387.9, fontSize: 11.1, page: 2 },
			{ text: "03/2026 – 05/2026", x: 0.748, y: 387.9, fontSize: 11.1, page: 2 },
			{ text: "OBJECTIVES & DESCRIPTION", x: 0.095, y: 365.9, fontSize: 9, page: 2 },
			{ text: "Position: Software Engineer", x: 0.095, y: 307, fontSize: 11.1, page: 2 },
			{ text: "Team size: 9", x: 0.513, y: 307, fontSize: 11.1, page: 2 },
			{ text: "RESPONSIBILITY", x: 0.095, y: 286, fontSize: 9, page: 2 },
			{ text: "TECHNOLOGY", x: 0.095, y: 190.9, fontSize: 9, page: 2 },
		];

		const tables = detectPdfSectionItemTables(heading, "experience", items, [heading]);

		expect(tables).toHaveLength(1);
		expect(tables[0]).toMatchObject({
			mode: "section-items",
			orientation: "key-value",
			headerVisible: false,
			sourceRowCount: 2,
			fieldRows: [["description"], ["position", "team-size"], ["responsibility"], ["technology"]],
		});
		expect(tables[0]?.columns.map((column) => column.label)).toEqual([
			"OBJECTIVES & DESCRIPTION",
			"Position",
			"Team size",
			"RESPONSIBILITY",
			"TECHNOLOGY",
		]);
		expect(tables[0]?.columns.map((column) => column.binding)).toEqual([
			"item.description",
			"item.primary",
			"item.experience",
			"item.value",
			"item.keywords",
		]);
	});

	it("compiles a DOCX document into a safe, review-required AST", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>PROFESSIONAL EXPERIENCE</w:t></w:r></w:p>
				<w:p><w:r><w:t>Skills</w:t></w:r></w:p>
				<w:sectPr><w:cols w:num="2"/></w:sectPr>
				<w:rPr><w:color w:val="173B57"/><w:sz w:val="20"/></w:rPr>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		expect(templateAstSchema.safeParse(result.ast).success).toBe(true);
		expect(templateCompilerReportSchema.safeParse(result.report).success).toBe(true);
		expect(result.ast.layout.preset).toBe("two-column");
		expect(result.ast.nodes.some((node) => node.type === "header")).toBe(true);
		expect(result.report.detectedSections).toEqual(["experience", "skills"]);
		expect(result.report.confidenceBreakdown.layout).toBeGreaterThan(0.9);
		expect(result.report.visualFidelity).toBeGreaterThan(0.65);
		expect(result.report.mappingSummary.supported).toContain("Semantic section: experience");
		expect(result.report.mappingSummary.unsupported.length).toBeGreaterThan(0);
		expect(result.report.manualReviewRequired).toBe(true);
	});

	it("recognizes prefixed and compound headings without treating every table as a page column", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>A. PERSONAL INFORMATION</w:t></w:r></w:p>
				<w:p><w:r><w:t>B. EDUCATION &amp; CERTIFICATES</w:t></w:r></w:p>
				<w:p><w:r><w:t>C. SKILLS</w:t></w:r></w:p>
				<w:p><w:r><w:t>D. PROJECTS</w:t></w:r></w:p>
				<w:tbl><w:tblGrid><w:gridCol w:w="1935"/><w:gridCol w:w="7470"/></w:tblGrid></w:tbl>
				<w:sectPr><w:cols w:num="1"/></w:sectPr>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		expect(result.ast.layout.preset).toBe("one-column");
		expect(result.report.detectedSections).toEqual(["profiles", "education", "certifications", "skills", "projects"]);
		expect(result.report.confidenceBreakdown.semantic).toBeGreaterThan(0.9);
		expect(result.report.confidence).toBeGreaterThan(0.75);
	});

	it("imports visual sidebar tokens and section placement from a DOCX layout table", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:tbl>
					<w:tblGrid><w:gridCol w:w="5149"/><w:gridCol w:w="6825"/></w:tblGrid>
					<w:tr>
						<w:tc><w:tcPr><w:shd w:fill="B3C2D1"/></w:tcPr><w:p><w:r><w:t>Skills</w:t></w:r></w:p></w:tc>
						<w:tc>
							<w:p><w:r><w:t>Highlights</w:t></w:r></w:p>
							<w:p><w:r><w:t>Experience</w:t></w:r></w:p>
						</w:tc>
					</w:tr>
				</w:tbl>
				<w:sectPr><w:cols w:num="1"/><w:pgMar w:left="720"/></w:sectPr>
				<w:rPr><w:color w:val="466EB6"/><w:sz w:val="22"/></w:rPr>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		expect(result.ast.layout).toMatchObject({
			preset: "two-column",
			sidebarPosition: "left",
			sidebarWidth: 43,
			pagePadding: 36,
		});
		expect(result.ast.tokens).toMatchObject({ primaryColor: "#466eb6", sidebarColor: "#b3c2d1" });
		expect(result.ast.nodes.find((node) => node.type === "header")?.column).toBe("sidebar");
		const skillsNode = result.ast.nodes.find((node) => node.type === "section" && node.section === "skills");
		const experienceNode = result.ast.nodes.find((node) => node.type === "section" && node.section === "experience");
		expect(skillsNode?.type === "section" ? skillsNode.column : undefined).toBe("sidebar");
		expect(experienceNode?.type === "section" ? experienceNode.column : undefined).toBe("main");
		expect(result.report.visualFidelity).toBeGreaterThan(0.7);
	});

	it("maps grouped skill fields and numbered experience items from parser evidence", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>Skills</w:t></w:r></w:p>
				<w:p><w:r><w:t>Programming Languages: Java, JavaScript, TypeScript, C/C++</w:t></w:r></w:p>
				<w:p><w:r><w:t>Frameworks: Spring Boot, React, Next.js</w:t></w:r></w:p>
				<w:p><w:r><w:t>Databases: PostgreSQL, SQLite, MongoDB</w:t></w:r></w:p>
				<w:p><w:r><w:t>Other: Docker, Git, JWT, RESTful API</w:t></w:r></w:p>
				<w:p><w:r><w:t>Experience</w:t></w:r></w:p>
				<w:p><w:r><w:t>1. SOFTWARE ENGINEER | 03/2026 – Present</w:t></w:r></w:p>
				<w:p><w:r><w:t>Developed backend and frontend features.</w:t></w:r></w:p>
				<w:p><w:r><w:t>2. SOFTWARE ENGINEER | 03/2026 – 05/2026</w:t></w:r></w:p>
				<w:p><w:r><w:t>Developed and maintained RESTful APIs.</w:t></w:r></w:p>
				<w:p><w:r><w:t>Dự án cá nhân</w:t></w:r></w:p>
				<w:p><w:r><w:t>1. Website quản lý và đặt dịch vụ du lịch</w:t></w:r></w:p>
				<w:p><w:r><w:t>Mô tả: Nền tảng quản lý booking.</w:t></w:r></w:p>
				<w:p><w:r><w:t>Công nghệ: Flutter, Spring Boot, SQL Server</w:t></w:r></w:p>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		const skills = result.ast.nodes.find((node) => node.type === "section" && node.section === "skills");
		const experience = result.ast.nodes.find((node) => node.type === "section" && node.section === "experience");
		const projects = result.ast.nodes.find((node) => node.type === "section" && node.section === "projects");
		expect(skills?.type === "section" ? skills.variant : undefined).toBe("bullets");
		expect(skills?.type === "section" ? skills.body?.component : undefined).toBe("list");
		expect(skills?.type === "section" ? skills.itemLayout : undefined).toMatchObject({ columns: 1, rowGap: 6 });
		const skillRepeat =
			skills?.type === "section" ? skills.body?.root.children.find((entry) => entry.type === "repeat") : undefined;
		expect(skillRepeat).toMatchObject({ label: "Skill group", itemMarker: "none" });
		expect(experience?.type === "section" ? experience.variant : undefined).toBe("standard");
		expect(experience?.type === "section" ? experience.itemLayout : undefined).toMatchObject({
			columns: 1,
			rowGap: 10,
		});
		const experienceRepeat =
			experience?.type === "section"
				? experience.body?.root.children.find((entry) => entry.type === "repeat")
				: undefined;
		expect(experienceRepeat).toMatchObject({ label: "Experience item", itemMarker: "number" });
		const projectRepeat =
			projects?.type === "section" ? projects.body?.root.children.find((entry) => entry.type === "repeat") : undefined;
		expect(projectRepeat).toMatchObject({ label: "Project item", itemMarker: "number" });
		expect(
			experienceRepeat?.type === "repeat"
				? experienceRepeat.children
						.flatMap((entry) => (entry.type === "layout" ? entry.children : []))
						.some((entry) => entry.type === "block" && entry.component === "list")
				: false,
		).toBe(true);
		expect(result.report.mappingSummary.supported).toContain(
			"Parsed presentation: skills → grouped-fields (4 evidence lines)",
		);
		expect(result.report.mappingSummary.supported).toContain(
			"Parsed presentation: experience → numbered-items (2 evidence lines)",
		);
		expect(result.report.mappingSummary.supported).toContain(
			"Parsed presentation: projects → numbered-items (3 evidence lines)",
		);
		expect(result.report.mappingSummary.supported).not.toContain("Section grid: skills → 2 columns");
		expect(templateAstSchema.safeParse(result.ast).success).toBe(true);
	});

	it("preserves Tenomad-style source headings, section variants and page breaks", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>Year of Birth: 2004</w:t></w:r></w:p>
				<w:p><w:r><w:t>Gender: Male</w:t></w:r></w:p>
				<w:p><w:r><w:t>Location: Hue, Vietnam</w:t></w:r></w:p>
				<w:p><w:r><w:t>PROFESSIONAL SUMMARY</w:t></w:r></w:p>
				<w:p><w:r><w:t>Technical Skills:</w:t></w:r></w:p>
				<w:p><w:r><w:t>Soft Skills:</w:t></w:r></w:p>
				<w:p><w:r><w:t>Languages:</w:t></w:r></w:p>
				<w:p><w:r><w:t>TECHNICAL EXPERTISE &amp; SKILLS</w:t></w:r></w:p>
				<w:p><w:r><w:lastRenderedPageBreak/><w:t>PROFESSIONAL EXPERIENCE</w:t></w:r></w:p>
				<w:p><w:r><w:lastRenderedPageBreak/><w:t>EDUCATION</w:t></w:r></w:p>
				<w:sectPr><w:cols w:num="1"/></w:sectPr>
				<w:rPr><w:color w:val="FEB806"/><w:sz w:val="22"/></w:rPr>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		const sections = result.ast.nodes.filter((node) => node.type === "section");
		expect(sections.map((node) => node.title)).toEqual([
			"PROFESSIONAL SUMMARY",
			"Technical Skills:",
			"Soft Skills:",
			"Languages:",
			"TECHNICAL EXPERTISE & SKILLS",
			"PROFESSIONAL EXPERIENCE",
			"EDUCATION",
		]);
		expect(sections.filter((node) => node.section === "skills")).toHaveLength(3);
		expect(sections.find((node) => node.title === "TECHNICAL EXPERTISE & SKILLS")?.variant).toBe("table");
		expect(sections.find((node) => node.title === "PROFESSIONAL EXPERIENCE")?.variant).toBe("boxed");
		expect(sections.find((node) => node.title === "PROFESSIONAL EXPERIENCE")?.breakBefore).toBe(true);
		expect(sections.find((node) => node.title === "EDUCATION")?.breakBefore).toBe(true);
		expect(result.ast.nodes.find((node) => node.type === "header")?.variant).toBe("split");
		expect(result.ast.tokens.headingColor).toBeDefined();
		expect(result.report.pageCount).toBe(3);
	});

	it("keeps structural confidence low when a document has no recognizable structure", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>Unstructured text only</w:t></w:r></w:p>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		expect(result.report.detectedSections).toEqual([]);
		expect(result.report.confidenceBreakdown.semantic).toBeLessThan(0.2);
		expect(result.report.confidence).toBeLessThan(0.55);
	});

	it("does not confuse decorative micro-grids with a two-column page", async () => {
		const grid = `<w:tbl><w:tblGrid><w:gridCol w:w="100"/><w:gridCol w:w="100"/></w:tblGrid></w:tbl>`;
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>PROFESSIONAL SUMMARY</w:t></w:r></w:p>
				${grid}${grid}${grid}
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		expect(result.ast.layout.preset).toBe("one-column");
	});

	it("separates a section-local grid from the whole-page layout", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>PROFESSIONAL SUMMARY</w:t></w:r></w:p>
				<w:tbl>
					<w:tblGrid><w:gridCol w:w="400"/><w:gridCol w:w="400"/></w:tblGrid>
					<w:tr><w:tc><w:p><w:r><w:t>SKILLS</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Tools</w:t></w:r></w:p></w:tc></w:tr>
				</w:tbl>
				<w:sectPr><w:cols w:num="1"/></w:sectPr>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		expect(result.ast.layout.preset).toBe("one-column");
		const skills = result.ast.nodes.find((node) => node.type === "section" && node.section === "skills");
		expect(skills?.type === "section" ? skills.itemLayout?.columns : undefined).toBe(2);
		expect(result.report.mappingSummary.supported).toContain("Section grid: skills → 2 columns");
	});

	it("creates a bounded page grid for explicit multi-column DOCX sections", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>SUMMARY</w:t></w:r></w:p>
				<w:p><w:r><w:t>SKILLS</w:t></w:r></w:p>
				<w:sectPr><w:cols w:num="3"/></w:sectPr>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		});

		expect(result.ast.layout.preset).toBe("grid");
		expect(result.ast.layout.pageGrid?.regions).toHaveLength(3);
		expect(result.ast.layout.pageGrid?.regions.reduce((total, region) => total + region.width, 0)).toBeCloseTo(100);
		expect(templateAstSchema.safeParse(result.ast).success).toBe(true);
	});

	it("reconciles AI Vision presentation suggestions without overriding parser sections or order", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>PROFESSIONAL EXPERIENCE</w:t></w:r></w:p>
				<w:p><w:r><w:t>SKILLS</w:t></w:r></w:p>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			visionBlueprint: {
				version: "0.1",
				analysisMode: "visual",
				page: {
					preset: "two-column",
					sidebarWidth: 30,
					sidebarPosition: "left",
					pagePadding: 24,
					gap: 14,
					regions: [
						{ id: "sidebar", width: 30, padding: 8, backgroundColor: "#eeeeee" },
						{ id: "main", width: 70, padding: 0 },
					],
				},
				header: { region: "main", variant: "split", showPicture: false, showContact: true },
				tokens: { primaryColor: "#feb806", radius: 4 },
				sections: [
					{
						section: "skills",
						sourceTitle: "TECHNICAL SKILLS",
						region: "sidebar",
						order: 0,
						layout: {
							component: "tags",
							columns: 2,
							columnGap: 6,
							rowGap: 6,
							heading: "filled",
						},
						blocks: [
							{ component: "heading", binding: "section.title", variant: "accent", visible: true },
							{ component: "badge", binding: "item.primary", variant: "pill", visible: true },
						],
						confidence: 0.95,
						evidence: ["Skill pills appear in a shaded rail."],
					},
					{
						section: "experience",
						sourceTitle: "PROFESSIONAL EXPERIENCE",
						region: "main",
						order: 1,
						layout: {
							component: "timeline",
							columns: 1,
							columnGap: 8,
							rowGap: 10,
							heading: "underline",
						},
						blocks: [
							{ component: "heading", binding: "section.title", variant: "accent", visible: true },
							{ component: "text", binding: "item.primary", variant: "strong", visible: true },
							{ component: "meta", binding: "item.meta", variant: "muted", visible: true },
							{ component: "rich-text", binding: "item.description", variant: "plain", visible: true },
						],
						confidence: 0.94,
						evidence: ["Experience uses a vertical timeline."],
					},
					{
						section: "awards",
						sourceTitle: "AWARDS",
						region: "main",
						order: 2,
						layout: {
							component: "cards",
							columns: 1,
							columnGap: 8,
							rowGap: 8,
							heading: "filled",
						},
						blocks: [
							{ component: "heading", binding: "section.title", variant: "accent", visible: true },
							{ component: "text", binding: "item.primary", variant: "strong", visible: true },
						],
						confidence: 0.99,
						evidence: ["AI inferred an awards card."],
					},
				],
				overallConfidence: 0.94,
				warnings: [],
			},
		});

		expect(result.ast.schemaVersion).toBe("0.2");
		expect(result.ast.tokens.primaryColor).toBe("#feb806");
		expect(result.ast.nodes.filter((node) => node.type === "section").map((node) => node.section)).toEqual([
			"experience",
			"skills",
		]);
		expect(result.ast.layout.preset).toBe("one-column");
		// Semantic confidence remains deterministic; Vision only affects presentation fidelity.
		expect(result.report.confidence).toBe(0.562);
		const skills = result.ast.nodes.find((node) => node.type === "section" && node.section === "skills");
		expect(skills?.type === "section" ? skills.body?.component : undefined).toBe("tags");
		expect(skills?.type === "section" ? skills.body?.root.children[1]?.type : undefined).toBe("repeat");
		const experience = result.ast.nodes.find((node) => node.type === "section" && node.section === "experience");
		expect(experience?.type === "section" ? experience.body?.root.children.length : 0).toBeGreaterThan(1);
		expect(result.report.mappingSummary.supported).toContain(
			"AI Vision suggestions reconciled against parser evidence: visual",
		);
		expect(result.report.mappingSummary.approximated).toContain("Rejected AI-only section/layout suggestion: AWARDS");
		expect(result.report.warnings).toContain("AI Vision suggested two-column, but parser mapping retained one-column.");
		expect(templateAstSchema.safeParse(result.ast).success).toBe(true);
	});

	it("uses high-confidence AI evidence to preserve project key-value cards", async () => {
		const documentXml = `
			<w:document xmlns:w="urn:test"><w:body>
				<w:p><w:r><w:t>D. PROJECTS</w:t></w:r></w:p>
			</w:body></w:document>`;
		const data = createStoredZip("word/document.xml", documentXml);
		const result = await compileCustomTemplate({
			data,
			mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			visionBlueprint: {
				version: "0.1",
				analysisMode: "visual",
				page: {
					preset: "one-column",
					sidebarWidth: 32,
					sidebarPosition: "left",
					pagePadding: 32,
					gap: 18,
					regions: [{ id: "main", width: 100, padding: 0 }],
				},
				header: { region: "main", variant: "standard", showPicture: false, showContact: true },
				tokens: {},
				sections: [
					{
						section: "projects",
						sourceTitle: "D. PROJECTS",
						region: "main",
						order: 0,
						layout: {
							component: "table",
							columns: 1,
							columnGap: 0,
							rowGap: 12,
							heading: "underline",
						},
						blocks: [
							{ component: "heading", binding: "section.title", variant: "accent", visible: true },
							{ component: "table", binding: "section.content", variant: "plain", visible: true },
						],
						dataModel: {
							kind: "tabular-records",
							itemLabel: "Project",
							numbered: true,
							fields: [],
						},
						tables: [
							{
								kind: "section-items",
								orientation: "key-value-cards",
								columns: [
									{ label: "Description", role: "description", confidence: 0.96 },
									{ label: "Team size", role: "experience", confidence: 0.93 },
									{ label: "Tech stack", role: "keywords", confidence: 0.95 },
									{ label: "Position", role: "secondary", confidence: 0.92 },
									{ label: "Responsibility", role: "reference", confidence: 0.94 },
								],
								confidence: 0.96,
								evidence: ["Repeated bordered Project N cards with aligned label/value rows."],
							},
						],
						confidence: 0.96,
						evidence: ["Project cards repeat with the same five row labels."],
					},
				],
				overallConfidence: 0.96,
				warnings: [],
			},
		});

		const projects = result.ast.nodes.find((node) => node.type === "section" && node.section === "projects");
		expect(projects?.type === "section" ? projects.variant : undefined).toBe("boxed");
		expect(projects?.type === "section" ? projects.body?.component : undefined).toBe("cards");
		const repeat =
			projects?.type === "section" ? projects.body?.root.children.find((entry) => entry.type === "repeat") : undefined;
		expect(repeat).toMatchObject({ label: "Project table card", itemMarker: "none" });
		const card = repeat?.type === "repeat" ? repeat.children.find((entry) => entry.type === "layout") : undefined;
		const table =
			card?.type === "layout"
				? card.children.find((entry) => entry.type === "layout" && entry.component === "table")
				: undefined;
		const rows =
			table?.type === "layout"
				? table.children.filter((entry) => entry.type === "layout" && entry.component === "table-row")
				: [];
		expect(rows).toHaveLength(5);
		expect(
			rows.map((row) =>
				row.type === "layout"
					? row.children
							.filter((entry) => entry.type === "layout" && entry.component === "table-cell")
							.map((cell) => (cell.type === "layout" ? cell.children[0] : undefined))
					: [],
			),
		).toMatchObject([
			[{ literal: "Description" }, { binding: "item.description" }],
			[{ literal: "Team size" }, { binding: "item.experience" }],
			[{ literal: "Tech stack" }, { binding: "item.keywords" }],
			[{ literal: "Position" }, { binding: "item.secondary" }],
			[{ literal: "Responsibility" }, { binding: "item.value" }],
		]);
		expect(templateAstSchema.safeParse(result.ast).success).toBe(true);
	});

	it("rejects malformed DOCX archives", async () => {
		await expect(
			compileCustomTemplate({
				data: new Uint8Array([1, 2, 3]),
				mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}),
		).rejects.toThrow("Invalid DOCX archive");
	});
});
