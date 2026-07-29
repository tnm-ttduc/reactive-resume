import type {
	TemplateAst,
	TemplateCompilerReport,
	TemplateComposerContentNode,
	TemplateComposerPageNode,
	TemplateFlowNode,
	TemplateNode,
	TemplatePageRegion,
	TemplateSectionKind,
	TemplateSectionNode,
	TemplateShapeNode,
} from "@reactive-resume/schema/template-ast";
import type {
	CSSProperties,
	DragEvent as ReactDragEvent,
	MouseEvent as ReactMouseEvent,
	ReactNode,
	RefObject,
} from "react";
import { Trans } from "@lingui/react/macro";
import {
	ArrowDownIcon,
	ArrowLeftIcon,
	ArrowUpIcon,
	CheckCircleIcon,
	FloppyDiskIcon,
	PlusIcon,
	SparkleIcon,
	SpinnerGapIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import {
	createComposerTableLayout,
	templateAstSchema,
	templateNodeSchema,
	templateSectionComponentRegistry,
	templateSectionKindSchema,
} from "@reactive-resume/schema/template-ast";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@reactive-resume/ui/components/card";
import { Checkbox } from "@reactive-resume/ui/components/checkbox";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { generateId } from "@reactive-resume/utils/string";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/libs/orpc/client";

export const Route = createFileRoute("/dashboard/templates/$templateId")({ component: RouteComponent });

const sectionLabels: Record<TemplateSectionKind, string> = {
	summary: "Summary",
	profiles: "Profiles",
	experience: "Experience",
	education: "Education",
	projects: "Projects",
	skills: "Skills",
	languages: "Languages",
	certifications: "Certifications",
	interests: "Interests",
	awards: "Awards",
	publications: "Publications",
	volunteer: "Volunteer",
	references: "References",
};

const nodeTypeLabels: Record<TemplateNode["type"], string> = {
	header: "Profile header",
	section: "Section",
	divider: "Divider",
	spacer: "Spacer",
	shape: "Visual shape",
};

const sectionVariantLabels: Record<TemplateSectionNode["variant"], string> = {
	standard: "Standard",
	compact: "Compact",
	timeline: "Timeline",
	tags: "Tags",
	bullets: "Bullet list",
	table: "Table",
	boxed: "Boxed cards",
};

function isFlowNode(node: TemplateNode): node is TemplateFlowNode {
	return node.type !== "shape";
}

function nodeLabel(node: TemplateNode) {
	return node.type === "section" ? (node.title ?? sectionLabels[node.section]) : nodeTypeLabels[node.type];
}

type TemplateComposerBlock = Extract<TemplateComposerContentNode, { type: "block" }>;
type TemplateComposerRepeat = Extract<TemplateComposerContentNode, { type: "repeat" }>;
type TemplateComposerLayout = Extract<TemplateComposerContentNode, { type: "layout" }>;
type ComposerItemKind =
	| "text"
	| "rich-text"
	| "heading"
	| "list"
	| "meta"
	| "badge"
	| "table"
	| "layout-stack"
	| "layout-row"
	| "layout-columns"
	| "layout-grid"
	| "layout-box"
	| "repeat";
type PreviewSelection = {
	nodeId: string | null;
	contentId: string | null;
};
type TemplateDragItem = { kind: "node"; nodeId: string } | { kind: "content"; nodeId: string; contentId: string };
type TemplateDropTarget = TemplateDragItem & { position: "before" | "after" };

const composerItemLabels: Record<ComposerItemKind, string> = {
	text: "Text",
	"rich-text": "Rich text",
	heading: "Heading",
	list: "List",
	meta: "Metadata",
	badge: "Badge",
	table: "Table",
	"layout-stack": "Stack layout",
	"layout-row": "Row layout",
	"layout-columns": "Columns layout",
	"layout-grid": "Grid layout",
	"layout-box": "Box layout",
	repeat: "Repeated content",
};

const composerItemKinds = Object.keys(composerItemLabels) as ComposerItemKind[];

function isSameDragItem(left: TemplateDragItem | null, right: TemplateDragItem) {
	if (!left || left.kind !== right.kind || left.nodeId !== right.nodeId) return false;
	return left.kind === "node" || left.contentId === (right as Extract<TemplateDragItem, { kind: "content" }>).contentId;
}

function dragPosition(event: ReactDragEvent<HTMLElement>) {
	const bounds = event.currentTarget.getBoundingClientRect();
	return event.clientY < bounds.top + bounds.height / 2 ? ("before" as const) : ("after" as const);
}

function dropIndicatorClass(dropTarget: TemplateDropTarget | null, item: TemplateDragItem) {
	if (!dropTarget || !isSameDragItem(dropTarget, item)) return "";
	return dropTarget.position === "before" ? "border-t-2 border-t-primary" : "border-b-2 border-b-primary";
}

function collectComposerBlocks(entry: TemplateComposerContentNode): TemplateComposerBlock[] {
	if (entry.type === "block") return [entry];
	return entry.children.flatMap(collectComposerBlocks);
}

function findComposerBlock(entry: TemplateComposerContentNode, blockId: string): TemplateComposerBlock | null {
	if (entry.type === "block") return entry.id === blockId ? entry : null;
	for (const child of entry.children) {
		const match = findComposerBlock(child, blockId);
		if (match) return match;
	}
	return null;
}

function findComposerRepeat(entry: TemplateComposerContentNode, repeatId: string): TemplateComposerRepeat | null {
	if (entry.type === "repeat") {
		if (entry.id === repeatId) return entry;
	}
	if (entry.type === "block") return null;
	for (const child of entry.children) {
		const match = findComposerRepeat(child, repeatId);
		if (match) return match;
	}
	return null;
}

function findComposerLayout(entry: TemplateComposerContentNode, layoutId: string): TemplateComposerLayout | null {
	if (entry.type === "layout" && entry.id === layoutId) return entry;
	if (entry.type === "block") return null;
	for (const child of entry.children) {
		const match = findComposerLayout(child, layoutId);
		if (match) return match;
	}
	return null;
}

function composerBlockLabel(block: TemplateComposerBlock) {
	if (block.binding === "literal") {
		const value = block.literal?.trim() || "Empty";
		return `${block.component} · “${value.slice(0, 28)}${value.length > 28 ? "…" : ""}”`;
	}
	return `${block.component} · ${block.binding}`;
}

type ComposerTreeBranchProps = {
	entry: TemplateComposerContentNode;
	nodeId: string;
	isRoot?: boolean;
	selectedBlockId: string | null;
	selectedRepeatId: string | null;
	selectedLayoutId: string | null;
	draggedItem: TemplateDragItem | null;
	dropTarget: TemplateDropTarget | null;
	onSelectBlock: (nodeId: string, blockId: string) => void;
	onSelectRepeat: (nodeId: string, repeatId: string) => void;
	onSelectLayout: (nodeId: string, layoutId: string) => void;
	onDragStart: (event: ReactDragEvent<HTMLElement>, item: TemplateDragItem) => void;
	onDragOver: (event: ReactDragEvent<HTMLElement>, item: TemplateDragItem) => void;
	onDrop: (event: ReactDragEvent<HTMLElement>, item: TemplateDragItem) => void;
	onDragEnd: () => void;
};

function ComposerTreeBranch(props: ComposerTreeBranchProps) {
	const {
		entry,
		nodeId,
		isRoot = false,
		selectedBlockId,
		selectedRepeatId,
		selectedLayoutId,
		draggedItem,
		dropTarget,
		onSelectBlock,
		onSelectRepeat,
		onSelectLayout,
		onDragStart,
		onDragOver,
		onDrop,
		onDragEnd,
	} = props;
	const dragItem = { kind: "content", nodeId, contentId: entry.id } as const;
	const draggable = !isRoot;
	const dragClass = draggable
		? `${dropIndicatorClass(dropTarget, dragItem)} ${isSameDragItem(draggedItem, dragItem) ? "opacity-40" : ""}`
		: "";
	if (entry.type === "block") {
		const selected = selectedBlockId === entry.id;
		return (
			<fieldset
				draggable={draggable}
				data-template-surface="structure"
				data-template-drag-kind={draggable ? "content" : undefined}
				data-template-node-id={nodeId}
				data-template-content-id={entry.id}
				className={`m-0 min-w-0 border-0 p-0 ${dragClass}`}
				onDragStart={draggable ? (event) => onDragStart(event, dragItem) : undefined}
				onDragOver={draggable ? (event) => onDragOver(event, dragItem) : undefined}
				onDrop={draggable ? (event) => onDrop(event, dragItem) : undefined}
				onDragEnd={onDragEnd}
			>
				<button
					type="button"
					role="treeitem"
					aria-selected={selected}
					data-template-tree-selection-id={entry.id}
					className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs ${
						selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
					}`}
					onClick={() => onSelectBlock(nodeId, entry.id)}
				>
					<span aria-hidden="true" className="cursor-grab opacity-50">
						⋮⋮
					</span>
					<span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" />
					<span className="min-w-0 flex-1 truncate">{composerBlockLabel(entry)}</span>
				</button>
			</fieldset>
		);
	}

	const isRepeat = entry.type === "repeat";
	const selected = isRepeat ? selectedRepeatId === entry.id : selectedLayoutId === entry.id;
	const label = isRepeat
		? `${entry.label ?? "Repeated content"} · ${entry.itemMarker ?? "none"}`
		: entry.component === "table"
			? `Table layout · ${entry.children.filter((child) => child.type === "layout" && child.component === "table-row").length} rows`
			: entry.component === "table-row"
				? `Table row · ${entry.children.filter((child) => child.type === "layout" && child.component === "table-cell").length} cells`
				: entry.component === "table-cell"
					? `Table cell · ${entry.props.width ?? "auto"}%`
					: `Layout · ${entry.component}`;
	return (
		<fieldset
			draggable={draggable}
			data-template-surface="structure"
			data-template-drag-kind={draggable ? "content" : undefined}
			data-template-node-id={nodeId}
			data-template-content-id={entry.id}
			className={`m-0 min-w-0 border-0 p-0 ${dragClass}`}
			onDragStart={draggable ? (event) => onDragStart(event, dragItem) : undefined}
			onDragOver={draggable ? (event) => onDragOver(event, dragItem) : undefined}
			onDrop={draggable ? (event) => onDrop(event, dragItem) : undefined}
			onDragEnd={onDragEnd}
		>
			{isRepeat ? (
				<button
					type="button"
					role="treeitem"
					aria-expanded="true"
					aria-selected={selected}
					data-template-tree-selection-id={entry.id}
					className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start font-medium text-xs ${
						selected ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted"
					}`}
					onClick={() => onSelectRepeat(nodeId, entry.id)}
				>
					<span aria-hidden="true" className="cursor-grab opacity-50">
						⋮⋮
					</span>
					<span aria-hidden="true">↻</span>
					<span className="min-w-0 flex-1 truncate">{label}</span>
				</button>
			) : (
				<button
					type="button"
					role="treeitem"
					aria-expanded="true"
					aria-selected={selected}
					data-template-tree-selection-id={entry.id}
					className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-xs ${
						selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
					}`}
					onClick={() => onSelectLayout(nodeId, entry.id)}
				>
					<span aria-hidden="true" className="cursor-grab opacity-50">
						⋮⋮
					</span>
					<span aria-hidden="true">⌗</span>
					<span className="min-w-0 flex-1 truncate">{label}</span>
				</button>
			)}
			<div className="ml-3 space-y-0.5 border-l py-0.5 pl-2">
				{entry.children.map((child) => (
					<ComposerTreeBranch key={child.id} {...props} entry={child} isRoot={false} />
				))}
			</div>
		</fieldset>
	);
}

function mapComposerContent(
	entry: TemplateComposerContentNode,
	mapper: (block: TemplateComposerBlock) => TemplateComposerBlock,
): TemplateComposerContentNode {
	if (entry.type === "block") return mapper(entry);
	return { ...entry, children: entry.children.map((child) => mapComposerContent(child, mapper)) };
}

function mapComposerRepeats(
	entry: TemplateComposerContentNode,
	mapper: (repeat: TemplateComposerRepeat) => TemplateComposerRepeat,
): TemplateComposerContentNode {
	if (entry.type === "block") return entry;
	if (entry.type === "repeat") {
		const mapped = mapper(entry);
		return { ...mapped, children: mapped.children.map((child) => mapComposerRepeats(child, mapper)) };
	}
	return { ...entry, children: entry.children.map((child) => mapComposerRepeats(child, mapper)) };
}

function mapComposerLayouts(
	entry: TemplateComposerContentNode,
	mapper: (layout: TemplateComposerLayout) => TemplateComposerLayout,
): TemplateComposerContentNode {
	if (entry.type === "block") return entry;
	if (entry.type === "layout") {
		const mapped = mapper(entry);
		return { ...mapped, children: mapped.children.map((child) => mapComposerLayouts(child, mapper)) };
	}
	return { ...entry, children: entry.children.map((child) => mapComposerLayouts(child, mapper)) };
}

type MutableComposerParent = TemplateComposerLayout | TemplateComposerRepeat;

function findComposerEntry(
	entry: TemplateComposerContentNode,
	entryId: string,
	parent: MutableComposerParent | null = null,
): { entry: TemplateComposerContentNode; parent: MutableComposerParent | null; index: number } | null {
	if (entry.id === entryId) {
		return { entry, parent, index: parent?.children.findIndex((child) => child.id === entryId) ?? -1 };
	}
	if (entry.type === "block") return null;
	for (const child of entry.children) {
		const match = findComposerEntry(child, entryId, entry);
		if (match) return match;
	}
	return null;
}

function composerEntryContains(entry: TemplateComposerContentNode, entryId: string): boolean {
	if (entry.id === entryId) return true;
	return entry.type !== "block" && entry.children.some((child) => composerEntryContains(child, entryId));
}

function composerEntryIsInsideRepeat(
	entry: TemplateComposerContentNode,
	entryId: string,
	insideRepeat = false,
): boolean {
	if (entry.id === entryId) return insideRepeat || entry.type === "repeat";
	if (entry.type === "block") return false;
	return entry.children.some((child) =>
		composerEntryIsInsideRepeat(child, entryId, insideRepeat || entry.type === "repeat"),
	);
}

function createComposerItem(kind: ComposerItemKind, useItemBindings: boolean): TemplateComposerContentNode {
	const id = `content-${generateId()}`;
	const createTextBlock = (): TemplateComposerBlock => ({
		id: `${id}-text`,
		type: "block",
		component: "text",
		binding: useItemBindings ? "item.primary" : "section.content",
		variant: "plain",
		visible: true,
	});
	if (kind === "repeat") {
		return {
			id,
			type: "repeat",
			binding: "section.items",
			label: "Repeated content",
			itemMarker: "none",
			children: [
				{
					id: `${id}-item`,
					type: "block",
					component: "text",
					binding: "item.primary",
					variant: "plain",
					visible: true,
				},
			],
		};
	}
	if (kind.startsWith("layout-")) {
		const component = kind.slice("layout-".length) as TemplateComposerLayout["component"];
		return {
			id,
			type: "layout",
			component,
			props: {
				...(component === "row" || component === "columns" ? { direction: "horizontal" as const } : {}),
				...(component === "columns" || component === "grid" ? { columns: 2 } : {}),
				gap: 8,
			},
			children: [createTextBlock()],
		};
	}
	if (kind === "table") {
		return useItemBindings
			? createComposerTableLayout(id, {
					mode: "section-items",
					orientation: "key-value",
					columns: [
						{ id: "name", label: "Name", binding: "item.primary", width: 30, align: "left" },
						{ id: "details", label: "Details", binding: "item.description", width: 30, align: "left" },
					],
					rows: [],
					headerVisible: false,
				})
			: createComposerTableLayout(id, {
					mode: "static",
					orientation: "horizontal",
					columns: [
						{ id: "key", label: "Key", width: 35, align: "left" },
						{ id: "value", label: "Value", width: 65, align: "left" },
					],
					rows: [["New key", "New value"]],
					headerVisible: true,
				});
	}
	const binding =
		kind === "heading"
			? useItemBindings
				? "item.primary"
				: "section.title"
			: kind === "meta"
				? useItemBindings
					? "item.meta"
					: "section.content"
				: kind === "badge"
					? useItemBindings
						? "item.keywords"
						: "section.content"
					: useItemBindings
						? "item.description"
						: "section.content";
	return {
		id,
		type: "block",
		component: kind as TemplateComposerBlock["component"],
		binding,
		variant: kind === "heading" ? "accent" : kind === "meta" ? "muted" : kind === "badge" ? "pill" : "plain",
		visible: true,
	};
}

function insertComposerContent(
	root: TemplateComposerLayout,
	targetId: string | null,
	item: TemplateComposerContentNode,
): TemplateComposerLayout {
	const clonedRoot = structuredClone(root);
	if (!targetId || targetId === clonedRoot.id) {
		clonedRoot.children.push(item);
		return clonedRoot;
	}
	const target = findComposerEntry(clonedRoot, targetId);
	if (!target) return root;
	if (target.entry.type !== "block") {
		target.entry.children.push(item);
		return clonedRoot;
	}
	if (!target.parent) return root;
	target.parent.children.splice(target.index + 1, 0, item);
	return clonedRoot;
}

function removeComposerContent(root: TemplateComposerLayout, entryId: string): TemplateComposerLayout {
	const clonedRoot = structuredClone(root);
	const target = findComposerEntry(clonedRoot, entryId);
	if (!target?.parent || target.parent.children.length <= 1) return root;
	target.parent.children.splice(target.index, 1);
	return clonedRoot;
}

function reorderComposerContent(
	root: TemplateComposerLayout,
	sourceId: string,
	targetId: string,
	position: "before" | "after",
) {
	if (sourceId === targetId) return root;
	const clonedRoot = structuredClone(root);
	const source = findComposerEntry(clonedRoot, sourceId);
	const initialTarget = findComposerEntry(clonedRoot, targetId);
	if (!source?.parent || !initialTarget?.parent || composerEntryContains(source.entry, targetId)) return root;
	if (source.parent !== initialTarget.parent && source.parent.children.length <= 1) return root;

	const [movedEntry] = source.parent.children.splice(source.index, 1);
	if (!movedEntry) return root;
	const target = findComposerEntry(clonedRoot, targetId);
	if (!target?.parent) return root;
	target.parent.children.splice(target.index + (position === "after" ? 1 : 0), 0, movedEntry);
	return clonedRoot;
}

function recomposeTemplate(ast: TemplateAst, patch: Partial<Pick<TemplateAst, "layout" | "nodes">> = {}) {
	return templateAstSchema.parse({ ...ast, ...patch, page: undefined });
}

function plainText(value: string) {
	return value
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function listTextItems(value: string) {
	const htmlItems = [...value.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/giu)]
		.map((match) => plainText(match[1] ?? ""))
		.filter(Boolean);
	if (htmlItems.length > 0) return htmlItems;
	const lines = value
		.split(/\r?\n|(?:^|\s)[•▪◦➢✓]\s*/u)
		.map(plainText)
		.filter(Boolean);
	return lines.length > 0 ? lines : [plainText(value)].filter(Boolean);
}

type PreviewMode = "compact" | "standard" | "stress";

type AiImproveReview = {
	sourceName: string;
	analysisMode: "visual" | "structural";
	summary: string;
	changes: Array<{ path: string; before: string | null; after: string | null; reason: string }>;
	remainingLimitations: string[];
};

function isPdfSource(file: File) {
	return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatFileSize(size: number) {
	if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

type EditorSectionProps = {
	node: TemplateSectionNode;
	primaryColor: string;
	headingColor: string;
	mode: PreviewMode;
	selection: PreviewSelection;
	draggedItem: TemplateDragItem | null;
	dropTarget: TemplateDropTarget | null;
	onSelectTarget: (nodeId: string, contentId: string | null) => void;
};

type PreviewComposerItem = {
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

function previewRecordText(record: Record<string, unknown>, keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value;
	}
	return "";
}

function normalizePreviewComposerItem(
	value: unknown,
	section: TemplateSectionKind,
	index: number,
): PreviewComposerItem {
	const item = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
	const fields: Record<TemplateSectionKind, { primary: string[]; secondary: string[]; meta: string[] }> = {
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
	const mapping = fields[section];
	const primary = previewRecordText(item, mapping.primary);
	const secondary = previewRecordText(item, mapping.secondary);
	const meta = mapping.meta
		.map((key) => previewRecordText(item, [key]))
		.filter(Boolean)
		.join(" · ");
	const description = previewRecordText(item, ["description", "summary"]);
	const keywords = Array.isArray(item.keywords)
		? item.keywords.filter((entry): entry is string => typeof entry === "string").join(", ")
		: previewRecordText(item, ["keywords", "technologies", "technology", "techStack"]);
	return {
		id: previewRecordText(item, ["id"]) || `${section}-${index}`,
		primary,
		secondary,
		meta,
		description,
		keywords,
		value: previewRecordText(item, ["value", "responsibility", "responsibilities"]) || description,
		level: typeof item.level === "number" && item.level > 0 ? String(item.level) : previewRecordText(item, ["level"]),
		experience: previewRecordText(item, ["experience", "teamSize", "team"]),
		lastUsed: previewRecordText(item, ["lastUsed"]),
	};
}

function previewComposerBindingValue(item: PreviewComposerItem, binding: string | undefined) {
	if (!binding?.startsWith("item.")) return "";
	return String(item[binding.slice(5) as keyof PreviewComposerItem] ?? "");
}

type PreviewComposerContentProps = {
	entry: TemplateComposerContentNode;
	isRoot?: boolean;
	sectionTitle: string;
	sectionContent: string;
	items: PreviewComposerItem[];
	item?: PreviewComposerItem;
	node: TemplateSectionNode;
	primaryColor: string;
	headingColor: string;
	mode: PreviewMode;
	selection: PreviewSelection;
	draggedItem: TemplateDragItem | null;
	dropTarget: TemplateDropTarget | null;
	onSelectTarget: (nodeId: string, contentId: string | null) => void;
};

function PreviewComposerContent(props: PreviewComposerContentProps): ReactNode {
	const {
		entry,
		isRoot = false,
		sectionTitle,
		sectionContent,
		items,
		item,
		node,
		primaryColor,
		headingColor,
		mode,
		selection,
		draggedItem,
		dropTarget,
		onSelectTarget,
	} = props;
	const isSelected = selection.nodeId === node.id && selection.contentId === entry.id;
	const dragItem = { kind: "content", nodeId: node.id, contentId: entry.id } as const;
	const draggable = !isRoot;
	const selectionClass = [
		isSelected ? "outline outline-2 outline-offset-2 outline-primary bg-primary/10" : "",
		draggable ? "cursor-grab" : "",
		draggable && isSameDragItem(draggedItem, dragItem) ? "opacity-40" : "",
		draggable ? dropIndicatorClass(dropTarget, dragItem) : "",
	]
		.filter(Boolean)
		.join(" ");
	const interactionProps = {
		"data-template-selection-id": entry.id,
		"data-template-node-id": node.id,
		"data-template-drag-kind": draggable ? ("content" as const) : undefined,
		"data-template-surface": "preview",
		draggable,
		onClick: (event: ReactMouseEvent<HTMLElement>) => {
			event.stopPropagation();
			onSelectTarget(node.id, entry.id);
		},
	};
	if (entry.type === "repeat") {
		const columns = node.itemLayout?.columns ?? node.body?.root.props.columns ?? 1;
		const maximum = mode === "compact" ? Math.min(entry.itemCount ?? 48, 2) : (entry.itemCount ?? 48);
		const selected = items.slice(entry.itemStart ?? 0, (entry.itemStart ?? 0) + maximum);
		return (
			<div
				{...interactionProps}
				className={selectionClass}
				style={{
					display: columns > 1 ? "grid" : "flex",
					flexDirection: "column",
					gridTemplateColumns: columns > 1 ? `repeat(${columns}, minmax(0, 1fr))` : undefined,
					columnGap: node.itemLayout?.columnGap,
					rowGap: entry.label === "Table rows" ? 0 : "var(--item-gap)",
				}}
			>
				{selected.map((currentItem, index) => (
					<div
						key={currentItem.id}
						className={entry.itemMarker && entry.itemMarker !== "none" ? "flex min-w-0 items-start gap-1.5" : "min-w-0"}
					>
						{entry.itemMarker && entry.itemMarker !== "none" && (
							<span className="shrink-0 font-semibold">
								{entry.itemMarker === "number" ? `${(entry.itemStart ?? 0) + index + 1}.` : "•"}
							</span>
						)}
						<div className="min-w-0 flex-1">
							{entry.children.map((child) => (
								<PreviewComposerContent key={child.id} {...props} entry={child} isRoot={false} item={currentItem} />
							))}
						</div>
					</div>
				))}
			</div>
		);
	}
	if (entry.type === "layout") {
		const horizontal =
			entry.component === "row" ||
			entry.component === "columns" ||
			entry.component === "table-row" ||
			entry.props.direction === "horizontal";
		const layoutGap = isRoot ? "var(--item-gap)" : entry.props.gap;
		return (
			<div
				{...interactionProps}
				className={`min-w-0 ${entry.component === "table" ? "overflow-hidden" : ""} ${selectionClass}`}
				style={{
					display: entry.component === "grid" ? "grid" : "flex",
					flexDirection: horizontal ? "row" : "column",
					gridTemplateColumns:
						entry.component === "grid" ? `repeat(${entry.props.columns ?? 1}, minmax(0, 1fr))` : undefined,
					rowGap: isRoot ? "var(--item-gap)" : (entry.props.rowGap ?? layoutGap),
					columnGap: entry.props.columnGap ?? layoutGap,
					padding: entry.props.padding,
					width: entry.props.width ? `${entry.props.width}%` : undefined,
					alignItems: entry.props.align,
					justifyContent: entry.props.justify === "between" ? "space-between" : entry.props.justify,
					backgroundColor:
						entry.props.backgroundColor ??
						(entry.props.background === "primary"
							? "var(--template-primary)"
							: entry.props.background === "sidebar"
								? "var(--template-sidebar)"
								: entry.props.background === "page"
									? "var(--template-page)"
									: undefined),
					border: entry.props.border === "solid" ? "1px solid #d0d5dd" : undefined,
					borderLeft: entry.props.border === "divider" ? `2px solid ${primaryColor}` : undefined,
					borderRadius:
						entry.props.radius ??
						(entry.component === "box" ||
						(entry.props.border && entry.props.border !== "none") ||
						(entry.props.background && entry.props.background !== "transparent") ||
						entry.props.backgroundColor
							? "var(--template-radius)"
							: undefined),
				}}
			>
				{entry.children.map((child) => (
					<PreviewComposerContent key={child.id} {...props} entry={child} isRoot={false} {...(item ? { item } : {})} />
				))}
			</div>
		);
	}
	if (!entry.visible) return null;
	if (entry.component === "table" && entry.table) {
		const table = entry.table;
		if (table.orientation === "key-value") {
			const record = item ?? items[0];
			return (
				<div {...interactionProps} className={`min-w-0 flex-1 ${selectionClass}`}>
					<table className="w-full table-fixed border-collapse text-[0.78em] leading-tight">
						<tbody>
							{table.columns.map((column) => (
								<tr key={column.id}>
									<th
										className="break-words border px-1.5 py-1.5 text-start font-semibold"
										style={{
											width: `${column.width ?? 24}%`,
											color: primaryColor,
											backgroundColor: "color-mix(in srgb, var(--template-sidebar) 35%, transparent)",
										}}
									>
										{column.label}
									</th>
									<td className="break-words border px-1.5 py-1.5">
										{record ? plainText(previewComposerBindingValue(record, column.binding)) : ""}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			);
		}
		const rows =
			table.mode === "static"
				? table.rows
				: items.map((currentItem) =>
						table.columns.map((column) => previewComposerBindingValue(currentItem, column.binding)),
					);
		return (
			<div {...interactionProps} className={`min-w-0 flex-1 ${selectionClass}`}>
				{table.title && <p className="mb-1 font-semibold">{table.title}</p>}
				<table className="w-full table-fixed border-collapse text-[0.72em] leading-tight">
					{table.headerVisible && (
						<thead>
							<tr style={{ backgroundColor: primaryColor, color: "#ffffff" }}>
								{table.columns.map((column) => (
									<th
										key={column.id}
										className="break-words border px-0.5 py-1 font-semibold"
										style={{ width: `${column.width ?? 100 / table.columns.length}%`, textAlign: column.align }}
									>
										{column.label}
									</th>
								))}
							</tr>
						</thead>
					)}
					<tbody>
						{rows.map((row, rowIndex) => (
							<tr key={`${entry.id}-row-${rowIndex}`}>
								{table.columns.map((column, columnIndex) => (
									<td
										key={column.id}
										className={
											columnIndex === 0
												? "break-words border px-0.5 py-1 font-semibold"
												: "break-words border px-0.5 py-1"
										}
										style={{ textAlign: column.align }}
									>
										{row[columnIndex] ?? ""}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}
	const boundValue =
		entry.binding === "literal"
			? (entry.literal ?? "")
			: entry.binding === "section.title"
				? sectionTitle
				: entry.binding === "section.content"
					? sectionContent
					: (item?.[entry.binding.replace("item.", "") as keyof PreviewComposerItem] ?? "");
	if (!plainText(String(boundValue))) return null;
	const rawValue = `${entry.prefix ?? ""}${String(boundValue)}${entry.suffix ?? ""}`;
	const value = plainText(rawValue);
	if (!value) return null;
	if (entry.component === "progress") {
		const numericValue = Math.max(0, Math.min(5, Number(value) || 0));
		return (
			<div {...interactionProps} className={`h-1.5 w-full overflow-hidden bg-slate-300 ${selectionClass}`}>
				<div className="h-full" style={{ width: `${(numericValue / 5) * 100}%`, backgroundColor: primaryColor }} />
			</div>
		);
	}
	if (entry.component === "heading") {
		if (node.appearance?.heading === "hidden") return null;
		const filled = node.appearance?.heading === "filled" || node.appearance?.heading === "badge";
		return (
			<h3
				{...interactionProps}
				className={[
					"font-bold uppercase tracking-wider",
					node.appearance?.heading === "plain" ? "" : "border-b pb-1",
					filled ? "px-2 py-1" : "",
					node.appearance?.heading === "badge" ? "w-fit rounded-full" : "",
					selectionClass,
				].join(" ")}
				style={{
					borderColor: primaryColor,
					backgroundColor: filled ? primaryColor : undefined,
					color: filled ? "#ffffff" : headingColor,
					fontFamily: "var(--heading-font)",
				}}
			>
				{value}
			</h3>
		);
	}
	if (entry.component === "list") {
		return (
			<ul {...interactionProps} className={`space-y-0.5 ${selectionClass}`}>
				{listTextItems(rawValue).map((listItem, index) => (
					<li key={`${entry.id}-${index}`} className="flex items-start gap-1 before:content-['➢']">
						<span>{listItem}</span>
					</li>
				))}
			</ul>
		);
	}
	const className = [
		entry.variant === "strong" ? "font-semibold" : "",
		entry.variant === "muted" || entry.component === "meta" ? "opacity-70" : "",
		entry.component === "badge" || entry.variant === "pill" ? "inline-flex w-fit rounded-full px-2 py-1" : "",
	].join(" ");
	return (
		<p
			{...interactionProps}
			className={`${className} ${selectionClass}`}
			style={
				entry.component === "badge" || entry.variant === "pill"
					? { backgroundColor: `${primaryColor}18` }
					: entry.variant === "accent"
						? { color: primaryColor }
						: undefined
			}
		>
			{mode === "compact" && entry.component === "rich-text" ? value.slice(0, 90) : value}
		</p>
	);
}

function EditorComposerSection({
	node,
	primaryColor,
	headingColor,
	mode,
	selection,
	draggedItem,
	dropTarget,
	onSelectTarget,
}: EditorSectionProps) {
	const sectionData = (sampleResumeData.sections as unknown as Record<string, { title?: string; items?: unknown[] }>)[
		node.section
	];
	const items = (sectionData?.items ?? []).map((item, index) =>
		normalizePreviewComposerItem(item, node.section, index),
	);
	if (!node.body) return null;
	return (
		<section className="min-w-0">
			<PreviewComposerContent
				entry={node.body.root}
				isRoot
				sectionTitle={node.title ?? sectionData?.title ?? sectionLabels[node.section]}
				sectionContent={node.section === "summary" ? sampleResumeData.summary.content : ""}
				items={items}
				node={node}
				primaryColor={primaryColor}
				headingColor={headingColor}
				mode={mode}
				selection={selection}
				draggedItem={draggedItem}
				dropTarget={dropTarget}
				onSelectTarget={onSelectTarget}
			/>
		</section>
	);
}

function EditorSection({
	node,
	primaryColor,
	headingColor,
	mode,
	selection,
	draggedItem,
	dropTarget,
	onSelectTarget,
}: EditorSectionProps) {
	if (node.body)
		return (
			<EditorComposerSection
				node={node}
				primaryColor={primaryColor}
				headingColor={headingColor}
				mode={mode}
				selection={selection}
				draggedItem={draggedItem}
				dropTarget={dropTarget}
				onSelectTarget={onSelectTarget}
			/>
		);
	const data = sampleResumeData;
	const itemLayout = node.itemLayout ?? { columns: 1, columnGap: 8, rowGap: 8 };
	const appearance = node.appearance ?? {
		heading: "underline" as const,
		itemHeader: "split" as const,
		itemDecoration: "none" as const,
	};
	const itemLimit = mode === "compact" ? 1 : Number.POSITIVE_INFINITY;
	const previewDescription = (value: string) => {
		const text = plainText(value);
		return mode === "compact" ? text.slice(0, 80) : text;
	};
	const skillItems = data.sections.skills.items.slice(
		node.itemStart ?? 0,
		(node.itemStart ?? 0) + (node.itemCount ?? itemLimit * 3),
	);
	let content: ReactNode;

	switch (node.section) {
		case "summary":
			content = <p>{plainText(data.summary.content)}</p>;
			break;
		case "experience":
			content = data.sections.experience.items.slice(0, itemLimit).map((item) => (
				<div key={item.id} className="space-y-0.5">
					<div
						className={
							appearance.itemHeader === "stacked"
								? "space-y-0.5"
								: appearance.itemHeader === "inline"
									? "flex flex-wrap items-baseline gap-x-2"
									: "grid grid-cols-[minmax(0,1fr)_auto] gap-x-2"
						}
					>
						<p className="font-semibold">{item.position}</p>
						<p className="text-[0.92em] opacity-70">
							{item.company} · {item.period}
						</p>
					</div>
					<p>{previewDescription(item.description)}</p>
				</div>
			));
			break;
		case "education":
			content = data.sections.education.items.slice(0, itemLimit).map((item) => (
				<div key={item.id}>
					<div
						className={
							appearance.itemHeader === "stacked"
								? ""
								: appearance.itemHeader === "inline"
									? "flex flex-wrap items-baseline gap-x-2"
									: "grid grid-cols-[minmax(0,1fr)_auto] gap-x-2"
						}
					>
						<p className="font-semibold">{item.degree}</p>
						<p className="opacity-70">{item.period}</p>
					</div>
					<p>{item.school}</p>
				</div>
			));
			break;
		case "projects":
			content = data.sections.projects.items.slice(0, itemLimit).map((item) => (
				<div key={item.id}>
					<div className={appearance.itemHeader === "inline" ? "flex flex-wrap items-baseline gap-x-2" : ""}>
						<p className="font-semibold">{item.name}</p>
						{item.period && <p className="opacity-70">{item.period}</p>}
					</div>
					<p>{previewDescription(item.description)}</p>
				</div>
			));
			break;
		case "skills":
			content =
				node.variant === "table" ? (
					<div className="overflow-hidden rounded-sm border">
						<div className="grid grid-cols-[1.1fr_.8fr_1.6fr] font-semibold" style={{ backgroundColor: primaryColor }}>
							<span className="p-1.5">Skill</span>
							<span className="border-l p-1.5">Proficiency</span>
							<span className="border-l p-1.5">Keywords</span>
						</div>
						{skillItems.map((item) => (
							<div key={item.id} className="grid grid-cols-[1.1fr_.8fr_1.6fr] border-t">
								<span className="p-1.5 font-semibold">{item.name}</span>
								<span className="border-l p-1.5">{item.proficiency}</span>
								<span className="border-l p-1.5">{item.keywords.join(", ")}</span>
							</div>
						))}
					</div>
				) : (
					<div className={node.variant === "tags" ? "flex flex-wrap gap-1" : "space-y-1"}>
						{skillItems.map((item) => (
							<span
								key={item.id}
								className={
									node.variant === "tags"
										? "rounded-full px-2 py-1 text-[0.9em]"
										: node.variant === "bullets"
											? "block before:me-2 before:text-[var(--accent)] before:content-['•']"
											: "block"
								}
								style={node.variant === "tags" ? { backgroundColor: `${primaryColor}18` } : undefined}
							>
								<strong>{item.name}</strong>
								{node.variant === "bullets" && item.keywords.length > 0 ? `: ${item.keywords.join(", ")}` : ""}
							</span>
						))}
					</div>
				);
			break;
		case "languages":
			content = data.sections.languages.items.slice(0, itemLimit * 2).map((item) => (
				<p key={item.id}>
					{item.language} · {item.fluency}
				</p>
			));
			break;
		case "certifications":
			content = data.sections.certifications.items.slice(0, itemLimit).map((item) => (
				<div key={item.id}>
					<p className="font-semibold">{item.title}</p>
					<p>
						{item.issuer} · {item.date}
					</p>
				</div>
			));
			break;
		case "profiles":
			content = data.sections.profiles.items.slice(0, itemLimit * 2).map((item) => (
				<p key={item.id}>
					{item.network} · {item.username}
				</p>
			));
			break;
		case "interests":
			content = data.sections.interests.items.slice(0, itemLimit * 2).map((item) => <p key={item.id}>{item.name}</p>);
			break;
		case "awards":
			content = data.sections.awards.items.slice(0, itemLimit).map((item) => (
				<div key={item.id}>
					<p className="font-semibold">{item.title}</p>
					<p>
						{item.awarder} · {item.date}
					</p>
				</div>
			));
			break;
		case "publications":
			content = data.sections.publications.items.slice(0, itemLimit).map((item) => (
				<div key={item.id}>
					<p className="font-semibold">{item.title}</p>
					<p>
						{item.publisher} · {item.date}
					</p>
				</div>
			));
			break;
		case "volunteer":
			content = data.sections.volunteer.items.slice(0, itemLimit).map((item) => (
				<div key={item.id}>
					<p className="font-semibold">{item.organization}</p>
					<p>{item.period}</p>
				</div>
			));
			break;
		case "references":
			content = data.sections.references.items.slice(0, itemLimit).map((item) => (
				<div key={item.id}>
					<p className="font-semibold">{item.name}</p>
					<p>{item.position}</p>
				</div>
			));
			break;
	}

	return (
		<section
			className={`flex flex-col ${node.variant === "boxed" ? "border p-2" : ""}`}
			style={
				{
					"--accent": primaryColor,
					gap: node.variant === "compact" ? "calc(var(--item-gap) / 2)" : "var(--item-gap)",
					borderRadius: node.variant === "boxed" ? "var(--template-radius)" : undefined,
				} as CSSProperties
			}
		>
			{appearance.heading !== "hidden" && (
				<h3
					className={[
						"font-bold uppercase tracking-wider",
						appearance.heading === "underline" ? "border-b pb-1" : "",
						appearance.heading === "filled" ? "px-2 py-1" : "",
						appearance.heading === "badge" ? "w-fit rounded-full px-2 py-1" : "",
					].join(" ")}
					style={{
						color: ["filled", "badge"].includes(appearance.heading) ? "#ffffff" : headingColor,
						borderColor: primaryColor,
						backgroundColor: ["filled", "badge"].includes(appearance.heading) ? primaryColor : undefined,
						fontFamily: "var(--heading-font)",
					}}
				>
					{node.title ?? sectionLabels[node.section]}
				</h3>
			)}
			<div
				className={[
					node.variant === "timeline" && itemLayout.columns === 1 ? "border-l-2 pl-3" : "",
					appearance.itemDecoration === "divider" ? "[&>*+*]:border-t [&>*+*]:pt-2" : "",
					appearance.itemDecoration === "border" ? "[&>*]:rounded-sm [&>*]:border [&>*]:p-2" : "",
					appearance.itemDecoration === "card"
						? "[&>*]:rounded-md [&>*]:border [&>*]:bg-white/70 [&>*]:p-2 [&>*]:shadow-sm"
						: "",
				].join(" ")}
				style={{
					display: itemLayout.columns > 1 ? "grid" : undefined,
					gridTemplateColumns: itemLayout.columns > 1 ? `repeat(${itemLayout.columns}, minmax(0, 1fr))` : undefined,
					columnGap: itemLayout.columnGap,
					rowGap: "var(--item-gap)",
				}}
			>
				{content}
			</div>
		</section>
	);
}

type EditorFlowNodeProps = {
	node: TemplateFlowNode;
	ast: TemplateAst;
	mode: PreviewMode;
	selection: PreviewSelection;
	draggedItem: TemplateDragItem | null;
	dropTarget: TemplateDropTarget | null;
	onSelectTarget: (nodeId: string, contentId: string | null) => void;
};

function EditorFlowNode({ node, ast, mode, selection, draggedItem, dropTarget, onSelectTarget }: EditorFlowNodeProps) {
	if (node.type === "header") {
		const split = node.variant === "split";
		return (
			<header
				className={`border-b-2 pb-3 ${node.variant === "compact" ? "space-y-0" : "space-y-1"}`}
				style={{ borderColor: ast.tokens.primaryColor }}
			>
				<div className={`flex items-center gap-3 ${split ? "justify-between" : ""}`}>
					{node.showPicture && !sampleResumeData.picture.hidden && (
						<img
							src={sampleResumeData.picture.url}
							alt=""
							className="size-14 object-cover"
							style={{ borderRadius: ast.tokens.radius }}
						/>
					)}
					<div className={split ? "max-w-[62%]" : undefined}>
						<h1
							className={
								node.variant === "standard" || node.variant === "split" ? "font-bold text-3xl" : "font-bold text-xl"
							}
							style={{
								color: ast.tokens.headingColor ?? ast.tokens.primaryColor,
								fontFamily: ast.tokens.headingFont,
							}}
						>
							{sampleResumeData.basics.name}
						</h1>
						<p>{sampleResumeData.basics.headline}</p>
					</div>
					{split && node.showContact && (
						<div className="space-y-0.5 text-right opacity-70">
							<p>{sampleResumeData.basics.email}</p>
							<p>{sampleResumeData.basics.phone}</p>
							<p>{sampleResumeData.basics.location}</p>
						</div>
					)}
				</div>
				{!split && node.showContact && (
					<p className="opacity-70">
						{sampleResumeData.basics.email} · {sampleResumeData.basics.phone} · {sampleResumeData.basics.location}
					</p>
				)}
			</header>
		);
	}
	if (node.type === "divider") {
		return <hr style={{ borderColor: node.color, borderTopWidth: node.thickness, borderStyle: node.style }} />;
	}
	if (node.type === "spacer") return <div style={{ height: node.height }} />;
	return (
		<EditorSection
			node={node}
			primaryColor={ast.tokens.primaryColor}
			headingColor={ast.tokens.headingColor ?? ast.tokens.textColor}
			mode={mode}
			selection={selection}
			draggedItem={draggedItem}
			dropTarget={dropTarget}
			onSelectTarget={onSelectTarget}
		/>
	);
}

function PreviewShape({ node, selected }: { node: TemplateShapeNode; selected: boolean }) {
	return (
		<div
			data-template-selection-id={node.id}
			data-template-node-id={node.id}
			data-template-surface="preview"
			className={`pointer-events-auto absolute cursor-pointer ${
				selected ? "outline outline-2 outline-primary outline-offset-2" : ""
			}`}
			style={{
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

function copyComputedStyles(source: Element, target: Element) {
	if (source instanceof HTMLElement && target instanceof HTMLElement) {
		const computed = window.getComputedStyle(source);
		target.style.cssText = Array.from(computed)
			.map((property) => `${property}:${computed.getPropertyValue(property)};`)
			.join("");
	}

	const sourceChildren = Array.from(source.children);
	const targetChildren = Array.from(target.children);
	sourceChildren.forEach((child, index) => {
		const targetChild = targetChildren[index];
		if (targetChild) copyComputedStyles(child, targetChild);
	});
}

async function capturePreviewFile(element: HTMLElement): Promise<File | undefined> {
	try {
		const bounds = element.getBoundingClientRect();
		if (bounds.width < 1 || bounds.height < 1) return undefined;
		const clone = element.cloneNode(true) as HTMLElement;
		copyComputedStyles(element, clone);
		const width = Math.round(bounds.width);
		const height = Math.round(bounds.height);
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${new XMLSerializer().serializeToString(clone)}</div></foreignObject></svg>`;
		const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
		try {
			const image = new Image();
			image.src = url;
			await image.decode();
			const scale = Math.min(2, 1400 / width);
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(width * scale));
			canvas.height = Math.max(1, Math.round(height * scale));
			const context = canvas.getContext("2d");
			if (!context) return undefined;
			context.scale(scale, scale);
			context.drawImage(image, 0, 0, width, height);
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.9));
			return blob ? new File([blob], "current-template-preview.png", { type: "image/png" }) : undefined;
		} finally {
			URL.revokeObjectURL(url);
		}
	} catch {
		return undefined;
	}
}

