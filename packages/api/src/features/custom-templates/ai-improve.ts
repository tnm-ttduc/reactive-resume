import type { TemplateAst, TemplateCompilerReport } from "@reactive-resume/schema/template-ast";
import { ORPCError } from "@orpc/client";
import { templateAstSchema } from "@reactive-resume/schema/template-ast";
import { compileCustomTemplate } from "./compiler";
import { analyzeTemplateSourceWithAiVision } from "./vision";

const layoutKeys = ["preset", "sidebarWidth", "sidebarPosition", "pagePadding", "pageGrid"] as const;
const tokenKeys = [
	"primaryColor",
	"textColor",
	"backgroundColor",
	"sidebarColor",
	"headingColor",
	"headingFont",
	"bodyFont",
	"bodySize",
	"sectionGap",
	"itemGap",
	"radius",
] as const;

type TemplateSourceMediaType =
	| "application/pdf"
	| "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type AiImproveSource = {
	name: string;
	data: Uint8Array;
	mediaType: TemplateSourceMediaType;
};

type AiImprovePreview = {
	data: Uint8Array;
	mediaType: "image/png" | "image/jpeg";
};

export type AiTemplateChange = {
	path: string;
	before: string | null;
	after: string | null;
	reason: string;
};

export type AiImproveResult = {
	draft: TemplateAst;
	analysisMode: "visual" | "structural";
	summary: string;
	changes: AiTemplateChange[];
	remainingLimitations: string[];
};

type ImproveTemplateAstWithAiInput = {
	userId: string;
	draft: TemplateAst;
	report: TemplateCompilerReport | null;
	source: AiImproveSource;
	preview?: AiImprovePreview;
	sourceCompilation?: Awaited<ReturnType<typeof compileCustomTemplate>>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function extractJsonObject(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
	const candidate = fenced?.[1] ?? text;
	const start = candidate.indexOf("{");
	const end = candidate.lastIndexOf("}");

	if (start === -1 || end === -1 || end < start) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "The AI response did not contain a template.",
		});
	}

	try {
		return JSON.parse(candidate.slice(start, end + 1)) as unknown;
	} catch {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "The AI returned invalid JSON. No changes were applied.",
		});
	}
}

function tryTemplateCandidate(candidate: unknown, fallback: TemplateAst): TemplateAst {
	const result = templateAstSchema.safeParse(candidate);
	return result.success ? result.data : fallback;
}

function applyCandidateValue(ast: TemplateAst, path: readonly (string | number)[], value: unknown): TemplateAst {
	const candidate = structuredClone(ast) as unknown;
	let cursor = candidate as Record<string | number, unknown>;

	for (const segment of path.slice(0, -1)) {
		const next = cursor[segment];
		if (typeof next !== "object" || next === null) return ast;
		cursor = next as Record<string | number, unknown>;
	}

	const last = path.at(-1);
	if (last === undefined) return ast;
	cursor[last] = value;
	return tryTemplateCandidate(candidate, ast);
}

function salvageValidTemplateChanges(candidate: Record<string, unknown>, fallback: TemplateAst): TemplateAst {
	let improved = fallback;
	const layout = asRecord(candidate.layout);
	const tokens = asRecord(candidate.tokens);

	for (const key of layoutKeys) {
		if (layout && key in layout) improved = applyCandidateValue(improved, ["layout", key], layout[key]);
	}

	for (const key of tokenKeys) {
		if (tokens && key in tokens) improved = applyCandidateValue(improved, ["tokens", key], tokens[key]);
	}

	if (!Array.isArray(candidate.nodes)) return improved;

	for (const proposedNode of candidate.nodes) {
		const proposed = asRecord(proposedNode);
		if (!proposed || typeof proposed.id !== "string" || typeof proposed.type !== "string") continue;
		const nodeIndex = improved.nodes.findIndex((node) => node.id === proposed.id && node.type === proposed.type);
		const existing = improved.nodes[nodeIndex];
		if (nodeIndex < 0 || !existing) continue;

		for (const key of Object.keys(proposed)) {
			if (key === "id" || key === "type") continue;
			improved = applyCandidateValue(improved, ["nodes", nodeIndex, key], proposed[key]);
		}
	}

	if ("page" in candidate) improved = applyCandidateValue(improved, ["page"], candidate.page);

	return improved;
}

