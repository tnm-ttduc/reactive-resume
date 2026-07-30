import type { CandidateProfile } from "@reactive-resume/schema/candidate/data";
import type { CustomSectionType } from "@reactive-resume/schema/resume/data";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { buildAiExtractionTemplate } from "@reactive-resume/ai/resume/extraction-template";
import { candidateProfileSchema } from "@reactive-resume/schema/candidate/data";
import { sectionTypeSchema } from "@reactive-resume/schema/resume/data";
import { defaultSectionIconNames } from "@reactive-resume/schema/resume/section-icons";
import { Button } from "@reactive-resume/ui/components/button";
import { Checkbox } from "@reactive-resume/ui/components/checkbox";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { Switch } from "@reactive-resume/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { Textarea } from "@reactive-resume/ui/components/textarea";
import { generateId } from "@reactive-resume/utils/string";
import { RichInput } from "@/components/input/rich-input";

type PathSegment = string | number;

type CandidateProfileEditorProps = {
	value: CandidateProfile;
	onChange: (value: CandidateProfile) => void;
};

type ProfileFieldProps = {
	label: string;
	value: unknown;
	path: PathSegment[];
	onChange: (path: PathSegment[], value: unknown) => void;
	onRemove?: () => void;
	depth?: number;
	sectionType?: CustomSectionType;
};

const candidateItemTemplate = buildAiExtractionTemplate();

const richTextFieldNames = new Set(["content", "description", "recipient", "responsibilities"]);

const sectionItemIdentityFields: Partial<Record<CustomSectionType, string>> = {
	profiles: "network",
	experience: "company",
	education: "school",
	projects: "name",
	skills: "name",
	languages: "language",
	interests: "name",
	awards: "title",
	certifications: "title",
	publications: "title",
	volunteer: "organization",
	references: "name",
};