type DocxSourcePreviewProps = {
	file?: File;
	url?: string;
};

function DocxSourcePreview({ file, url }: DocxSourcePreviewProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

	useEffect(() => {
		const container = containerRef.current;
		if (!container || (!file && !url)) return;
		let cancelled = false;
		container.replaceChildren();
		setStatus("loading");

		const render = async () => {
			const source =
				file ??
				(await fetch(url ?? "", { credentials: "include" }).then((response) => {
					if (!response.ok) throw new Error(`Source preview request failed with ${response.status}`);
					return response.blob();
				}));
			const { renderAsync } = await import("docx-preview");
			await renderAsync(source, container, undefined, {
				inWrapper: true,
				breakPages: true,
				renderHeaders: true,
				renderFooters: true,
				renderFootnotes: true,
				ignoreWidth: false,
				ignoreHeight: false,
				useBase64URL: true,
			});
			if (cancelled) return;
			const wrapper = container.querySelector<HTMLElement>(".docx-wrapper");
			const page = container.querySelector<HTMLElement>(".docx");
			if (wrapper && page) {
				const pageWidth = page.getBoundingClientRect().width;
				const availableWidth = Math.max(240, container.clientWidth - 24);
				wrapper.style.zoom = String(Math.min(1, availableWidth / Math.max(1, pageWidth)));
				wrapper.style.padding = "12px";
			}
			setStatus("ready");
		};

		void render().catch(() => {
			if (!cancelled) setStatus("error");
		});
		return () => {
			cancelled = true;
			container.replaceChildren();
		};
	}, [file, url]);

	return (
		<div className="relative aspect-[210/297] overflow-auto border-t bg-muted/30">
			{status === "loading" && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 text-muted-foreground text-sm">
					<SpinnerGapIcon className="me-2 animate-spin" />
					Rendering DOCX preview…
				</div>
			)}
			{status === "error" && (
				<div className="absolute inset-0 z-10 flex items-center justify-center p-8 text-center text-muted-foreground text-sm">
					The DOCX preview could not be rendered. Use a PDF for exact page comparison.
				</div>
			)}
			<div ref={containerRef} className="min-h-full min-w-full" />
		</div>
	);
}