export function parseAiImprovedTemplateAst(text: string, fallback?: TemplateAst): TemplateAst {
	const parsed = extractJsonObject(text);
	const envelope = asRecord(parsed);
	const candidate = envelope && "improvedAst" in envelope ? envelope.improvedAst : parsed;
	const result = templateAstSchema.safeParse(candidate);
	if (result.success) return result.data;
	const record = asRecord(candidate);
	if (fallback && record) return salvageValidTemplateChanges(record, fallback);
	throw new ORPCError("INTERNAL_SERVER_ERROR", {
		message: "The AI returned an invalid template. No changes were applied.",
	});
}

function truncate(value: string, max = 500) {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function displayValue(value: unknown): string | null {
	if (value === undefined) return null;
	if (typeof value === "string") return truncate(value);
	const serialized = JSON.stringify(value);
	return truncate(serialized ?? String(value));
}

function defaultReason(path: string) {
	if (path.startsWith("layout.")) return "Align the page and column layout with the selected source file.";
	if (path.startsWith("tokens.")) return "Match the source file's visual styling more closely.";
	if (path.startsWith("nodes[")) return "Match the source file's section structure, ordering, or presentation.";
	return "Improve fidelity to the selected source file.";
}

export function diffTemplateAst(
	before: TemplateAst,
	after: TemplateAst,
	reasons = new Map<string, string>(),
): AiTemplateChange[] {
	const changes: AiTemplateChange[] = [];
	const add = (path: string, previous: unknown, next: unknown) => {
		if (changes.length >= 30 || JSON.stringify(previous) === JSON.stringify(next)) return;
		changes.push({
			path,
			before: displayValue(previous),
			after: displayValue(next),
			reason: reasons.get(path) ?? defaultReason(path),
		});
	};

	for (const key of layoutKeys) add(`layout.${key}`, before.layout[key], after.layout[key]);
	for (const key of tokenKeys) add(`tokens.${key}`, before.tokens[key], after.tokens[key]);
	add("page", before.page, after.page);

	const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
	const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
	before.nodes.forEach((node, index) => {
		if (!afterNodes.has(node.id)) add(`nodes[${node.id}]`, node, undefined);
		const nextIndex = after.nodes.findIndex((candidate) => candidate.id === node.id);
		if (nextIndex >= 0 && nextIndex !== index) add(`nodes[${node.id}].order`, index, nextIndex);
	});
	after.nodes.forEach((node) => {
		const previous = beforeNodes.get(node.id);
		if (!previous) {
			add(`nodes[${node.id}]`, undefined, node);
			return;
		}
		const previousRecord = previous as unknown as Record<string, unknown>;
		const nextRecord = node as unknown as Record<string, unknown>;
		for (const key of new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)])) {
			if (key === "id" || key === "type") continue;
			add(`nodes[${node.id}].${key}`, previousRecord[key], nextRecord[key]);
		}
	});

	return changes;
}

export async function improveTemplateAstWithAi(input: ImproveTemplateAstWithAiInput): Promise<AiImproveResult> {
	const visionBlueprint = await analyzeTemplateSourceWithAiVision({
		userId: input.userId,
		source: input.source,
	});
	const sourceCompilation = await compileCustomTemplate({
		data: input.source.data,
		mediaType: input.source.mediaType,
		visionBlueprint,
	});
	const draft = sourceCompilation.ast;
	const changes = diffTemplateAst(input.draft, draft);
	const remainingLimitations = [
		...sourceCompilation.report.mappingSummary.unsupported,
		...sourceCompilation.report.warnings,
		...(!visionBlueprint
			? [
					"AI Vision was unavailable or timed out. Parse + Mapping still produced this proposal through deterministic source extraction.",
				]
			: []),
	];

	return {
		draft,
		analysisMode: visionBlueprint?.analysisMode ?? "structural",
		summary: visionBlueprint
			? `AI Vision supplied ${visionBlueprint.sections.length} evidence-backed section suggestion${
					visionBlueprint.sections.length === 1 ? "" : "s"
				}; Parse + Mapping produced the final template.`
			: "Parse + Mapping rebuilt the template from the stored source without relying on AI-generated AST.",
		changes,
		remainingLimitations: [...new Set(remainingLimitations)].slice(0, 12),
	};
}