function humanize(value: string) {
	return value
		.replace(/([a-z\d])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.replace(/^./, (character) => character.toUpperCase());
}

export function isCandidateRichTextField(label: string) {
	return richTextFieldNames.has(label);
}

function replaceAtPath(root: unknown, path: PathSegment[], value: unknown): unknown {
	if (path.length === 0) return value;
	const [head, ...tail] = path;

	if (Array.isArray(root)) {
		const clone = [...root];
		const index = typeof head === "number" ? head : Number(head);
		clone[index] = replaceAtPath(clone[index], tail, value);
		return clone;
	}

	const record = typeof root === "object" && root !== null ? (root as Record<string, unknown>) : {};
	return {
		...record,
		[String(head)]: replaceAtPath(record[String(head)], tail, value),
	};
}

function isCustomSectionType(value: unknown): value is CustomSectionType {
	return typeof value === "string" && sectionTypeSchema.options.includes(value as CustomSectionType);
}

export function createCandidateSectionItem(sectionType: CustomSectionType): Record<string, unknown> {
	if (sectionType === "summary") return { id: generateId(), hidden: false, content: "" };
	if (sectionType === "cover-letter") return { id: generateId(), hidden: false, recipient: "", content: "" };

	const section = (candidateItemTemplate.sections as unknown as Record<string, { items: Record<string, unknown>[] }>)[
		sectionType
	];
	const item = structuredClone(section.items[0] ?? {});
	item.id = generateId();

	const identityField = sectionItemIdentityFields[sectionType];
	if (identityField) item[identityField] = `New ${humanize(sectionType)}`;

	return item;
}

export function createCandidateCustomSection(sectionType: CustomSectionType) {
	return {
		id: generateId(),
		title: humanize(sectionType),
		type: sectionType,
		icon: defaultSectionIconNames[sectionType],
		columns: 1,
		hidden: false,
		keepTogether: false,
		startOnNewPage: false,
		items: [],
	};
}

function ProfileField({ label, value, path, onChange, onRemove, depth = 0, sectionType }: ProfileFieldProps) {
	const [isOpen, setIsOpen] = useState(depth === 0 && ["basics", "summary"].includes(label));
	const [newSectionType, setNewSectionType] = useState<CustomSectionType>("projects");

	if (typeof value === "boolean") {
		return (
			<div className="flex items-center justify-between gap-4 rounded-md border p-3">
				<Label htmlFor={`candidate-${path.join("-")}`}>{humanize(label)}</Label>
				<Checkbox
					id={`candidate-${path.join("-")}`}
					checked={value}
					onCheckedChange={(checked) => onChange(path, checked)}
				/>
			</div>
		);
	}

	if (typeof value === "number") {
		return (
			<div className="space-y-2">
				<Label htmlFor={`candidate-${path.join("-")}`}>{humanize(label)}</Label>
				<Input
					id={`candidate-${path.join("-")}`}
					type="number"
					value={value}
					onChange={(event) => onChange(path, Number(event.target.value))}
				/>
			</div>
		);
	}

	if (typeof value === "string") {
		const multiline = value.includes("\n") || ["summary", "keywords", "notes"].includes(label);
		return (
			<div className="space-y-2">
				<Label htmlFor={`candidate-${path.join("-")}`}>{humanize(label)}</Label>
				{isCandidateRichTextField(label) ? (
					<RichInput value={value} editorClassName="min-h-32" onChange={(nextValue) => onChange(path, nextValue)} />
				) : multiline ? (
					<Textarea
						id={`candidate-${path.join("-")}`}
						value={value}
						className="min-h-24"
						onChange={(event) => onChange(path, event.target.value)}
					/>
				) : (
					<Input
						id={`candidate-${path.join("-")}`}
						value={value}
						readOnly={label === "id"}
						onChange={(event) => onChange(path, event.target.value)}
					/>
				)}
			</div>
		);
	}

	if (Array.isArray(value)) {
		const primitiveArray = value.every(
			(item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
		);

		if (primitiveArray && value.length > 0) {
			return (
				<div className="space-y-2">
					<Label htmlFor={`candidate-${path.join("-")}`}>{humanize(label)}</Label>
					<Textarea
						id={`candidate-${path.join("-")}`}
						value={value.join(", ")}
						placeholder={t`Separate values with commas`}
						onChange={(event) =>
							onChange(
								path,
								event.target.value
									.split(",")
									.map((item) => item.trim())
									.filter(Boolean),
							)
						}
					/>
				</div>
			);
		}

		const isCustomSections = label === "customSections" && path.length === 1;
		const canAddItem = label === "items" && sectionType !== undefined;
		const canAddStructuredValue = isCustomSections || canAddItem;

		if (value.length === 0 && !canAddStructuredValue) {
			return (
				<div className="space-y-1 rounded-md border border-dashed p-3">
					<p className="font-medium text-sm">{humanize(label)}</p>
					<p className="text-muted-foreground text-xs">
						<Trans>No data. Use Advanced JSON to add a new structured item.</Trans>
					</p>
				</div>
			);
		}

		return (
			<section className="space-y-3 rounded-lg border bg-muted/20 p-3">
				<div className="flex items-center justify-between gap-2">
					<h3 className="font-medium text-sm">
						{humanize(label)} <span className="text-muted-foreground">({value.length})</span>
					</h3>
					<div className="flex items-center gap-2">
						{isCustomSections && (
							<label className="flex items-center gap-2 text-muted-foreground text-xs">
								<Trans>Type</Trans>
								<select
									aria-label={t`Type`}
									value={newSectionType}
									className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
									onChange={(event) => setNewSectionType(event.target.value as CustomSectionType)}
								>
									{sectionTypeSchema.options.map((type) => (
										<option key={type} value={type}>
											{humanize(type)}
										</option>
									))}
								</select>
							</label>
						)}
						{canAddStructuredValue && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => {
									const nextValue = isCustomSections
										? createCandidateCustomSection(newSectionType)
										: sectionType
											? createCandidateSectionItem(sectionType)
											: undefined;
									if (nextValue) onChange(path, [...value, nextValue]);
								}}
							>
								<PlusIcon />
								{isCustomSections ? <Trans>Add section</Trans> : <Trans>Add item</Trans>}
							</Button>
						)}
						{onRemove && (
							<Button size="icon" variant="ghost" aria-label={t`Remove ${humanize(label)}`} onClick={onRemove}>
								<TrashIcon />
							</Button>
						)}
					</div>
				</div>
				{value.length === 0 ? (
					<p className="text-muted-foreground text-xs">
						<Trans>No data. Use the action above to add a structured item.</Trans>
					</p>
				) : (
					value.map((item, index) => (
						<ProfileField
							key={`${path.join(".")}-${index}`}
							label={`${humanize(label)} ${index + 1}`}
							value={item}
							path={[...path, index]}
							depth={depth + 1}
							sectionType={sectionType}
							onChange={onChange}
							onRemove={() =>
								onChange(
									path,
									value.filter((_, itemIndex) => itemIndex !== index),
								)
							}
						/>
					))
				)}
			</section>
		);
	}

	if (typeof value === "object" && value !== null) {
		const entries = Object.entries(value);
		const hasSectionVisibility =
			depth <= 2 &&
			typeof (value as Record<string, unknown>).hidden === "boolean" &&
			("items" in value || "content" in value);
		const visibleEntries = hasSectionVisibility ? entries.filter(([key]) => key !== "hidden") : entries;
		const resolvedSectionType = isCustomSectionType((value as Record<string, unknown>).type)
			? ((value as Record<string, unknown>).type as CustomSectionType)
			: isCustomSectionType(label)
				? label
				: sectionType;
		const content = (
			<div className={depth <= 1 ? "grid gap-4 md:grid-cols-2" : "space-y-3"}>
				{visibleEntries.map(([key, child]) => (
					<div
						key={`${path.join(".")}-${key}`}
						className={
							typeof child === "object" && child !== null
								? "md:col-span-2"
								: ["content", "description"].includes(key)
									? "md:col-span-2"
									: hasSectionVisibility && key === "columns"
										? "md:col-span-2 md:max-w-[calc(50%-0.5rem)]"
										: undefined
						}
					>
						<ProfileField
							label={key}
							value={child}
							path={[...path, key]}
							depth={depth + 1}
							sectionType={key === "items" ? resolvedSectionType : sectionType}
							onChange={onChange}
						/>
					</div>
				))}
			</div>
		);

		if (depth <= 2) {
			return (
				<details
					className="group rounded-lg border bg-card open:shadow-sm"
					open={isOpen}
					onToggle={(event) => setIsOpen(event.currentTarget.open)}
				>
					<summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-semibold text-sm marker:hidden">
						<span>{humanize(label)}</span>
						<div className="flex items-center gap-3">
							{hasSectionVisibility && (
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground text-xs">
										<Trans>Hidden</Trans>
									</span>
									<Switch
										size="sm"
										aria-label={t`Hidden`}
										checked={(value as Record<string, boolean>).hidden}
										onClick={(event) => event.stopPropagation()}
										onKeyDown={(event) => event.stopPropagation()}
										onCheckedChange={(checked) => onChange([...path, "hidden"], checked)}
									/>
								</div>
							)}
							<span className="text-muted-foreground text-xs group-open:hidden">
								<Trans>Expand</Trans>
							</span>
							<span className="hidden text-muted-foreground text-xs group-open:inline">
								<Trans>Collapse</Trans>
							</span>
						</div>
					</summary>
					{isOpen && <div className="border-t p-4">{content}</div>}
				</details>
			);
		}

		return (
			<section className={depth === 0 ? "space-y-4 rounded-lg border p-4" : "space-y-3 rounded-md border p-3"}>
				<div className="flex items-center justify-between gap-2">
					<h3 className={depth === 0 ? "font-semibold text-base" : "font-medium text-sm"}>{humanize(label)}</h3>
					{onRemove && (
						<Button size="icon" variant="ghost" aria-label={t`Remove ${humanize(label)}`} onClick={onRemove}>
							<TrashIcon />
						</Button>
					)}
				</div>
				{content}
			</section>
		);
	}

	return null;
}