function ImportDiagnostics({ report }: { report: TemplateCompilerReport }) {
	const breakdown = report.confidenceBreakdown;
	const hasDetailedConfidence = breakdown && Object.values(breakdown).some((confidence) => confidence > 0);
	const confidence = hasDetailedConfidence
		? breakdown
		: {
				semantic: report.confidence,
				layout: report.confidence,
				typography: report.confidence,
				extraction: report.confidence,
			};
	return (
		<Card>
			<details>
				<summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3">
					<div className="min-w-0 flex-1">
						<p className="font-medium text-sm">Import diagnostics</p>
						<p className="truncate text-muted-foreground text-xs">
							{report.sourceFormat.toUpperCase()} · {report.pageCount} page(s) · {report.detectedLayout}
						</p>
					</div>
					<Badge variant="secondary">Structure {Math.round(report.confidence * 100)}%</Badge>
					<Badge variant="outline">Visual {Math.round((report.visualFidelity ?? 0.5) * 100)}%</Badge>
					<span className="text-muted-foreground text-xs">View import assessment</span>
				</summary>
				<CardContent className="space-y-3 border-t pt-4 text-sm">
					<div className="grid gap-2 sm:grid-cols-4">
						<div className="rounded-md border p-2">
							<p className="text-muted-foreground text-xs">Content</p>
							<p className="font-medium">{Math.round(confidence.semantic * 100)}%</p>
						</div>
						<div className="rounded-md border p-2">
							<p className="text-muted-foreground text-xs">Layout</p>
							<p className="font-medium">{Math.round(confidence.layout * 100)}%</p>
						</div>
						<div className="rounded-md border p-2">
							<p className="text-muted-foreground text-xs">Typography</p>
							<p className="font-medium">{Math.round(confidence.typography * 100)}%</p>
						</div>
						<div className="rounded-md border p-2">
							<p className="text-muted-foreground text-xs">Extraction</p>
							<p className="font-medium">{Math.round(confidence.extraction * 100)}%</p>
						</div>
					</div>
					{report.warnings.length > 0 && (
						<div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
							<p className="font-medium text-amber-700 dark:text-amber-400">Review notes</p>
							{report.warnings.map((warning) => (
								<p key={warning} className="text-amber-700 text-xs dark:text-amber-400">
									{warning}
								</p>
							))}
						</div>
					)}
					<div className="grid gap-3 lg:grid-cols-3">
						<div className="rounded-md border p-3">
							<p className="font-medium text-emerald-700 text-xs dark:text-emerald-400">Supported</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{report.mappingSummary.supported.join(", ") || "None detected"}
							</p>
						</div>
						<div className="rounded-md border p-3">
							<p className="font-medium text-amber-700 text-xs dark:text-amber-400">Approximated</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{report.mappingSummary.approximated.join(", ") || "None"}
							</p>
						</div>
						<div className="rounded-md border p-3">
							<p className="font-medium text-red-700 text-xs dark:text-red-400">Unsupported</p>
							<p className="mt-1 text-muted-foreground text-xs">
								{report.mappingSummary.unsupported.join(", ") || "None"}
							</p>
						</div>
					</div>
				</CardContent>
			</details>
		</Card>
	);
}

type LivePreviewProps = {
	ast: TemplateAst;
	mode: PreviewMode;
	selection: PreviewSelection;
	draggedItem: TemplateDragItem | null;
	dropTarget: TemplateDropTarget | null;
	onSelectTarget: (nodeId: string, contentId: string | null) => void;
	onDragStart: (event: ReactDragEvent<HTMLElement>, item: TemplateDragItem) => void;
	onDragOverTarget: (event: ReactDragEvent<HTMLElement>, item: TemplateDragItem, position: "before" | "after") => void;
	onDropTarget: (event: ReactDragEvent<HTMLElement>, item: TemplateDragItem, position: "before" | "after") => void;
	onDragEnd: () => void;
	previewRef?: RefObject<HTMLDivElement | null>;
};

type PreviewPageComposerProps = {
	entry: TemplateComposerPageNode;
	nodeMap: Map<string, TemplateFlowNode>;
	ast: TemplateAst;
	mode: PreviewMode;
	selection: PreviewSelection;
	draggedItem: TemplateDragItem | null;
	dropTarget: TemplateDropTarget | null;
	onSelectTarget: (nodeId: string, contentId: string | null) => void;
};

function PreviewPageComposer({
	entry,
	nodeMap,
	ast,
	mode,
	selection,
	draggedItem,
	dropTarget,
	onSelectTarget,
}: PreviewPageComposerProps) {
	if (entry.type === "slot") {
		const node = nodeMap.get(entry.nodeId);
		if (!node) return null;
		const selected = selection.nodeId === node.id && !selection.contentId;
		const dragItem = { kind: "node", nodeId: node.id } as const;
		const slotInteractionProps = {
			onClick: (event: ReactMouseEvent<HTMLElement>) => {
				event.stopPropagation();
				onSelectTarget(node.id, null);
			},
		};
		return (
			<div
				{...slotInteractionProps}
				data-template-selection-id={node.id}
				data-template-node-id={node.id}
				data-template-drag-kind="node"
				data-template-surface="preview"
				draggable
				className={[
					"cursor-grab",
					selected ? "relative z-[1] rounded-sm bg-primary/10 outline outline-2 outline-primary outline-offset-2" : "",
					isSameDragItem(draggedItem, dragItem) ? "opacity-40" : "",
					dropIndicatorClass(dropTarget, dragItem),
				]
					.filter(Boolean)
					.join(" ")}
			>
				<EditorFlowNode
					node={node}
					ast={ast}
					mode={mode}
					selection={selection}
					draggedItem={draggedItem}
					dropTarget={dropTarget}
					onSelectTarget={onSelectTarget}
				/>
			</div>
		);
	}
	const horizontal =
		entry.component === "row" || entry.component === "columns" || entry.props.direction === "horizontal";
	const backgroundColor =
		entry.props.backgroundColor ??
		(entry.props.background === "sidebar"
			? ast.tokens.sidebarColor
			: entry.props.background === "primary"
				? ast.tokens.primaryColor
				: entry.props.background === "page"
					? ast.tokens.backgroundColor
					: undefined);
	const isTwoColumnRoot = entry.id === "page-root" && ast.layout.preset === "two-column";
	const isGridRoot = entry.id === "page-root" && ast.layout.preset === "grid";
	const isSectionStack = entry.id === "page-root" || entry.id.startsWith("region-");
	const fallbackGap = isGridRoot ? ast.layout.pageGrid?.gap : isSectionStack ? ast.tokens.sectionGap : entry.props.gap;
	const rowGap = isTwoColumnRoot ? entry.props.rowGap : (entry.props.rowGap ?? fallbackGap);
	const columnGap = isTwoColumnRoot
		? (ast.layout.columnGap ?? entry.props.columnGap ?? entry.props.gap ?? 18)
		: (entry.props.columnGap ?? fallbackGap);
	return (
		<div
			data-template-page-layout-id={entry.id}
			className="min-w-0"
			style={{
				display: entry.component === "grid" ? "grid" : "flex",
				flexDirection: horizontal ? "row" : "column",
				gridTemplateColumns:
					entry.component === "grid" ? `repeat(${entry.props.columns ?? 1}, minmax(0, 1fr))` : undefined,
				flexBasis: entry.props.width ? `${entry.props.width}%` : undefined,
				flexGrow: entry.props.width ?? undefined,
				rowGap,
				columnGap,
				padding: entry.props.padding,
				backgroundColor,
				border: entry.props.border === "solid" ? `1px solid ${ast.tokens.primaryColor}` : undefined,
				borderLeft: entry.props.border === "divider" ? `2px solid ${ast.tokens.primaryColor}` : undefined,
				borderRadius: entry.props.radius,
				alignItems: entry.props.align,
				justifyContent:
					entry.props.justify === "between"
						? "space-between"
						: entry.props.justify === "end"
							? "flex-end"
							: entry.props.justify,
			}}
		>
			{entry.children.map((child) => (
				<PreviewPageComposer
					key={child.id}
					entry={child}
					nodeMap={nodeMap}
					ast={ast}
					mode={mode}
					selection={selection}
					draggedItem={draggedItem}
					dropTarget={dropTarget}
					onSelectTarget={onSelectTarget}
				/>
			))}
		</div>
	);
}

function LivePreview({
	ast,
	mode,
	selection,
	draggedItem,
	dropTarget,
	onSelectTarget,
	onDragStart,
	onDragOverTarget,
	onDropTarget,
	onDragEnd,
	previewRef,
}: LivePreviewProps) {
	const flowNodes = ast.nodes.filter((node): node is TemplateFlowNode => isFlowNode(node) && node.visible);
	const shapes = ast.nodes.filter((node): node is TemplateShapeNode => node.type === "shape" && node.visible);
	const hasHeader = flowNodes.some((node) => node.type === "header");
	const nodeMap = new Map(flowNodes.map((node) => [node.id, node]));
	const style = {
		backgroundColor: ast.tokens.backgroundColor,
		color: ast.tokens.textColor,
		fontFamily: ast.tokens.bodyFont,
		fontSize: `${ast.tokens.bodySize}px`,
		padding: `${ast.layout.pagePadding}px`,
		"--section-gap": `${ast.tokens.sectionGap}px`,
		"--item-gap": `${ast.tokens.itemGap}px`,
		"--template-primary": ast.tokens.primaryColor,
		"--template-sidebar": ast.tokens.sidebarColor,
		"--template-page": ast.tokens.backgroundColor,
		"--template-radius": `${ast.tokens.radius}px`,
		"--heading-font": ast.tokens.headingFont,
		"--page-column-gap": `${ast.layout.columnGap ?? ast.page.root.props.gap ?? 18}px`,
	} as CSSProperties;
	const previewDragTarget = (event: ReactDragEvent<HTMLElement>) => {
		const selector = draggedItem ? `[data-template-drag-kind="${draggedItem.kind}"]` : "[data-template-drag-kind]";
		const element = (event.target as HTMLElement).closest<HTMLElement>(selector);
		if (!element || !event.currentTarget.contains(element)) return null;
		const nodeId = element.dataset.templateNodeId;
		if (!nodeId) return null;
		const item: TemplateDragItem =
			element.dataset.templateDragKind === "content"
				? { kind: "content", nodeId, contentId: element.dataset.templateSelectionId ?? "" }
				: { kind: "node", nodeId };
		if (item.kind === "content" && !item.contentId) return null;
		const bounds = element.getBoundingClientRect();
		const position = event.clientY < bounds.top + bounds.height / 2 ? ("before" as const) : ("after" as const);
		return { item, position };
	};

	return (
		<div
			ref={previewRef}
			role="application"
			aria-label="Interactive template preview"
			className="relative mx-auto min-h-[720px] w-full max-w-[720px] rounded-sm border bg-white shadow-lg"
			style={{ ...style, borderRadius: ast.tokens.radius }}
			onClick={(event) => {
				const element = (event.target as HTMLElement).closest<HTMLElement>("[data-template-selection-id]");
				if (!element || !event.currentTarget.contains(element)) return;
				const nodeId =
					element.dataset.templateNodeId ??
					element.closest<HTMLElement>("[data-template-node-id]")?.dataset.templateNodeId;
				const selectionId = element.dataset.templateSelectionId;
				if (!nodeId || !selectionId) return;
				onSelectTarget(nodeId, selectionId === nodeId ? null : selectionId);
			}}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				const selectionId = selection.contentId ?? selection.nodeId;
				if (!selection.nodeId || !selectionId) return;
				event.preventDefault();
				onSelectTarget(selection.nodeId, selection.contentId);
			}}
			onDragStart={(event) => {
				const target = previewDragTarget(event);
				if (target) onDragStart(event, target.item);
			}}
			onDragOver={(event) => {
				const target = previewDragTarget(event);
				if (target) onDragOverTarget(event, target.item, target.position);
			}}
			onDrop={(event) => {
				const target = previewDragTarget(event);
				if (target) onDropTarget(event, target.item, target.position);
			}}
			onDragEnd={onDragEnd}
		>
			{shapes.map((node) => (
				<PreviewShape key={node.id} node={node} selected={selection.nodeId === node.id && !selection.contentId} />
			))}

			<div className="relative z-0">
				{!hasHeader && (
					<header className="mb-[var(--section-gap)] border-b-2 pb-3" style={{ borderColor: ast.tokens.primaryColor }}>
						<h1
							className="font-bold text-3xl"
							style={{
								color: ast.tokens.headingColor ?? ast.tokens.primaryColor,
								fontFamily: ast.tokens.headingFont,
							}}
						>
							{sampleResumeData.basics.name}
						</h1>
						<p>{sampleResumeData.basics.headline}</p>
					</header>
				)}
				<PreviewPageComposer
					entry={ast.page.root}
					nodeMap={nodeMap}
					ast={ast}
					mode={mode}
					selection={selection}
					draggedItem={draggedItem}
					dropTarget={dropTarget}
					onSelectTarget={onSelectTarget}
				/>
			</div>
		</div>
	);
}