export function CandidateProfileEditor({ value, onChange }: CandidateProfileEditorProps) {
	const [json, setJson] = useState(() => JSON.stringify(value, null, 2));
	const [jsonError, setJsonError] = useState("");

	useEffect(() => {
		setJson(JSON.stringify(value, null, 2));
	}, [value]);

	const handleFieldChange = (path: PathSegment[], nextValue: unknown) => {
		onChange(replaceAtPath(value, path, nextValue) as CandidateProfile);
	};

	const applyJson = () => {
		try {
			const profile = candidateProfileSchema.parse(JSON.parse(json));
			onChange(profile);
			setJsonError("");
		} catch (error) {
			setJsonError(error instanceof Error ? error.message : t`Invalid candidate JSON.`);
		}
	};

	return (
		<Tabs defaultValue="structured" className="space-y-3">
			<TabsList className="grid w-full max-w-full grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] sm:w-80">
				<TabsTrigger value="structured" className="min-w-0 overflow-hidden text-ellipsis">
					<Trans>Structured editor</Trans>
				</TabsTrigger>
				<TabsTrigger value="json" className="min-w-0 overflow-hidden text-ellipsis">
					<Trans>Advanced JSON</Trans>
				</TabsTrigger>
			</TabsList>

			<TabsContent value="structured" className="space-y-4">
				{Object.entries(value).map(([key, child]) => (
					<ProfileField key={key} label={key} value={child} path={[key]} onChange={handleFieldChange} />
				))}
			</TabsContent>

			<TabsContent value="json" className="space-y-3">
				<p className="text-muted-foreground text-sm">
					<Trans>Edit the complete normalized candidate profile. Apply it here, then save the candidate.</Trans>
				</p>
				<Textarea
					value={json}
					spellCheck={false}
					className="min-h-[560px] font-mono text-xs"
					onChange={(event) => setJson(event.target.value)}
				/>
				{jsonError && <p className="text-destructive text-sm">{jsonError}</p>}
				<Button type="button" variant="outline" onClick={applyJson}>
					<Trans>Apply JSON</Trans>
				</Button>
			</TabsContent>
		</Tabs>
	);
}