function RouteComponent() {
	const { templateId } = Route.useParams();
	const navigate = useNavigate();
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const detailsOptions = orpc.customTemplates.getById.queryOptions({ input: { id: templateId } });
	const { data: template, isLoading } = useQuery(detailsOptions);
	const [name, setName] = useState("");
	const [ast, setAst] = useState<TemplateAst | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
	const [selectedRepeatId, setSelectedRepeatId] = useState<string | null>(null);
	const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
	const [draggedItem, setDraggedItem] = useState<TemplateDragItem | null>(null);
	const [dropTarget, setDropTarget] = useState<TemplateDropTarget | null>(null);
	const [previewMode, setPreviewMode] = useState<PreviewMode>("standard");
	const [previewTab, setPreviewTab] = useState<"source" | "template">("template");
	const [sectionToAdd, setSectionToAdd] = useState<TemplateSectionKind>("projects");
	const [composerItemToAdd, setComposerItemToAdd] = useState<ComposerItemKind>("text");
	const [hasAiSuggestion, setHasAiSuggestion] = useState(false);
	const [isPreparingAi, setIsPreparingAi] = useState(false);
	const [aiReview, setAiReview] = useState<AiImproveReview | null>(null);
	const [sourceFile, setSourceFile] = useState<File | null>(null);
	const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
	const aiSourceInputRef = useRef<HTMLInputElement>(null);
	const sourceSelectionActionRef = useRef<"preview" | "improve">("preview");
	const sourceTemplateIdRef = useRef(templateId);
	const editorTemplateIdRef = useRef<string | null>(null);
	const selectionOriginRef = useRef<"preview" | "structure">("structure");
	const previewRef = useRef<HTMLDivElement>(null);
	const structureRef = useRef<HTMLDivElement>(null);
	const { mutateAsync: updateDraft, isPending: isSaving } = useMutation(
		orpc.customTemplates.updateDraft.mutationOptions(),
	);
	const { mutateAsync: publish, isPending: isPublishing } = useMutation(orpc.customTemplates.publish.mutationOptions());
	const { mutateAsync: submitReview, isPending: isSubmittingReview } = useMutation(
		orpc.customTemplates.submitReview.mutationOptions(),
	);
	const { mutateAsync: changeStatus, isPending: isChangingStatus } = useMutation(
		orpc.customTemplates.changeStatus.mutationOptions(),
	);
	const { mutateAsync: aiImprove, isPending: isImproving } = useMutation(
		orpc.customTemplates.aiImprove.mutationOptions(),
	);
	const { mutateAsync: persistTemplateSource, isPending: isSavingSource } = useMutation(
		orpc.customTemplates.setSource.mutationOptions(),
	);
	const { mutateAsync: deleteTemplate, isPending: isDeleting } = useMutation(
		orpc.customTemplates.delete.mutationOptions(),
	);

	useEffect(() => {
		if (!template) return;
		const parsedDraft = templateAstSchema.parse(template.draft);
		const expectedPageGap =
			parsedDraft.layout.preset === "two-column"
				? (parsedDraft.layout.columnGap ?? parsedDraft.page.root.props.gap ?? 18)
				: parsedDraft.layout.preset === "grid"
					? parsedDraft.layout.pageGrid?.gap
					: undefined;
		const draft =
			expectedPageGap !== undefined && parsedDraft.page.root.props.gap !== expectedPageGap
				? templateAstSchema.parse({
						...parsedDraft,
						page: {
							root: {
								...parsedDraft.page.root,
								props: { ...parsedDraft.page.root.props, gap: expectedPageGap },
							},
						},
					})
				: parsedDraft;
		const templateChanged = editorTemplateIdRef.current !== template.id;
		editorTemplateIdRef.current = template.id;
		setName(template.name);
		setAst(draft);
		setSelectedId((current) =>
			!templateChanged && current && draft.nodes.some((node) => node.id === current) ? current : null,
		);
		if (templateChanged) {
			setSelectedBlockId(null);
			setSelectedRepeatId(null);
			setSelectedLayoutId(null);
			setDraggedItem(null);
			setDropTarget(null);
		}
		setHasAiSuggestion(false);
		setAiReview(null);
	}, [template]);

	useEffect(() => {
		if (sourceTemplateIdRef.current === templateId) return;
		sourceTemplateIdRef.current = templateId;
		setSourceFile(null);
	}, [templateId]);

	useEffect(() => {
		if (!sourceFile || !isPdfSource(sourceFile)) {
			setSourcePreviewUrl(null);
			return;
		}

		const url = URL.createObjectURL(sourceFile);
		setSourcePreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [sourceFile]);

	const selectedContainerNode = useMemo(
		() => ast?.nodes.find((node) => node.id === selectedId) ?? null,
		[ast, selectedId],
	);
	const selectedComposerBlock = useMemo(() => {
		if (selectedContainerNode?.type !== "section" || !selectedContainerNode.body || !selectedBlockId) return null;
		return findComposerBlock(selectedContainerNode.body.root, selectedBlockId);
	}, [selectedBlockId, selectedContainerNode]);
	const selectedComposerRepeat = useMemo(() => {
		if (selectedContainerNode?.type !== "section" || !selectedContainerNode.body || !selectedRepeatId) return null;
		return findComposerRepeat(selectedContainerNode.body.root, selectedRepeatId);
	}, [selectedContainerNode, selectedRepeatId]);
	const selectedComposerLayout = useMemo(() => {
		if (selectedContainerNode?.type !== "section" || !selectedContainerNode.body || !selectedLayoutId) return null;
		return findComposerLayout(selectedContainerNode.body.root, selectedLayoutId);
	}, [selectedContainerNode, selectedLayoutId]);
	const hasSelectedComposerItem = Boolean(selectedBlockId || selectedRepeatId || selectedLayoutId);
	const isSelectedRootLayout =
		selectedContainerNode?.type === "section" && selectedLayoutId === selectedContainerNode.body?.root.id;
	const selectedNode =
		selectedComposerBlock || selectedComposerRepeat || selectedComposerLayout ? null : selectedContainerNode;
	const isPageSelected = !selectedId && !selectedBlockId && !selectedRepeatId && !selectedLayoutId;
	const previewSelection = useMemo<PreviewSelection>(
		() => ({
			nodeId: selectedId,
			contentId: selectedBlockId ?? selectedRepeatId ?? selectedLayoutId,
		}),
		[selectedBlockId, selectedId, selectedLayoutId, selectedRepeatId],
	);

	useEffect(() => {
		if (previewTab !== "template") return;
		if (selectionOriginRef.current === "preview") return;
		const selectionId = previewSelection.contentId ?? previewSelection.nodeId;
		if (!selectionId) return;
		const frame = window.requestAnimationFrame(() => {
			const target = Array.from(
				previewRef.current?.querySelectorAll<HTMLElement>("[data-template-selection-id]") ?? [],
			).find((element) => element.dataset.templateSelectionId === selectionId);
			target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
		});
		return () => window.cancelAnimationFrame(frame);
	}, [previewSelection, previewTab]);

	if (isLoading || !ast || !template)
		return (
			<div className="p-8 text-muted-foreground">
				<Trans>Loading template editor…</Trans>
			</div>
		);
	const isAiBusy = isPreparingAi || isImproving || isSavingSource;
	const displayedSource = sourceFile
		? { filename: sourceFile.name, mediaType: sourceFile.type, size: sourceFile.size }
		: template.source;
	const displayedSourcePreviewUrl =
		sourcePreviewUrl ?? (!sourceFile && template.source?.mediaType === "application/pdf" ? template.source.url : null);
	const flowStructureNodes = ast.nodes.filter((node): node is TemplateFlowNode => isFlowNode(node));
	const structureGroups =
		ast.layout.preset === "grid" && ast.layout.pageGrid
			? ast.layout.pageGrid.regions.map((region) => ({
					id: region.id,
					label: `Region · ${region.id}`,
					nodes: flowStructureNodes.filter((node) => (node.region ?? node.column) === region.id),
				}))
			: ast.layout.preset === "two-column"
				? ([
						{
							id: "sidebar",
							label: "Sidebar column",
							nodes: flowStructureNodes.filter((node) => node.column === "sidebar"),
						},
						{
							id: "main",
							label: "Main column",
							nodes: flowStructureNodes.filter((node) => node.column === "main"),
						},
					] as const)
				: [{ id: "main", label: "Main column", nodes: flowStructureNodes }];
	const shapeNodes = ast.nodes.filter((node): node is TemplateShapeNode => node.type === "shape");

	const save = async () => {
		const result = templateAstSchema.safeParse(ast);
		if (!result.success) {
			toast.error(result.error.issues[0]?.message ?? "Template is invalid.");
			return false;
		}
		try {
			await updateDraft({ id: templateId, name: name.trim(), draft: result.data });
			await queryClient.invalidateQueries({ queryKey: detailsOptions.queryKey });
			setHasAiSuggestion(false);
			toast.success("Draft saved.");
			return true;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save draft.");
			return false;
		}
	};

	const submitTemplateForReview = async () => {
		if (!(await save())) return;
		try {
			await submitReview({ id: templateId });
			await queryClient.invalidateQueries({ queryKey: detailsOptions.queryKey });
			toast.success("Draft submitted for review.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not submit the draft for review.");
		}
	};

	const publishTemplate = async () => {
		try {
			await publish({ id: templateId });
			await queryClient.invalidateQueries({ queryKey: detailsOptions.queryKey });
			toast.success("A new immutable template version was published.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not publish template.");
		}
	};

	const deleteCurrentTemplate = async () => {
		const confirmed = await confirm(`Delete “${template.name}”?`, {
			description: "This permanently deletes the draft, published versions, and its stored source file.",
			confirmText: "Delete template",
		});
		if (!confirmed) return;

		try {
			await deleteTemplate({ id: templateId });
			await queryClient.invalidateQueries({ queryKey: orpc.customTemplates.list.queryOptions().queryKey });
			toast.success("Template deleted.");
			await navigate({ to: "/dashboard/templates" });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not delete template.");
		}
	};

	const improveWithAi = async (file?: File) => {
		const result = templateAstSchema.safeParse(ast);
		if (!result.success) {
			toast.error(result.error.issues[0]?.message ?? "Template is invalid.");
			return;
		}

		setIsPreparingAi(true);
		try {
			setPreviewTab("template");
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			});
			const preview = previewRef.current ? await capturePreviewFile(previewRef.current) : undefined;
			const improved = await aiImprove({
				id: templateId,
				draft: result.data,
				...(file ? { file } : {}),
				...(preview ? { preview } : {}),
			});
			setAiReview({
				sourceName: file?.name ?? template.source?.filename ?? "Imported source",
				analysisMode: improved.analysisMode,
				summary: improved.summary,
				changes: improved.changes,
				remainingLimitations: improved.remainingLimitations,
			});
			if (improved.changes.length === 0) {
				setHasAiSuggestion(false);
				toast.info("Source comparison did not find any compatible template changes.");
				return;
			}
			setAst(improved.draft);
			setHasAiSuggestion(true);
			setSelectedBlockId(null);
			setSelectedRepeatId(null);
			setSelectedLayoutId(null);
			setSelectedId((current) =>
				current && improved.draft.nodes.some((node) => node.id === current)
					? current
					: (improved.draft.nodes[0]?.id ?? null),
			);
			toast.success(
				`AI prepared ${improved.changes.length} source-aware change${improved.changes.length === 1 ? "" : "s"}. Review before saving.`,
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "AI could not improve this template.");
		} finally {
			setIsPreparingAi(false);
		}
	};

	const runAiImprove = () => {
		if (sourceFile) {
			void improveWithAi(sourceFile);
			return;
		}
		if (template.source) {
			void improveWithAi();
			return;
		}
		sourceSelectionActionRef.current = "improve";
		aiSourceInputRef.current?.click();
	};

	const selectSourceForPreview = () => {
		sourceSelectionActionRef.current = "preview";
		aiSourceInputRef.current?.click();
	};

	const handleSourceSelection = async (file: File) => {
		const action = sourceSelectionActionRef.current;
		setSourceFile(file);
		setAiReview(null);
		try {
			await persistTemplateSource({ id: templateId, file });
			if (action === "improve") {
				await improveWithAi(file);
			} else {
				toast.success("Source file stored. It will be reused for preview and AI Improve.");
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not store the template source.");
		}
	};

	const retireTemplate = async (status: "deprecated" | "archived") => {
		try {
			await changeStatus({ id: templateId, status });
			await queryClient.invalidateQueries({ queryKey: detailsOptions.queryKey });
			toast.success(`Template marked ${status}.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : `Could not mark the template ${status}.`);
		}
	};

	const selectPage = () => {
		setSelectedId(null);
		setSelectedBlockId(null);
		setSelectedRepeatId(null);
		setSelectedLayoutId(null);
	};

	const selectStructureNode = (nodeId: string, origin: "preview" | "structure" = "structure") => {
		selectionOriginRef.current = origin;
		setSelectedId(nodeId);
		setSelectedBlockId(null);
		setSelectedRepeatId(null);
		setSelectedLayoutId(null);
		setPreviewTab("template");
	};

	const selectStructureBlock = (nodeId: string, blockId: string, origin: "preview" | "structure" = "structure") => {
		selectionOriginRef.current = origin;
		setSelectedId(nodeId);
		setSelectedBlockId(blockId);
		setSelectedRepeatId(null);
		setSelectedLayoutId(null);
		setPreviewTab("template");
	};

	const selectStructureRepeat = (nodeId: string, repeatId: string, origin: "preview" | "structure" = "structure") => {
		selectionOriginRef.current = origin;
		setSelectedId(nodeId);
		setSelectedRepeatId(repeatId);
		setSelectedBlockId(null);
		setSelectedLayoutId(null);
		setPreviewTab("template");
	};

	const selectStructureLayout = (nodeId: string, layoutId: string, origin: "preview" | "structure" = "structure") => {
		selectionOriginRef.current = origin;
		setSelectedId(nodeId);
		setSelectedLayoutId(layoutId);
		setSelectedBlockId(null);
		setSelectedRepeatId(null);
		setPreviewTab("template");
	};

	const focusStructureItem = (selectionId: string) => {
		window.requestAnimationFrame(() => {
			const target = Array.from(
				structureRef.current?.querySelectorAll<HTMLElement>("[data-template-tree-selection-id]") ?? [],
			).find((element) => element.dataset.templateTreeSelectionId === selectionId);
			target?.focus({ preventScroll: true });
			target?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
		});
	};

	const selectPreviewTarget = (nodeId: string, contentId: string | null) => {
		const node = ast.nodes.find((entry) => entry.id === nodeId);
		if (!node || !contentId || node.type !== "section" || !node.body) {
			selectStructureNode(nodeId, "preview");
			focusStructureItem(nodeId);
			return;
		}
		if (findComposerBlock(node.body.root, contentId)) {
			selectStructureBlock(nodeId, contentId, "preview");
		} else if (findComposerRepeat(node.body.root, contentId)) {
			selectStructureRepeat(nodeId, contentId, "preview");
		} else if (findComposerLayout(node.body.root, contentId)) {
			selectStructureLayout(nodeId, contentId, "preview");
		} else {
			selectStructureNode(nodeId, "preview");
		}
		focusStructureItem(contentId);
	};

	const updateNode = (patch: Record<string, unknown>) => {
		if (!selectedId) return;
		setAst((current) => {
			if (!current) return current;
			const nodes = current.nodes.map((node) =>
				node.id === selectedId ? templateNodeSchema.parse({ ...node, ...patch }) : node,
			);
			return "column" in patch || "region" in patch ? recomposeTemplate(current, { nodes }) : { ...current, nodes };
		});
	};

	const updateComposerBlock = (blockId: string, patch: Partial<TemplateComposerBlock>) => {
		if (selectedContainerNode?.type !== "section" || !selectedContainerNode.body) return;
		updateNode({
			body: {
				...selectedContainerNode.body,
				root: mapComposerContent(selectedContainerNode.body.root, (block) =>
					block.id === blockId ? { ...block, ...patch } : block,
				),
			},
		});
	};

	const updateComposerRepeat = (repeatId: string, patch: Partial<TemplateComposerRepeat>) => {
		if (selectedContainerNode?.type !== "section" || !selectedContainerNode.body) return;
		updateNode({
			body: {
				...selectedContainerNode.body,
				root: mapComposerRepeats(selectedContainerNode.body.root, (repeat) =>
					repeat.id === repeatId ? { ...repeat, ...patch } : repeat,
				),
			},
		});
	};

	const updateComposerLayout = (layoutId: string, patch: Partial<TemplateComposerLayout>) => {
		if (selectedContainerNode?.type !== "section" || !selectedContainerNode.body) return;
		updateNode({
			body: {
				...selectedContainerNode.body,
				root: mapComposerLayouts(selectedContainerNode.body.root, (layout) =>
					layout.id === layoutId ? { ...layout, ...patch } : layout,
				),
			},
		});
	};

	const updateSelectedComposerLayoutProps = (patch: Partial<TemplateComposerLayout["props"]>) => {
		if (!selectedComposerLayout) return;
		updateComposerLayout(selectedComposerLayout.id, {
			props: { ...selectedComposerLayout.props, ...patch },
		});
	};

	const moveStructureNode = (nodeId: string, direction: -1 | 1) => {
		const activeNode = ast.nodes.find((node) => node.id === nodeId);
		if (!activeNode || !isFlowNode(activeNode)) return;
		const activeGroup = ast.layout.preset === "grid" ? (activeNode.region ?? activeNode.column) : activeNode.column;
		const structureNodes = ast.nodes.filter(
			(node) =>
				(node.type === "header" || node.type === "section") &&
				(ast.layout.preset === "one-column" ||
					(isFlowNode(node) &&
						(ast.layout.preset === "grid" ? (node.region ?? node.column) : node.column) === activeGroup)),
		);
		const structureIndex = structureNodes.findIndex((node) => node.id === nodeId);
		const targetStructureNode = structureNodes[structureIndex + direction];
		if (!targetStructureNode) return;
		const nodes = [...ast.nodes];
		const index = nodes.findIndex((node) => node.id === nodeId);
		const target = nodes.findIndex((node) => node.id === targetStructureNode.id);
		const currentNode = nodes[index];
		const targetNode = nodes[target];
		if (!currentNode || !targetNode) return;
		nodes[index] = targetNode;
		nodes[target] = currentNode;
		setAst(recomposeTemplate(ast, { nodes }));
	};

	const reorderStructureNode = (sourceId: string, targetId: string, position: "before" | "after") => {
		if (sourceId === targetId) return;
		const source = ast.nodes.find((node) => node.id === sourceId);
		const target = ast.nodes.find((node) => node.id === targetId);
		if (!source || !target || !isFlowNode(source) || !isFlowNode(target)) return;
		let movedNode: TemplateFlowNode = source;
		if (ast.layout.preset === "grid") {
			movedNode = { ...source, region: target.region ?? target.column };
		} else if (ast.layout.preset === "two-column") {
			movedNode = { ...source, column: target.column };
		}
		const nodes = ast.nodes.filter((node) => node.id !== sourceId);
		const targetIndex = nodes.findIndex((node) => node.id === targetId);
		nodes.splice(targetIndex + (position === "after" ? 1 : 0), 0, movedNode);
		setAst(recomposeTemplate(ast, { nodes }));
		selectStructureNode(sourceId);
	};

	const moveComposerEntry = (
		nodeId: string,
		sourceContentId: string,
		targetContentId: string,
		position: "before" | "after",
	) => {
		const node = ast.nodes.find((entry) => entry.id === nodeId);
		if (node?.type !== "section" || !node.body) return;
		const nextRoot = reorderComposerContent(node.body.root, sourceContentId, targetContentId, position);
		if (nextRoot === node.body.root) {
			toast.error("This item cannot be moved to that position.");
			return;
		}
		const updatedNode = templateNodeSchema.safeParse({ ...node, body: { ...node.body, root: nextRoot } });
		if (!updatedNode.success) {
			toast.error("That drop would create an invalid section structure.");
			return;
		}
		const nodes = ast.nodes.map((entry) => (entry.id === nodeId ? updatedNode.data : entry));
		setAst(recomposeTemplate(ast, { nodes }));
		selectPreviewTarget(nodeId, sourceContentId);
	};

	const beginTemplateDrag = (event: ReactDragEvent<HTMLElement>, item: TemplateDragItem) => {
		event.stopPropagation();
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", item.kind === "node" ? item.nodeId : item.contentId);
		setDraggedItem(item);
		setDropTarget(null);
	};

	const updateTemplateDropTarget = (
		event: ReactDragEvent<HTMLElement>,
		item: TemplateDragItem,
		position = dragPosition(event),
	) => {
		if (!draggedItem || draggedItem.kind !== item.kind || isSameDragItem(draggedItem, item)) return;
		if (draggedItem.kind === "content" && (item.kind !== "content" || draggedItem.nodeId !== item.nodeId)) return;
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = "move";
		setDropTarget({ ...item, position });
	};

	const dropTemplateItem = (
		event: ReactDragEvent<HTMLElement>,
		item: TemplateDragItem,
		position = dragPosition(event),
	) => {
		if (!draggedItem || draggedItem.kind !== item.kind || isSameDragItem(draggedItem, item)) return;
		event.preventDefault();
		event.stopPropagation();
		if (draggedItem.kind === "node" && item.kind === "node") {
			reorderStructureNode(draggedItem.nodeId, item.nodeId, position);
		} else if (draggedItem.kind === "content" && item.kind === "content" && draggedItem.nodeId === item.nodeId) {
			moveComposerEntry(draggedItem.nodeId, draggedItem.contentId, item.contentId, position);
		}
		setDraggedItem(null);
		setDropTarget(null);
	};

	const endTemplateDrag = () => {
		setDraggedItem(null);
		setDropTarget(null);
	};

	const addNode = () => {
		const id = `section-${generateId()}`;
		const flowDefaults = {
			column: "main" as const,
			visible: true,
			breakBefore: false,
			breakAfter: false,
			breakInside: "avoid" as const,
			keepWithNext: true,
			minPresenceAhead: 24,
			repeatOnPage: false,
			overflow: "split" as const,
		};
		const node: TemplateNode = {
			id,
			type: "section",
			section: sectionToAdd,
			variant: "standard",
			...flowDefaults,
		};
		setAst(recomposeTemplate(ast, { nodes: [...ast.nodes, node] }));
		selectStructureNode(node.id);
	};

	const addComposerItem = () => {
		if (selectedContainerNode?.type !== "section" || !selectedContainerNode.body) {
			toast.error("Select a section or one of its items first.");
			return;
		}
		const targetId = selectedBlockId ?? selectedRepeatId ?? selectedLayoutId ?? selectedContainerNode.body.root.id;
		const useItemBindings = composerEntryIsInsideRepeat(selectedContainerNode.body.root, targetId);
		if (composerItemToAdd === "repeat" && useItemBindings) {
			toast.error("Repeated content cannot be nested inside another repeated item.");
			return;
		}
		const item = createComposerItem(composerItemToAdd, useItemBindings);
		const nextRoot = insertComposerContent(selectedContainerNode.body.root, targetId, item);
		const updatedNode = templateNodeSchema.safeParse({
			...selectedContainerNode,
			body: { ...selectedContainerNode.body, root: nextRoot },
		});
		if (!updatedNode.success) {
			toast.error("This item cannot be added at the selected position.");
			return;
		}
		setAst({
			...ast,
			nodes: ast.nodes.map((node) => (node.id === selectedContainerNode.id ? updatedNode.data : node)),
		});
		if (item.type === "block") {
			selectStructureBlock(selectedContainerNode.id, item.id);
		} else if (item.type === "repeat") {
			selectStructureRepeat(selectedContainerNode.id, item.id);
		} else {
			selectStructureLayout(selectedContainerNode.id, item.id);
		}
		focusStructureItem(item.id);
	};

	const removeSelected = () => {
		const selectedContentId = selectedBlockId ?? selectedRepeatId ?? selectedLayoutId;
		if (selectedContainerNode?.type === "section" && selectedContainerNode.body && selectedContentId) {
			const nextRoot = removeComposerContent(selectedContainerNode.body.root, selectedContentId);
			if (nextRoot === selectedContainerNode.body.root) {
				toast.error("A layout or repeated item must keep at least one child.");
				return;
			}
			const updatedNode = templateNodeSchema.safeParse({
				...selectedContainerNode,
				body: { ...selectedContainerNode.body, root: nextRoot },
			});
			if (!updatedNode.success) {
				toast.error("This item cannot be removed from the current structure.");
				return;
			}
			setAst({
				...ast,
				nodes: ast.nodes.map((node) => (node.id === selectedContainerNode.id ? updatedNode.data : node)),
			});
			selectStructureNode(selectedContainerNode.id);
			return;
		}
		if (!selectedId || ast.nodes.length === 1) return;
		const nodes = ast.nodes.filter((node) => node.id !== selectedId);
		setAst(recomposeTemplate(ast, { nodes }));
		selectPage();
	};

	const setLayoutPreset = (preset: TemplateAst["layout"]["preset"]) => {
		if (preset === "grid") {
			const pageGrid = ast.layout.pageGrid ?? {
				gap: ast.tokens.sectionGap,
				regions: [
					{ id: "sidebar", width: 32, padding: ast.tokens.itemGap, backgroundColor: ast.tokens.sidebarColor },
					{ id: "main", width: 68, padding: 0 },
				],
			};
			setAst(
				recomposeTemplate(ast, {
					layout: { ...ast.layout, preset, pageGrid },
					nodes: ast.nodes.map((node) => (isFlowNode(node) ? { ...node, region: node.region ?? node.column } : node)),
				}),
			);
			return;
		}

		setAst(
			recomposeTemplate(ast, {
				layout: { ...ast.layout, preset },
				nodes: ast.nodes.map((node) => {
					if (!isFlowNode(node)) return node;
					const { region: previousRegion, ...flowNode } = node;
					return {
						...flowNode,
						column:
							preset === "one-column"
								? ("main" as const)
								: /(?:side|rail|aside)/i.test(previousRegion ?? "")
									? ("sidebar" as const)
									: flowNode.column,
					};
				}),
			}),
		);
	};

	const setPageGridRegionCount = (count: number) => {
		const regionIds = ["sidebar", "main", "auxiliary", "rail"].slice(0, count);
		const width = Number((100 / count).toFixed(2));
		const existingRegions = new Map(ast.layout.pageGrid?.regions.map((region) => [region.id, region]) ?? []);
		const regions = regionIds.map((id, index) => ({
			id,
			width: index === count - 1 ? Number((100 - width * (count - 1)).toFixed(2)) : width,
			padding: existingRegions.get(id)?.padding ?? (id === "sidebar" ? ast.tokens.itemGap : 0),
			...(existingRegions.get(id)?.backgroundColor
				? { backgroundColor: existingRegions.get(id)?.backgroundColor }
				: id === "sidebar"
					? { backgroundColor: ast.tokens.sidebarColor }
					: {}),
		}));
		setAst(
			recomposeTemplate(ast, {
				layout: {
					...ast.layout,
					pageGrid: { gap: ast.layout.pageGrid?.gap ?? ast.tokens.sectionGap, regions },
				},
				nodes: ast.nodes.map((node) =>
					isFlowNode(node) && !regionIds.includes(node.region ?? node.column) ? { ...node, region: "main" } : node,
				),
			}),
		);
	};

	const setPageGridRegionWidth = (regionId: string, requestedWidth: number) => {
		const pageGrid = ast.layout.pageGrid;
		if (!pageGrid || pageGrid.regions.length < 2) return;
		const nextWidth = Math.min(100 - 10 * (pageGrid.regions.length - 1), Math.max(10, requestedWidth));
		const otherRegions = pageGrid.regions.filter((region) => region.id !== regionId);
		const equalWidth = Number(((100 - nextWidth) / otherRegions.length).toFixed(2));
		let allocated = 0;
		const nextRegions = pageGrid.regions.map((region) => {
			if (region.id === regionId) return { ...region, width: nextWidth };
			const isLast = region.id === otherRegions.at(-1)?.id;
			const width = isLast ? Number((100 - nextWidth - allocated).toFixed(2)) : equalWidth;
			allocated += width;
			return { ...region, width };
		});
		setAst(
			recomposeTemplate(ast, {
				layout: { ...ast.layout, pageGrid: { ...pageGrid, regions: nextRegions } },
			}),
		);
	};

	const updatePageGrid = (
		update: (pageGrid: NonNullable<TemplateAst["layout"]["pageGrid"]>) => TemplateAst["layout"]["pageGrid"],
	) => {
		const pageGrid = ast.layout.pageGrid;
		if (!pageGrid) return;
		setAst(recomposeTemplate(ast, { layout: { ...ast.layout, pageGrid: update(pageGrid) } }));
	};

	const updatePageGridRegion = (regionId: string, patch: Partial<TemplatePageRegion>) => {
		updatePageGrid((pageGrid) => ({
			...pageGrid,
			regions: pageGrid.regions.map((region) => (region.id === regionId ? { ...region, ...patch } : region)),
		}));
	};

	const clearPageGridRegionBackground = (regionId: string) => {
		updatePageGrid((pageGrid) => ({
			...pageGrid,
			regions: pageGrid.regions.map((region) => {
				if (region.id !== regionId) return region;
				const { backgroundColor: _backgroundColor, ...withoutBackground } = region;
				return withoutBackground;
			}),
		}));
	};

	return (
		<div className="min-h-[calc(100vh-2rem)] space-y-3">
			<input
				ref={aiSourceInputRef}
				className="hidden"
				type="file"
				accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (!file) return;
					void handleSourceSelection(file);
				}}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<Button nativeButton={false} variant="ghost" size="sm" render={<Link to="/dashboard/templates" />}>
					<ArrowLeftIcon />
					<Trans>Templates</Trans>
				</Button>
				<Input
					className="max-w-sm"
					value={name}
					aria-label="Template name"
					onChange={(event) => setName(event.target.value)}
				/>
				<Badge variant={template.status === "published" ? "default" : "secondary"}>{template.status}</Badge>
				<span className="text-muted-foreground text-sm">v{template.currentVersion}</span>
				{hasAiSuggestion && <Badge variant="outline">AI suggestion · unsaved</Badge>}
				<div className="ms-auto flex gap-2">
					{template.status === "draft" && (
						<Button
							variant="outline"
							title="Select the original PDF or DOCX so AI can compare it with the current template preview."
							disabled={isAiBusy || isSaving || !name.trim()}
							onClick={runAiImprove}
						>
							{isAiBusy ? <SpinnerGapIcon className="animate-spin" /> : <SparkleIcon />}
							{isAiBusy ? <Trans>Improving…</Trans> : <Trans>AI Improve</Trans>}
						</Button>
					)}
					<Button
						variant="outline"
						disabled={isSaving || isAiBusy || template.status === "archived" || !name.trim()}
						onClick={() => void save()}
					>
						<FloppyDiskIcon />
						<Trans>Save draft</Trans>
					</Button>
					{template.status === "draft" && (
						<Button
							disabled={isSaving || isAiBusy || isSubmittingReview || !name.trim()}
							onClick={() => void submitTemplateForReview()}
						>
							<CheckCircleIcon />
							<Trans>Submit review</Trans>
						</Button>
					)}
					{template.status === "review" && (
						<Button disabled={isPublishing} onClick={() => void publishTemplate()}>
							<CheckCircleIcon />
							<Trans>Publish version</Trans>
						</Button>
					)}
					{template.status === "published" && (
						<Button variant="outline" disabled={isChangingStatus} onClick={() => void retireTemplate("deprecated")}>
							<Trans>Deprecate</Trans>
						</Button>
					)}
					{template.status === "deprecated" && (
						<Button variant="outline" disabled={isChangingStatus} onClick={() => void retireTemplate("archived")}>
							<Trans>Archive</Trans>
						</Button>
					)}
					<Button
						variant="destructive"
						size="icon"
						aria-label="Delete template"
						title="Delete template"
						disabled={isDeleting || isAiBusy || isSaving}
						onClick={() => void deleteCurrentTemplate()}
					>
						<TrashIcon />
					</Button>
				</div>
			</div>

			{template.compilerReport && <ImportDiagnostics report={template.compilerReport} />}

			<div className="grid items-start gap-3 xl:grid-cols-[290px_minmax(400px,1fr)_300px]">
				<Card className="h-fit xl:sticky xl:top-3">
					<CardHeader>
						<CardTitle className="text-base">
							<Trans>Template structure</Trans>
						</CardTitle>
						<p className="text-muted-foreground text-xs">
							Click an item here or on the preview to inspect it. Drag items in either surface to reorder them.
						</p>
					</CardHeader>
					<CardContent className="space-y-3">
						<div
							ref={structureRef}
							role="tree"
							aria-label="Template structure tree"
							className="max-h-[calc(100vh-190px)] space-y-1 overflow-y-auto pr-1"
						>
							<div>
								<button
									type="button"
									role="treeitem"
									aria-expanded="true"
									aria-selected={isPageSelected}
									data-template-tree-selection-id="page"
									className={`w-full rounded-md border px-3 py-2 text-start ${
										isPageSelected ? "border-primary bg-primary/10" : "bg-muted/20 hover:bg-muted/40"
									}`}
									onClick={selectPage}
								>
									<p className="font-medium text-sm">Page</p>
									<p className="text-muted-foreground text-xs">
										{ast.layout.preset} · {ast.nodes.filter((node) => node.type === "section").length} sections
									</p>
								</button>
								<div className="ml-3 space-y-2 border-l pt-2 pl-2">
									{structureGroups.map((group) => (
										<div key={group.id}>
											<div className="flex items-center gap-2 px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
												<span aria-hidden="true">⌗</span>
												<span>{group.label}</span>
												<Badge variant="outline" className="ms-auto">
													{group.nodes.length}
												</Badge>
											</div>
											<div className="ml-3 space-y-1 border-l py-1 pl-2">
												{group.nodes.length === 0 && (
													<p className="px-2 py-1 text-muted-foreground text-xs">No blocks</p>
												)}
												{group.nodes.map((node) => {
													const movableGroupNodes = group.nodes.filter(
														(entry) => entry.type === "header" || entry.type === "section",
													);
													const moveIndex = movableGroupNodes.findIndex((entry) => entry.id === node.id);
													const canMove = node.type === "header" || node.type === "section";
													const selected =
														selectedId === node.id && !selectedBlockId && !selectedRepeatId && !selectedLayoutId;
													return (
														<div key={node.id}>
															<fieldset
																draggable={canMove}
																data-template-surface="structure"
																data-template-drag-kind={canMove ? "node" : undefined}
																data-template-node-id={node.id}
																className={`m-0 flex min-w-0 items-center gap-1 rounded-md border p-1 ${
																	selected ? "border-primary bg-primary/10" : "bg-background"
																} ${canMove ? dropIndicatorClass(dropTarget, { kind: "node", nodeId: node.id }) : ""} ${
																	canMove && isSameDragItem(draggedItem, { kind: "node", nodeId: node.id })
																		? "opacity-40"
																		: ""
																}`}
																onDragStart={
																	canMove
																		? (event) =>
																				beginTemplateDrag(event, {
																					kind: "node",
																					nodeId: node.id,
																				})
																		: undefined
																}
																onDragOver={
																	canMove
																		? (event) =>
																				updateTemplateDropTarget(event, {
																					kind: "node",
																					nodeId: node.id,
																				})
																		: undefined
																}
																onDrop={
																	canMove
																		? (event) =>
																				dropTemplateItem(event, {
																					kind: "node",
																					nodeId: node.id,
																				})
																		: undefined
																}
																onDragEnd={endTemplateDrag}
															>
																{canMove && (
																	<span aria-hidden="true" className="cursor-grab px-1 opacity-50">
																		⋮⋮
																	</span>
																)}
																<button
																	type="button"
																	role="treeitem"
																	aria-expanded={node.type === "section"}
																	aria-selected={selected}
																	data-template-tree-selection-id={node.id}
																	className="min-w-0 flex-1 truncate px-2 py-1 text-start text-sm"
																	onClick={() => selectStructureNode(node.id)}
																>
																	{nodeLabel(node)}
																</button>
																{canMove && (
																	<>
																		<Button
																			size="icon-xs"
																			variant="ghost"
																			aria-label={`Move ${nodeLabel(node)} up`}
																			disabled={moveIndex === 0}
																			onClick={() => moveStructureNode(node.id, -1)}
																		>
																			<ArrowUpIcon />
																		</Button>
																		<Button
																			size="icon-xs"
																			variant="ghost"
																			aria-label={`Move ${nodeLabel(node)} down`}
																			disabled={moveIndex === movableGroupNodes.length - 1}
																			onClick={() => moveStructureNode(node.id, 1)}
																		>
																			<ArrowDownIcon />
																		</Button>
																	</>
																)}
															</fieldset>
															{node.type === "section" && node.body && (
																<div className="ml-3 border-l py-1 pl-2">
																	<ComposerTreeBranch
																		entry={node.body.root}
																		nodeId={node.id}
																		isRoot
																		selectedBlockId={selectedId === node.id ? selectedBlockId : null}
																		selectedRepeatId={selectedId === node.id ? selectedRepeatId : null}
																		selectedLayoutId={selectedId === node.id ? selectedLayoutId : null}
																		draggedItem={draggedItem}
																		dropTarget={dropTarget}
																		onSelectBlock={selectStructureBlock}
																		onSelectRepeat={selectStructureRepeat}
																		onSelectLayout={selectStructureLayout}
																		onDragStart={beginTemplateDrag}
																		onDragOver={updateTemplateDropTarget}
																		onDrop={dropTemplateItem}
																		onDragEnd={endTemplateDrag}
																	/>
																</div>
															)}
														</div>
													);
												})}
											</div>
										</div>
									))}
									{shapeNodes.length > 0 && (
										<div>
											<div className="px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
												Canvas layers
											</div>
											<div className="ml-3 space-y-1 border-l py-1 pl-2">
												{shapeNodes.map((node) => (
													<button
														key={node.id}
														type="button"
														role="treeitem"
														aria-selected={selectedId === node.id}
														data-template-tree-selection-id={node.id}
														className={`block w-full truncate rounded-md px-2 py-1.5 text-start text-xs ${
															selectedId === node.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
														}`}
														onClick={() => selectStructureNode(node.id)}
													>
														{nodeLabel(node)}
													</button>
												))}
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
						<Separator />
						<div className="grid gap-2">
							<div className="space-y-1">
								<Label htmlFor="template-item-to-add">Item</Label>
								<div className="flex gap-2">
									<select
										id="template-item-to-add"
										aria-label="Item to add"
										className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
										value={composerItemToAdd}
										onChange={(event) => setComposerItemToAdd(event.target.value as ComposerItemKind)}
									>
										{composerItemKinds.map((kind) => (
											<option key={kind} value={kind}>
												{composerItemLabels[kind]}
											</option>
										))}
									</select>
									<Button
										size="sm"
										variant="outline"
										disabled={selectedContainerNode?.type !== "section" || !selectedContainerNode.body}
										onClick={addComposerItem}
									>
										<PlusIcon />
										<Trans>Add item</Trans>
									</Button>
								</div>
								<p className="text-muted-foreground text-xs">
									Select a section, layout, repeated item or content block to choose where the new item is inserted.
								</p>
							</div>
							<div className="space-y-1">
								<Label htmlFor="template-section-to-add">Section</Label>
								<div className="flex gap-2">
									<select
										id="template-section-to-add"
										aria-label="Section to add"
										className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
										value={sectionToAdd}
										onChange={(event) => setSectionToAdd(templateSectionKindSchema.parse(event.target.value))}
									>
										{templateSectionKindSchema.options.map((section) => (
											<option key={section} value={section}>
												{sectionLabels[section]}
											</option>
										))}
									</select>
									<Button size="sm" variant="outline" onClick={addNode}>
										<PlusIcon />
										<Trans>Add section</Trans>
									</Button>
								</div>
							</div>
						</div>
						<Button
							className="w-full"
							variant="destructive"
							size="sm"
							disabled={hasSelectedComposerItem ? isSelectedRootLayout : !selectedNode || ast.nodes.length === 1}
							onClick={removeSelected}
						>
							<TrashIcon />
							{hasSelectedComposerItem ? <Trans>Remove selected item</Trans> : <Trans>Remove selected section</Trans>}
						</Button>
					</CardContent>
				</Card>

				<div className="min-w-0 space-y-3">
					{aiReview && (
						<Card className="border-primary/30 bg-background">
							<CardHeader className="pb-2">
								<div className="flex flex-wrap items-center gap-2">
									<CardTitle className="text-base">AI source comparison</CardTitle>
									<Badge variant={aiReview.analysisMode === "visual" ? "default" : "secondary"}>
										{aiReview.analysisMode === "visual" ? "Visual analysis" : "Structural analysis"}
									</Badge>
									<span className="truncate text-muted-foreground text-xs">{aiReview.sourceName}</span>
								</div>
							</CardHeader>
							<CardContent className="space-y-3 text-sm">
								<p>{aiReview.summary}</p>
								{aiReview.changes.length > 0 && (
									<details open>
										<summary className="cursor-pointer font-medium">
											{aiReview.changes.length} proposed AST changes
										</summary>
										<div className="mt-2 max-h-72 space-y-2 overflow-auto pr-1">
											{aiReview.changes.map((change, index) => (
												<div key={`${change.path}-${index}`} className="rounded-md border p-2">
													<code className="break-all text-xs">{change.path}</code>
													<div className="mt-1 grid gap-1 text-xs sm:grid-cols-2">
														<p className="break-words text-muted-foreground">
															<span className="font-medium text-foreground">Before:</span> {change.before ?? "—"}
														</p>
														<p className="break-words text-muted-foreground">
															<span className="font-medium text-foreground">After:</span> {change.after ?? "—"}
														</p>
													</div>
													<p className="mt-1 text-muted-foreground">{change.reason}</p>
												</div>
											))}
										</div>
									</details>
								)}
								{aiReview.remainingLimitations.length > 0 && (
									<details>
										<summary className="cursor-pointer font-medium">
											Remaining limitations ({aiReview.remainingLimitations.length})
										</summary>
										<ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
											{aiReview.remainingLimitations.map((limitation) => (
												<li key={limitation}>{limitation}</li>
											))}
										</ul>
									</details>
								)}
								{aiReview.changes.length > 0 && (
									<p className="text-muted-foreground text-xs">
										The preview now shows the proposal. It is not persisted until you choose Save draft.
									</p>
								)}
							</CardContent>
						</Card>
					)}
					<Tabs value={previewTab} onValueChange={(value) => setPreviewTab(value as "source" | "template")}>
						<Card className="min-w-0 overflow-hidden">
							<CardHeader className="pb-3">
								<TabsList className="grid w-full grid-cols-2">
									<TabsTrigger value="template">Template preview</TabsTrigger>
									<TabsTrigger value="source">Source input</TabsTrigger>
								</TabsList>
							</CardHeader>
							<CardContent className="p-0">
								<TabsContent value="source">
									<div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
										<div className="min-w-0">
											{displayedSource ? (
												<p className="truncate text-muted-foreground text-xs">
													{displayedSource.filename} · {formatFileSize(displayedSource.size)}
													{sourceFile ? " · stored source" : " · imported source"}
												</p>
											) : (
												<p className="text-muted-foreground text-xs">No source was stored for this older template</p>
											)}
										</div>
										<Button size="sm" variant="outline" disabled={isAiBusy} onClick={selectSourceForPreview}>
											{displayedSource ? "Use different source" : "Select source"}
										</Button>
									</div>
									{displayedSourcePreviewUrl ? (
										<iframe
											title={`Source input preview: ${displayedSource?.filename ?? "PDF"}`}
											className="aspect-[210/297] w-full border-t bg-white"
											src={`${displayedSourcePreviewUrl}#toolbar=0&navpanes=0&view=FitH`}
										/>
									) : displayedSource ? (
										<DocxSourcePreview
											{...(sourceFile ? { file: sourceFile } : {})}
											{...(!sourceFile && template.source ? { url: template.source.url } : {})}
										/>
									) : (
										<div className="flex aspect-[210/297] flex-col items-center justify-center gap-3 border-t bg-muted/30 p-8 text-center">
											<p className="font-medium">No source available</p>
											<p className="max-w-sm text-muted-foreground text-sm">
												This template predates source retention. Select the original file once; it will be stored and
												reused from then on.
											</p>
										</div>
									)}
								</TabsContent>

								<TabsContent value="template" className="space-y-3 border-t p-3 sm:p-4">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<p className="font-medium text-sm">Generated template</p>
											<p className="text-muted-foreground text-xs">Live unsaved editor state</p>
										</div>
										<select
											aria-label="Preview content dataset"
											className="h-9 rounded-md border bg-background px-3 text-sm"
											value={previewMode}
											onChange={(event) => setPreviewMode(event.target.value as PreviewMode)}
										>
											<option value="compact">Compact content</option>
											<option value="standard">Standard content</option>
											<option value="stress">Long-content stress test</option>
										</select>
									</div>
									<LivePreview
										ast={ast}
										mode={previewMode}
										selection={previewSelection}
										draggedItem={draggedItem}
										dropTarget={dropTarget}
										onSelectTarget={selectPreviewTarget}
										onDragStart={beginTemplateDrag}
										onDragOverTarget={(event, item, position) => updateTemplateDropTarget(event, item, position)}
										onDropTarget={(event, item, position) => dropTemplateItem(event, item, position)}
										onDragEnd={endTemplateDrag}
										previewRef={previewRef}
									/>
								</TabsContent>
							</CardContent>
						</Card>
					</Tabs>
				</div>

				<Card className="h-fit xl:sticky xl:top-3">
					<CardHeader>
						<CardTitle className="text-base">{isPageSelected ? "Page properties & tokens" : "Properties"}</CardTitle>
						<p className="text-muted-foreground text-xs">
							{isPageSelected
								? "Page layout and global design tokens"
								: selectedComposerBlock
									? `Content block · ${selectedComposerBlock.binding}`
									: selectedComposerRepeat
										? `Repeated content · ${selectedComposerRepeat.binding}`
										: selectedComposerLayout
											? `Section layout · ${selectedComposerLayout.component}`
											: selectedContainerNode
												? nodeLabel(selectedContainerNode)
												: "Select an item in Template structure"}
						</p>
					</CardHeader>
					<CardContent className="space-y-4">
						{isPageSelected && (
							<div className="space-y-2">
								<Label>Layout preset</Label>
								<select
									className="h-9 w-full rounded-md border bg-background px-2 text-sm"
									value={ast.layout.preset}
									onChange={(event) => setLayoutPreset(event.target.value as TemplateAst["layout"]["preset"])}
								>
									<option value="one-column">One column</option>
									<option value="two-column">Two columns</option>
									<option value="grid">Custom page grid</option>
								</select>
							</div>
						)}
						{isPageSelected && ast.layout.preset === "two-column" && (
							<div className="space-y-2">
								<Label htmlFor="template-page-column-gap">Column gap</Label>
								<Input
									id="template-page-column-gap"
									aria-label="Page column gap"
									type="number"
									min={0}
									max={40}
									value={ast.layout.columnGap ?? ast.page.root.props.gap ?? 18}
									onChange={(event) =>
										setAst(
											recomposeTemplate(ast, {
												layout: {
													...ast.layout,
													columnGap: Math.min(40, Math.max(0, Number(event.target.value))),
												},
											}),
										)
									}
								/>
								<p className="text-muted-foreground text-xs">
									Horizontal space between the sidebar and main content columns.
								</p>
							</div>
						)}
						{isPageSelected && ast.layout.preset === "grid" && ast.layout.pageGrid && (
							<div className="space-y-3 rounded-lg border bg-muted/30 p-3">
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label>Page regions</Label>
										<select
											aria-label="Page regions"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={ast.layout.pageGrid.regions.length}
											onChange={(event) => setPageGridRegionCount(Number(event.target.value))}
										>
											<option value={2}>2 regions</option>
											<option value={3}>3 regions</option>
											<option value={4}>4 regions</option>
										</select>
									</div>
									<div className="space-y-2">
										<Label>Region gap</Label>
										<Input
											type="number"
											min={0}
											max={40}
											value={ast.layout.pageGrid.gap}
											onChange={(event) =>
												updatePageGrid((pageGrid) => ({ ...pageGrid, gap: Number(event.target.value) }))
											}
										/>
									</div>
								</div>
								{ast.layout.pageGrid.regions.map((region, index) => (
									<div key={region.id} className="grid grid-cols-[1fr_84px_72px] items-end gap-2">
										<div className="space-y-1">
											<Label>Region {index + 1}</Label>
											<Input value={region.id} disabled />
										</div>
										<div className="space-y-1">
											<Label>Width %</Label>
											<Input
												type="number"
												min={10}
												max={100}
												value={region.width}
												onChange={(event) => setPageGridRegionWidth(region.id, Number(event.target.value))}
											/>
										</div>
										<div className="space-y-1">
											<Label>Padding</Label>
											<Input
												type="number"
												min={0}
												max={32}
												value={region.padding}
												onChange={(event) => updatePageGridRegion(region.id, { padding: Number(event.target.value) })}
											/>
										</div>
										<div className="col-span-3 space-y-1">
											<Label>Background</Label>
											<div className="flex items-center gap-2">
												<Input
													type="color"
													className="w-16 shrink-0"
													value={region.backgroundColor ?? ast.tokens.backgroundColor}
													onChange={(event) => updatePageGridRegion(region.id, { backgroundColor: event.target.value })}
												/>
												<Button
													size="sm"
													variant="outline"
													disabled={!region.backgroundColor}
													onClick={() => clearPageGridRegionBackground(region.id)}
												>
													Use page color
												</Button>
											</div>
										</div>
									</div>
								))}
								<p className="text-muted-foreground text-xs">
									Region widths should total 100%. Each node can be assigned independently below.
								</p>
							</div>
						)}

						{(selectedComposerBlock?.component === "heading" || selectedNode?.type === "section") && (
							<>
								<Separator />
								<div>
									<p className="font-medium">Heading color token</p>
									<p className="text-muted-foreground text-xs">
										Global token shared by section headings in preview and exported PDF.
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Input
										aria-label="Heading color token"
										type="color"
										className="w-16 shrink-0"
										value={ast.tokens.headingColor ?? ast.tokens.textColor}
										onChange={(event) =>
											setAst({ ...ast, tokens: { ...ast.tokens, headingColor: event.target.value } })
										}
									/>
									<Input
										aria-label="Heading color hex"
										className="min-w-0 font-mono"
										value={ast.tokens.headingColor ?? ast.tokens.textColor}
										onChange={(event) => {
											if (!/^#[0-9a-f]{6}$/i.test(event.target.value)) return;
											setAst({ ...ast, tokens: { ...ast.tokens, headingColor: event.target.value } });
										}}
									/>
									<Button
										size="sm"
										variant="outline"
										disabled={!ast.tokens.headingColor}
										onClick={() => setAst({ ...ast, tokens: { ...ast.tokens, headingColor: undefined } })}
									>
										Use text token
									</Button>
								</div>
							</>
						)}

						{selectedComposerLayout && selectedContainerNode?.type === "section" && (
							<>
								<Separator />
								<div>
									<p className="font-medium">Section layout</p>
									<p className="text-muted-foreground text-xs">
										{nodeLabel(selectedContainerNode)} → {selectedComposerLayout.id}
									</p>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label>Component</Label>
										<select
											aria-label="Section layout component"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={selectedComposerLayout.component}
											onChange={(event) =>
												updateComposerLayout(selectedComposerLayout.id, {
													component: event.target.value as TemplateComposerLayout["component"],
												})
											}
										>
											<option value="stack">Stack</option>
											<option value="row">Row</option>
											<option value="grid">Grid</option>
											<option value="columns">Columns</option>
											<option value="box">Box</option>
											<option value="table">Table</option>
											<option value="table-row">Table row</option>
											<option value="table-cell">Table cell</option>
										</select>
									</div>
									<div className="space-y-2">
										<Label>Direction</Label>
										<select
											aria-label="Section layout direction"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={selectedComposerLayout.props.direction ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													direction: (event.target.value || undefined) as
														| TemplateComposerLayout["props"]["direction"]
														| undefined,
												})
											}
										>
											<option value="">Auto</option>
											<option value="vertical">Vertical</option>
											<option value="horizontal">Horizontal</option>
										</select>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label>Grid columns</Label>
										<Input
											type="number"
											min={1}
											max={6}
											value={selectedComposerLayout.props.columns ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													columns: event.target.value ? Number(event.target.value) : undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Width %</Label>
										<Input
											type="number"
											min={5}
											max={100}
											value={selectedComposerLayout.props.width ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													width: event.target.value ? Number(event.target.value) : undefined,
												})
											}
										/>
									</div>
								</div>
								<div className="grid grid-cols-3 gap-2">
									<div className="space-y-2">
										<Label>Gap</Label>
										<Input
											type="number"
											min={0}
											max={40}
											value={selectedComposerLayout.props.gap ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													gap: event.target.value ? Number(event.target.value) : undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Row gap</Label>
										<Input
											type="number"
											min={0}
											max={40}
											value={selectedComposerLayout.props.rowGap ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													rowGap: event.target.value ? Number(event.target.value) : undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Column gap</Label>
										<Input
											type="number"
											min={0}
											max={40}
											value={selectedComposerLayout.props.columnGap ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													columnGap: event.target.value ? Number(event.target.value) : undefined,
												})
											}
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label>Padding</Label>
										<Input
											type="number"
											min={0}
											max={48}
											value={selectedComposerLayout.props.padding ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													padding: event.target.value ? Number(event.target.value) : undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Radius</Label>
										<Input
											type="number"
											min={0}
											max={32}
											value={selectedComposerLayout.props.radius ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													radius: event.target.value ? Number(event.target.value) : undefined,
												})
											}
										/>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label>Align items</Label>
										<select
											aria-label="Section layout alignment"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={selectedComposerLayout.props.align ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													align: (event.target.value || undefined) as
														| TemplateComposerLayout["props"]["align"]
														| undefined,
												})
											}
										>
											<option value="">Default</option>
											<option value="start">Start</option>
											<option value="center">Center</option>
											<option value="end">End</option>
											<option value="stretch">Stretch</option>
										</select>
									</div>
									<div className="space-y-2">
										<Label>Justify</Label>
										<select
											aria-label="Section layout justification"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={selectedComposerLayout.props.justify ?? ""}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													justify: (event.target.value || undefined) as
														| TemplateComposerLayout["props"]["justify"]
														| undefined,
												})
											}
										>
											<option value="">Default</option>
											<option value="start">Start</option>
											<option value="center">Center</option>
											<option value="end">End</option>
											<option value="between">Space between</option>
										</select>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label>Background</Label>
										<select
											aria-label="Section layout background"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={selectedComposerLayout.props.background ?? "transparent"}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													background: event.target.value as NonNullable<TemplateComposerLayout["props"]["background"]>,
												})
											}
										>
											<option value="transparent">Transparent</option>
											<option value="page">Page</option>
											<option value="sidebar">Sidebar</option>
											<option value="primary">Primary</option>
										</select>
									</div>
									<div className="space-y-2">
										<Label>Border</Label>
										<select
											aria-label="Section layout border"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={selectedComposerLayout.props.border ?? "none"}
											onChange={(event) =>
												updateSelectedComposerLayoutProps({
													border: event.target.value as NonNullable<TemplateComposerLayout["props"]["border"]>,
												})
											}
										>
											<option value="none">None</option>
											<option value="solid">Solid</option>
											<option value="divider">Divider</option>
										</select>
									</div>
								</div>
								<div className="space-y-2">
									<Label>Custom background</Label>
									<div className="flex items-center gap-2">
										<Input
											type="color"
											className="w-16 shrink-0"
											value={selectedComposerLayout.props.backgroundColor ?? ast.tokens.backgroundColor}
											onChange={(event) => updateSelectedComposerLayoutProps({ backgroundColor: event.target.value })}
										/>
										<Button
											size="sm"
											variant="outline"
											disabled={!selectedComposerLayout.props.backgroundColor}
											onClick={() => updateSelectedComposerLayoutProps({ backgroundColor: undefined })}
										>
											Use token
										</Button>
									</div>
								</div>
								<p className="text-muted-foreground text-xs">
									These settings apply only to this layout node and its child blocks.
								</p>
							</>
						)}

						{selectedComposerRepeat && selectedContainerNode?.type === "section" && (
							<>
								<Separator />
								<div>
									<p className="font-medium">Repeated content block</p>
									<p className="text-muted-foreground text-xs">
										{nodeLabel(selectedContainerNode)} → {selectedComposerRepeat.binding}
									</p>
								</div>
								<div className="space-y-2">
									<Label>Block label</Label>
									<Input
										value={selectedComposerRepeat.label ?? ""}
										placeholder="e.g. Experience item"
										onChange={(event) =>
											updateComposerRepeat(selectedComposerRepeat.id, {
												label: event.target.value || undefined,
											})
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Item marker</Label>
									<select
										aria-label="Repeated content item marker"
										className="h-9 w-full rounded-md border bg-background px-2 text-sm"
										value={selectedComposerRepeat.itemMarker ?? "none"}
										onChange={(event) =>
											updateComposerRepeat(selectedComposerRepeat.id, {
												itemMarker: event.target.value as NonNullable<TemplateComposerRepeat["itemMarker"]>,
											})
										}
									>
										<option value="none">None</option>
										<option value="number">Numbered (1, 2, 3)</option>
										<option value="bullet">Bullet</option>
									</select>
									<p className="text-muted-foreground text-xs">
										Each resume item repeats the dynamic field blocks nested under this group.
									</p>
								</div>
							</>
						)}

						{selectedComposerBlock && selectedContainerNode?.type === "section" && (
							<>
								<Separator />
								<div>
									<p className="font-medium">Content block</p>
									<p className="text-muted-foreground text-xs">
										{nodeLabel(selectedContainerNode)} → {selectedComposerBlock.binding}
									</p>
								</div>
								<div className="space-y-2">
									<Label>Component</Label>
									<select
										aria-label="Content block component"
										className="h-9 w-full rounded-md border bg-background px-2 text-sm"
										value={selectedComposerBlock.component}
										onChange={(event) =>
											updateComposerBlock(selectedComposerBlock.id, {
												component: event.target.value as TemplateComposerBlock["component"],
											})
										}
									>
										{["heading", "text", "rich-text", "meta", "badge", "list", "progress", "image", "contact"].map(
											(component) => (
												<option key={component} value={component}>
													{component}
												</option>
											),
										)}
									</select>
								</div>
								<div className="space-y-2">
									<Label>Data mapping</Label>
									<select
										aria-label="Content block data mapping"
										className="h-9 w-full rounded-md border bg-background px-2 text-sm"
										value={selectedComposerBlock.binding}
										onChange={(event) =>
											updateComposerBlock(selectedComposerBlock.id, {
												binding: event.target.value as TemplateComposerBlock["binding"],
												...(event.target.value === "literal"
													? { literal: selectedComposerBlock.literal ?? "Label" }
													: {}),
											})
										}
									>
										{[
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
										].map((binding) => (
											<option key={binding} value={binding}>
												{binding}
											</option>
										))}
									</select>
									<p className="text-muted-foreground text-xs">
										This binding is produced by deterministic Parse + Mapping. Changing it affects preview and PDF
										output.
									</p>
								</div>
								{selectedComposerBlock.binding === "literal" && (
									<div className="space-y-2">
										<Label>Cell content</Label>
										<Input
											aria-label="Literal cell content"
											value={selectedComposerBlock.literal ?? ""}
											onChange={(event) =>
												updateComposerBlock(selectedComposerBlock.id, {
													literal: event.target.value,
												})
											}
										/>
										<p className="text-muted-foreground text-xs">
											Literal content is stored in this table cell instead of being mapped from resume data.
										</p>
									</div>
								)}
								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label>Text prefix</Label>
										<Input
											value={selectedComposerBlock.prefix ?? ""}
											placeholder="e.g. Technologies: "
											onChange={(event) =>
												updateComposerBlock(selectedComposerBlock.id, {
													prefix: event.target.value || undefined,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Text suffix</Label>
										<Input
											value={selectedComposerBlock.suffix ?? ""}
											placeholder="e.g. :"
											onChange={(event) =>
												updateComposerBlock(selectedComposerBlock.id, {
													suffix: event.target.value || undefined,
												})
											}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label>Visual variant</Label>
									<select
										aria-label="Content block visual variant"
										className="h-9 w-full rounded-md border bg-background px-2 text-sm"
										value={selectedComposerBlock.variant}
										onChange={(event) =>
											updateComposerBlock(selectedComposerBlock.id, {
												variant: event.target.value as TemplateComposerBlock["variant"],
											})
										}
									>
										{["plain", "strong", "muted", "accent", "pill", "bullet", "compact"].map((variant) => (
											<option key={variant} value={variant}>
												{variant}
											</option>
										))}
									</select>
								</div>
								<div className="flex items-center gap-2 text-sm">
									<Checkbox
										id="template-content-block-visible"
										checked={selectedComposerBlock.visible}
										onCheckedChange={(checked) =>
											updateComposerBlock(selectedComposerBlock.id, { visible: checked === true })
										}
									/>
									<Label htmlFor="template-content-block-visible">Visible</Label>
								</div>
							</>
						)}

						{selectedNode && (
							<>
								<Separator />
								<p className="font-medium">{nodeLabel(selectedNode)}</p>
								{isFlowNode(selectedNode) && (
									<div className="space-y-2">
										<Label>{ast.layout.preset === "grid" ? "Page region" : "Column"}</Label>
										<select
											aria-label={ast.layout.preset === "grid" ? "Page region" : "Column"}
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={
												ast.layout.preset === "grid"
													? (selectedNode.region ?? selectedNode.column)
													: selectedNode.column
											}
											disabled={ast.layout.preset === "one-column"}
											onChange={(event) =>
												updateNode(
													ast.layout.preset === "grid"
														? { region: event.target.value }
														: { column: event.target.value, region: undefined },
												)
											}
										>
											{ast.layout.preset === "grid" ? (
												ast.layout.pageGrid?.regions.map((region) => (
													<option key={region.id} value={region.id}>
														{region.id}
													</option>
												))
											) : (
												<>
													<option value="main">Main</option>
													<option value="sidebar">Sidebar</option>
												</>
											)}
										</select>
									</div>
								)}
								{selectedNode.type === "section" && (
									<>
										<div className="space-y-2">
											<Label>Source heading</Label>
											<Input
												value={selectedNode.title ?? ""}
												placeholder={sectionLabels[selectedNode.section]}
												onChange={(event) => updateNode({ title: event.target.value || undefined })}
											/>
										</div>
										<div className="space-y-2">
											<Label>Variant</Label>
											<select
												className="h-9 w-full rounded-md border bg-background px-2 text-sm"
												value={selectedNode.variant}
												onChange={(event) => updateNode({ variant: event.target.value })}
											>
												{templateSectionComponentRegistry[selectedNode.section].supportedVariants.map((variant) => (
													<option key={variant} value={variant}>
														{sectionVariantLabels[variant]}
													</option>
												))}
											</select>
										</div>
										{selectedNode.body && (
											<div className="space-y-3 rounded-lg border bg-muted/30 p-3">
												<div>
													<p className="font-medium text-sm">Composer body</p>
													<p className="text-muted-foreground text-xs">
														Section controls layout; ordered blocks control bound content.
													</p>
												</div>
												<div className="space-y-1">
													<Label>Section layout component</Label>
													<select
														className="h-9 w-full rounded-md border bg-background px-2 text-sm"
														value={selectedNode.body.component}
														onChange={(event) =>
															updateNode({
																body: { ...selectedNode.body, component: event.target.value },
															})
														}
													>
														<option value="flow">Flow</option>
														<option value="timeline">Timeline</option>
														<option value="cards">Cards</option>
														<option value="tags">Tags</option>
														<option value="table">Table</option>
														<option value="list">List</option>
													</select>
												</div>
												<p className="text-muted-foreground text-xs">
													{collectComposerBlocks(selectedNode.body.root).length} content blocks. Select a child block in
													Template structure to edit its component and data mapping.
												</p>
											</div>
										)}
										<div className="space-y-2 rounded-lg border bg-muted/30 p-3">
											<p className="font-medium text-sm">Section item layout</p>
											<div className="grid grid-cols-3 gap-2">
												<div className="space-y-1">
													<Label>Columns</Label>
													<Input
														type="number"
														min={1}
														max={6}
														value={selectedNode.itemLayout?.columns ?? 1}
														onChange={(event) =>
															updateNode({
																itemLayout: {
																	columns: Number(event.target.value),
																	columnGap: selectedNode.itemLayout?.columnGap ?? ast.tokens.itemGap,
																	rowGap: selectedNode.itemLayout?.rowGap ?? ast.tokens.itemGap,
																},
															})
														}
													/>
												</div>
												<div className="space-y-1">
													<Label>Column gap</Label>
													<Input
														type="number"
														min={0}
														max={32}
														value={selectedNode.itemLayout?.columnGap ?? ast.tokens.itemGap}
														onChange={(event) =>
															updateNode({
																itemLayout: {
																	columns: selectedNode.itemLayout?.columns ?? 1,
																	columnGap: Number(event.target.value),
																	rowGap: selectedNode.itemLayout?.rowGap ?? ast.tokens.itemGap,
																},
															})
														}
													/>
												</div>
												<div className="space-y-1">
													<Label>Row gap</Label>
													<Input
														type="number"
														min={0}
														max={32}
														value={selectedNode.itemLayout?.rowGap ?? ast.tokens.itemGap}
														onChange={(event) =>
															updateNode({
																itemLayout: {
																	columns: selectedNode.itemLayout?.columns ?? 1,
																	columnGap: selectedNode.itemLayout?.columnGap ?? ast.tokens.itemGap,
																	rowGap: Number(event.target.value),
																},
															})
														}
													/>
												</div>
											</div>
										</div>
										<div className="space-y-2 rounded-lg border bg-muted/30 p-3">
											<p className="font-medium text-sm">Section components</p>
											<div className="space-y-1">
												<Label>Heading</Label>
												<select
													className="h-9 w-full rounded-md border bg-background px-2 text-sm"
													value={selectedNode.appearance?.heading ?? "underline"}
													onChange={(event) =>
														updateNode({
															appearance: {
																heading: event.target.value,
																itemHeader: selectedNode.appearance?.itemHeader ?? "split",
																itemDecoration: selectedNode.appearance?.itemDecoration ?? "none",
															},
														})
													}
												>
													<option value="underline">Underline</option>
													<option value="plain">Plain</option>
													<option value="filled">Filled bar</option>
													<option value="badge">Badge</option>
													<option value="hidden">Hidden</option>
												</select>
											</div>
											<div className="space-y-1">
												<Label>Item header</Label>
												<select
													className="h-9 w-full rounded-md border bg-background px-2 text-sm"
													value={selectedNode.appearance?.itemHeader ?? "split"}
													onChange={(event) =>
														updateNode({
															appearance: {
																heading: selectedNode.appearance?.heading ?? "underline",
																itemHeader: event.target.value,
																itemDecoration: selectedNode.appearance?.itemDecoration ?? "none",
															},
														})
													}
												>
													<option value="split">Split</option>
													<option value="stacked">Stacked</option>
													<option value="inline">Inline</option>
												</select>
											</div>
											<div className="space-y-1">
												<Label>Item decoration</Label>
												<select
													className="h-9 w-full rounded-md border bg-background px-2 text-sm"
													value={selectedNode.appearance?.itemDecoration ?? "none"}
													onChange={(event) =>
														updateNode({
															appearance: {
																heading: selectedNode.appearance?.heading ?? "underline",
																itemHeader: selectedNode.appearance?.itemHeader ?? "split",
																itemDecoration: event.target.value,
															},
														})
													}
												>
													<option value="none">None</option>
													<option value="divider">Divider</option>
													<option value="border">Border</option>
													<option value="card">Card</option>
												</select>
											</div>
										</div>
									</>
								)}
								{selectedNode.type === "header" && (
									<>
										<select
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={selectedNode.variant}
											onChange={(event) => updateNode({ variant: event.target.value })}
										>
											<option value="standard">Standard</option>
											<option value="compact">Compact</option>
											<option value="sidebar">Sidebar</option>
											<option value="split">Split</option>
										</select>
										<div className="flex items-center gap-2">
											<Checkbox
												id="template-header-picture"
												checked={selectedNode.showPicture}
												onCheckedChange={(checked) => updateNode({ showPicture: checked === true })}
											/>
											<Label htmlFor="template-header-picture">Show picture</Label>
										</div>
										<div className="flex items-center gap-2">
											<Checkbox
												id="template-header-contact"
												checked={selectedNode.showContact}
												onCheckedChange={(checked) => updateNode({ showContact: checked === true })}
											/>
											<Label htmlFor="template-header-contact">Show contact</Label>
										</div>
									</>
								)}
								{selectedNode.type === "divider" && (
									<div className="grid grid-cols-2 gap-2">
										<Input
											type="color"
											value={selectedNode.color}
											onChange={(event) => updateNode({ color: event.target.value })}
										/>
										<Input
											aria-label="Divider thickness"
											type="number"
											min={0.5}
											max={8}
											step={0.5}
											value={selectedNode.thickness}
											onChange={(event) => updateNode({ thickness: Number(event.target.value) })}
										/>
										<select
											className="h-9 rounded-md border bg-background px-2 text-sm"
											value={selectedNode.style}
											onChange={(event) => updateNode({ style: event.target.value })}
										>
											<option value="solid">Solid</option>
											<option value="dashed">Dashed</option>
											<option value="dotted">Dotted</option>
										</select>
									</div>
								)}
								{selectedNode.type === "spacer" && (
									<Input
										type="number"
										min={2}
										max={120}
										value={selectedNode.height}
										onChange={(event) => updateNode({ height: Number(event.target.value) })}
									/>
								)}
								{selectedNode.type === "shape" && (
									<div className="grid grid-cols-2 gap-2">
										<select
											className="h-9 rounded-md border bg-background px-2 text-sm"
											value={selectedNode.shape}
											onChange={(event) => updateNode({ shape: event.target.value })}
										>
											<option value="rectangle">Rectangle</option>
											<option value="circle">Circle</option>
										</select>
										{(["x", "y", "width", "height", "rotation", "opacity", "zIndex"] as const).map((field) => (
											<div key={field} className="space-y-1">
												<Label>{field}</Label>
												<Input
													type="number"
													step={field === "opacity" ? 0.05 : 1}
													value={selectedNode[field]}
													onChange={(event) => updateNode({ [field]: Number(event.target.value) })}
												/>
											</div>
										))}
										<Input
											type="color"
											value={selectedNode.color}
											onChange={(event) => updateNode({ color: event.target.value })}
										/>
										<Input
											type="number"
											min={0}
											max={999}
											value={selectedNode.radius}
											aria-label="Shape radius"
											onChange={(event) => updateNode({ radius: Number(event.target.value) })}
										/>
									</div>
								)}
								<div className="flex items-center gap-2 text-sm">
									<Checkbox
										id="template-node-visible"
										checked={selectedNode.visible}
										onCheckedChange={(checked) => updateNode({ visible: checked === true })}
									/>
									<Label htmlFor="template-node-visible">Visible</Label>
								</div>
								<div className="flex items-center gap-2 text-sm">
									<Checkbox
										id="template-node-repeat"
										checked={selectedNode.repeatOnPage}
										onCheckedChange={(checked) => updateNode({ repeatOnPage: checked === true })}
									/>
									<Label htmlFor="template-node-repeat">Repeat on every page</Label>
								</div>
								{isFlowNode(selectedNode) && (
									<div className="flex items-center gap-2 text-sm">
										<Checkbox
											id="template-node-keep-with-next"
											checked={selectedNode.keepWithNext}
											onCheckedChange={(checked) => updateNode({ keepWithNext: checked === true })}
										/>
										<Label htmlFor="template-node-keep-with-next">Keep with next</Label>
									</div>
								)}
								{isFlowNode(selectedNode) && (
									<div className="grid grid-cols-2 gap-2">
										<div className="col-span-2 flex items-center gap-2">
											<Checkbox
												id="template-node-avoid-split"
												checked={selectedNode.breakInside === "avoid"}
												onCheckedChange={(checked) => updateNode({ breakInside: checked === true ? "avoid" : "auto" })}
											/>
											<Label htmlFor="template-node-avoid-split">Avoid splitting inside node</Label>
										</div>
										<div className="flex items-center gap-2">
											<Checkbox
												id="template-node-break-before"
												checked={selectedNode.breakBefore}
												onCheckedChange={(checked) => updateNode({ breakBefore: checked === true })}
											/>
											<Label htmlFor="template-node-break-before">Break before</Label>
										</div>
										<div className="flex items-center gap-2">
											<Checkbox
												id="template-node-break-after"
												checked={selectedNode.breakAfter}
												onCheckedChange={(checked) => updateNode({ breakAfter: checked === true })}
											/>
											<Label htmlFor="template-node-break-after">Break after</Label>
										</div>
										<Input
											type="number"
											min={0}
											max={240}
											value={selectedNode.minPresenceAhead}
											aria-label="Minimum presence ahead"
											onChange={(event) => updateNode({ minPresenceAhead: Number(event.target.value) })}
										/>
										<select
											className="h-9 rounded-md border bg-background px-2 text-sm"
											value={selectedNode.overflow}
											onChange={(event) => updateNode({ overflow: event.target.value })}
										>
											<option value="split">Split</option>
											<option value="clip">Clip</option>
											<option value="shrink">Shrink</option>
											<option value="error">Error</option>
										</select>
									</div>
								)}
							</>
						)}

						{isPageSelected && (
							<>
								<Separator />
								<div>
									<p className="font-medium text-sm">Global design tokens</p>
									<p className="text-muted-foreground text-xs">
										These values apply to the whole page, so they are hidden while editing a section or content block.
									</p>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-2">
										<Label>Primary</Label>
										<Input
											type="color"
											value={ast.tokens.primaryColor}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, primaryColor: event.target.value } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Text</Label>
										<Input
											type="color"
											value={ast.tokens.textColor}
											onChange={(event) => setAst({ ...ast, tokens: { ...ast.tokens, textColor: event.target.value } })}
										/>
									</div>
									<div className="space-y-2">
										<Label>Heading</Label>
										<Input
											aria-label="Heading color token"
											type="color"
											value={ast.tokens.headingColor ?? ast.tokens.textColor}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, headingColor: event.target.value } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Background</Label>
										<Input
											type="color"
											value={ast.tokens.backgroundColor}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, backgroundColor: event.target.value } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Sidebar background</Label>
										<Input
											type="color"
											disabled={ast.layout.preset !== "two-column"}
											value={ast.tokens.sidebarColor}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, sidebarColor: event.target.value } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Heading font</Label>
										<select
											aria-label="Heading font"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={ast.tokens.headingFont}
											onChange={(event) =>
												setAst({
													...ast,
													tokens: {
														...ast.tokens,
														headingFont: event.target.value as TemplateAst["tokens"]["headingFont"],
													},
												})
											}
										>
											<option value="Inter">Inter</option>
											<option value="IBM Plex Serif">IBM Plex Serif</option>
											<option value="Lora">Lora</option>
										</select>
									</div>
									<div className="space-y-2">
										<Label>Body font</Label>
										<select
											aria-label="Body font"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											value={ast.tokens.bodyFont}
											onChange={(event) =>
												setAst({
													...ast,
													tokens: { ...ast.tokens, bodyFont: event.target.value as TemplateAst["tokens"]["bodyFont"] },
												})
											}
										>
											<option value="Inter">Inter</option>
											<option value="IBM Plex Serif">IBM Plex Serif</option>
											<option value="Lora">Lora</option>
										</select>
									</div>
									<div className="space-y-2">
										<Label>Body size</Label>
										<Input
											aria-label="Body size"
											type="number"
											min={8}
											max={14}
											value={ast.tokens.bodySize}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, bodySize: Number(event.target.value) } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Section gap</Label>
										<Input
											aria-label="Section gap"
											type="number"
											min={8}
											max={32}
											value={ast.tokens.sectionGap}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, sectionGap: Number(event.target.value) } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Item gap</Label>
										<Input
											aria-label="Item gap"
											type="number"
											min={2}
											max={20}
											value={ast.tokens.itemGap}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, itemGap: Number(event.target.value) } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Radius</Label>
										<Input
											aria-label="Radius"
											type="number"
											min={0}
											max={24}
											value={ast.tokens.radius}
											onChange={(event) =>
												setAst({ ...ast, tokens: { ...ast.tokens, radius: Number(event.target.value) } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Page padding</Label>
										<Input
											aria-label="Page padding"
											type="number"
											min={16}
											max={64}
											value={ast.layout.pagePadding}
											onChange={(event) =>
												setAst({ ...ast, layout: { ...ast.layout, pagePadding: Number(event.target.value) } })
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Sidebar %</Label>
										<Input
											aria-label="Sidebar width"
											type="number"
											min={20}
											max={45}
											disabled={ast.layout.preset !== "two-column"}
											value={ast.layout.sidebarWidth}
											onChange={(event) =>
												setAst(
													recomposeTemplate(ast, {
														layout: {
															...ast.layout,
															sidebarWidth: Number(event.target.value),
														},
													}),
												)
											}
										/>
									</div>
									<div className="space-y-2">
										<Label>Sidebar position</Label>
										<select
											aria-label="Sidebar position"
											className="h-9 w-full rounded-md border bg-background px-2 text-sm"
											disabled={ast.layout.preset !== "two-column"}
											value={ast.layout.sidebarPosition}
											onChange={(event) =>
												setAst(
													recomposeTemplate(ast, {
														layout: {
															...ast.layout,
															sidebarPosition: event.target.value as TemplateAst["layout"]["sidebarPosition"],
														},
													}),
												)
											}
										>
											<option value="left">Left</option>
											<option value="right">Right</option>
										</select>
									</div>
								</div>

								{template.versions.length > 0 && (
									<>
										<Separator />
										<div>
											<p className="mb-2 font-medium">
												<Trans>Published versions</Trans>
											</p>
											<div className="space-y-1">
												{template.versions.map((version) => (
													<div key={version.id} className="flex justify-between rounded border px-2 py-1 text-sm">
														<span>v{version.version}</span>
														<span className="text-muted-foreground">{version.createdAt.toLocaleDateString()}</span>
													</div>
												))}
											</div>
										</div>
									</>
								)}
							</>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
