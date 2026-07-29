import type { TemplateImportJobStage, TemplateImportJobStatus } from "@reactive-resume/schema/template-import-job";
import { Trans } from "@lingui/react/macro";
import {
	ArrowClockwiseIcon,
	CheckCircleIcon,
	PaintBrushBroadIcon,
	PlusIcon,
	SpinnerGapIcon,
	TrashIcon,
	UploadSimpleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@reactive-resume/ui/components/card";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/templates/")({ component: RouteComponent });

type ImportJobView = {
	id: string;
	templateId: string;
	templateName: string;
	filename: string;
	status: TemplateImportJobStatus;
	stage: TemplateImportJobStage;
	progress: number;
	attempts: number;
	error: string | null;
};

const importStages: Array<{
	stage: TemplateImportJobStage;
	label: string;
	description: string;
}> = [
	{ stage: "queued", label: "Upload secured", description: "Source stored safely" },
	{ stage: "ai-vision", label: "AI Vision", description: "Planning regions, sections and blocks" },
	{ stage: "extracting", label: "Extracting", description: "Reading PDF/DOCX evidence" },
	{ stage: "mapping", label: "Composer mapping", description: "Building the validated blueprint" },
	{ stage: "saving", label: "Finalizing", description: "Saving the editable draft" },
];

function ImportJobProgress({
	job,
	isRetrying,
	onOpen,
	onRetry,
}: {
	job: ImportJobView;
	isRetrying: boolean;
	onOpen: () => void;
	onRetry: () => void;
}) {
	const effectiveStage = job.stage === "completed" ? "saving" : job.stage === "failed" ? "saving" : job.stage;
	const currentStageIndex = Math.max(
		0,
		importStages.findIndex((item) => item.stage === effectiveStage),
	);
	const isFailed = job.status === "failed";
	const isCompleted = job.status === "completed";

	return (
		<div
			className={`mt-4 overflow-hidden rounded-xl border ${
				isFailed ? "border-destructive/40" : isCompleted ? "border-emerald-500/40" : "border-primary/30"
			}`}
		>
			<div className="flex flex-wrap items-start gap-3 bg-muted/30 p-4">
				<div
					className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
						isFailed
							? "bg-destructive/10 text-destructive"
							: isCompleted
								? "bg-emerald-500/10 text-emerald-600"
								: "bg-primary/10 text-primary"
					}`}
				>
					{isFailed ? (
						<WarningCircleIcon className="size-5" />
					) : isCompleted ? (
						<CheckCircleIcon className="size-5" />
					) : (
						<SpinnerGapIcon className="size-5 animate-spin" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<p className="font-semibold">
							{isFailed ? "Import needs attention" : isCompleted ? "Template draft is ready" : "Building your template"}
						</p>
						<Badge variant="secondary">{job.progress}%</Badge>
					</div>
					<p className="truncate text-muted-foreground text-sm">
						{job.templateName} · {job.filename}
					</p>
					{isFailed && job.error && <p className="mt-2 text-destructive text-sm">{job.error}</p>}
				</div>
				{isFailed && (
					<Button size="sm" variant="outline" disabled={isRetrying} onClick={onRetry}>
						{isRetrying ? <SpinnerGapIcon className="animate-spin" /> : <ArrowClockwiseIcon />}
						Retry import
					</Button>
				)}
				{isCompleted && (
					<Button size="sm" onClick={onOpen}>
						Open editor
					</Button>
				)}
			</div>

			<div className="px-4 pt-1 pb-4">
				<div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
					<div
						className={`h-full rounded-full transition-[width] duration-500 ${
							isFailed ? "bg-destructive" : isCompleted ? "bg-emerald-500" : "bg-primary"
						}`}
						style={{ width: `${job.progress}%` }}
					/>
				</div>
				<div className="grid gap-3 sm:grid-cols-5">
					{importStages.map((item, index) => {
						const done = isCompleted || index < currentStageIndex;
						const current = !isCompleted && !isFailed && index === currentStageIndex;
						return (
							<div key={item.stage} className="flex min-w-0 gap-2 sm:block">
								<div
									className={`mb-1.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
										done
											? "border-primary bg-primary text-primary-foreground"
											: current
												? "border-primary bg-primary/10 text-primary"
												: "border-border text-muted-foreground"
									}`}
								>
									{done ? <CheckCircleIcon className="size-3.5" /> : index + 1}
								</div>
								<div className="min-w-0">
									<p className={`font-medium text-xs ${current ? "text-primary" : ""}`}>{item.label}</p>
									<p className="text-[11px] text-muted-foreground leading-tight">{item.description}</p>
								</div>
							</div>
						);
					})}
				</div>
				{!isFailed && !isCompleted && (
					<p className="mt-4 text-muted-foreground text-xs">
						You can leave this page. Processing continues safely in the background and resumes after a server restart.
					</p>
				)}
			</div>
		</div>
	);
}

function RouteComponent() {
	const [templateName, setTemplateName] = useState("");
	const [sourceFile, setSourceFile] = useState<File | null>(null);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [newTemplateTab, setNewTemplateTab] = useState<"blank" | "import">("blank");
	const [importJobId, setImportJobId] = useState<string | null>(null);
	const completedJobRef = useRef<string | null>(null);
	const navigate = useNavigate();
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const listOptions = orpc.customTemplates.list.queryOptions();
	const { data: templates = [] } = useQuery(listOptions);
	const { mutateAsync: createTemplate, isPending } = useMutation(orpc.customTemplates.create.mutationOptions());
	const { mutateAsync: importTemplate, isPending: isImporting } = useMutation(
		orpc.customTemplates.import.mutationOptions(),
	);
	const { mutateAsync: retryImport, isPending: isRetryingImport } = useMutation(
		orpc.customTemplates.retryImport.mutationOptions(),
	);
	const { mutateAsync: deleteTemplate } = useMutation(orpc.customTemplates.delete.mutationOptions());
	const activeImportJobsOptions = orpc.customTemplates.listActiveImportJobs.queryOptions();
	const { data: activeImportJobs = [] } = useQuery({
		...activeImportJobsOptions,
		refetchInterval: (query) =>
			query.state.data?.some((job) => job.status === "queued" || job.status === "processing") ? 1_000 : false,
	});
	const resolvedImportJobId = importJobId ?? activeImportJobs[0]?.id ?? null;
	const importJobOptions = orpc.customTemplates.getImportJob.queryOptions({
		input: { id: resolvedImportJobId ?? "" },
	});
	const { data: importJob } = useQuery({
		...importJobOptions,
		enabled: Boolean(resolvedImportJobId),
		refetchInterval: (query) =>
			query.state.data?.status === "queued" || query.state.data?.status === "processing" ? 750 : false,
	});
	const isImportJobBusy = importJob?.status === "queued" || importJob?.status === "processing";

	useEffect(() => {
		if (activeImportJobs.length > 0) setNewTemplateTab("import");
	}, [activeImportJobs.length]);

	useEffect(() => {
		if (importJob?.status !== "completed" || completedJobRef.current === importJob.id) return;
		completedJobRef.current = importJob.id;
		void queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
		void queryClient.invalidateQueries({ queryKey: activeImportJobsOptions.queryKey });
		toast.success("Template draft is ready for review.");
		window.setTimeout(() => {
			void navigate({
				to: "/dashboard/templates/$templateId",
				params: { templateId: importJob.templateId },
			});
		}, 700);
	}, [activeImportJobsOptions.queryKey, importJob, listOptions.queryKey, navigate, queryClient]);

	const handleCreate = async () => {
		const trimmedName = templateName.trim();
		if (!trimmedName) return;
		try {
			const id = await createTemplate({ name: trimmedName });
			await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
			await navigate({ to: "/dashboard/templates/$templateId", params: { templateId: id } });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not create template.");
		}
	};

	const handleImport = async () => {
		if (!sourceFile || !templateName.trim()) return;
		try {
			const job = await importTemplate({ name: templateName.trim(), file: sourceFile });
			setImportJobId(job.id);
			setNewTemplateTab("import");
			queryClient.setQueryData(orpc.customTemplates.getImportJob.queryOptions({ input: { id: job.id } }).queryKey, job);
			await queryClient.invalidateQueries({ queryKey: activeImportJobsOptions.queryKey });
			toast.success("Upload complete. Template processing has started.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not import template source.");
		}
	};

	const handleRetryImport = async () => {
		if (!importJob) return;
		try {
			const retried = await retryImport({ id: importJob.id });
			setImportJobId(retried.id);
			completedJobRef.current = null;
			queryClient.setQueryData(importJobOptions.queryKey, retried);
			await queryClient.invalidateQueries({ queryKey: activeImportJobsOptions.queryKey });
			toast.success("Import queued again.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not retry template import.");
		}
	};

	const handleDelete = async (template: { id: string; name: string }) => {
		const confirmed = await confirm(`Delete “${template.name}”?`, {
			description: "This permanently deletes the draft, published versions, and its stored source file.",
			confirmText: "Delete template",
		});
		if (!confirmed) return;

		setDeletingId(template.id);
		try {
			await deleteTemplate({ id: template.id });
			await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
			toast.success("Template deleted.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not delete template.");
		} finally {
			setDeletingId(null);
		}
	};

	return (
		<div className="space-y-4">
			<DashboardHeader icon={PaintBrushBroadIcon} title="CV Templates" />
			<Separator />

			<Tabs
				value={newTemplateTab}
				className="w-full gap-0"
				onValueChange={(value) => setNewTemplateTab(value as "blank" | "import")}
			>
				<Card className="overflow-hidden">
					<CardHeader className="gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0">
							<CardTitle>
								<Trans>New template</Trans>
							</CardTitle>
							<CardDescription>
								<Trans>Start from a preset or import an existing PDF or DOCX layout.</Trans>
							</CardDescription>
						</div>
						<TabsList className="grid w-full shrink-0 grid-cols-2 sm:w-fit sm:min-w-80">
							<TabsTrigger value="blank">
								<PlusIcon />
								<Trans>Blank template</Trans>
							</TabsTrigger>
							<TabsTrigger value="import">
								<UploadSimpleIcon />
								<Trans>Import PDF/DOCX</Trans>
							</TabsTrigger>
						</TabsList>
					</CardHeader>
					<CardContent className="border-t p-4">
						<TabsContent value="blank">
							<div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
								<div className="space-y-2">
									<Label htmlFor="blank-template-name">
										<Trans>Template name</Trans>
									</Label>
									<Input
										id="blank-template-name"
										value={templateName}
										placeholder="e.g. Acme Engineering"
										onChange={(event) => setTemplateName(event.target.value)}
										onKeyDown={(event) => {
											if (event.key === "Enter") void handleCreate();
										}}
									/>
								</div>
								<Button disabled={!templateName.trim() || isPending} onClick={() => void handleCreate()}>
									<PlusIcon />
									<Trans>Create template</Trans>
								</Button>
							</div>
							<p className="mt-2 text-muted-foreground text-xs">
								<Trans>Uses a safe two-column preset that you can fully customize in the editor.</Trans>
							</p>
						</TabsContent>

						<TabsContent value="import">
							<div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
								<div className="space-y-2">
									<Label htmlFor="template-source-file">
										<Trans>Source file</Trans>
									</Label>
									<Input
										id="template-source-file"
										type="file"
										disabled={isImporting || isImportJobBusy}
										accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
										onChange={(event) => {
											const file = event.target.files?.[0] ?? null;
											setSourceFile(file);
											if (file && !templateName) setTemplateName(file.name.replace(/\.(pdf|docx)$/i, ""));
										}}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="import-template-name">
										<Trans>Template name</Trans>
									</Label>
									<Input
										id="import-template-name"
										value={templateName}
										disabled={isImporting || isImportJobBusy}
										placeholder="e.g. Acme Engineering"
										onChange={(event) => setTemplateName(event.target.value)}
									/>
								</div>
								<Button
									disabled={!sourceFile || !templateName.trim() || isImporting || isImportJobBusy}
									onClick={() => void handleImport()}
								>
									{isImporting ? <SpinnerGapIcon className="animate-spin" /> : <UploadSimpleIcon />}
									{isImporting ? <Trans>Uploading…</Trans> : <Trans>Import and review</Trans>}
								</Button>
							</div>
							<p className="mt-2 text-muted-foreground text-xs">
								<Trans>
									The source file is stored for preview. AI Vision plans page regions, section layouts and content
									blocks before deterministic extraction and mapping.
								</Trans>
							</p>
							{importJob && (
								<ImportJobProgress
									job={importJob}
									isRetrying={isRetryingImport}
									onOpen={() =>
										void navigate({
											to: "/dashboard/templates/$templateId",
											params: { templateId: importJob.templateId },
										})
									}
									onRetry={() => void handleRetryImport()}
								/>
							)}
						</TabsContent>
					</CardContent>
				</Card>
			</Tabs>

			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{templates.map((template) => (
					<div key={template.id} className="group relative">
						<Link
							to="/dashboard/templates/$templateId"
							params={{ templateId: template.id }}
							className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							<Card className="h-full transition-colors hover:border-primary/40">
								<CardHeader className="pe-14">
									<div className="flex items-center justify-between gap-3">
										<CardTitle>{template.name}</CardTitle>
										<Badge variant={template.status === "published" ? "default" : "secondary"}>{template.status}</Badge>
									</div>
									<CardDescription>
										{template.currentVersion > 0 ? `Published version ${template.currentVersion}` : "Unpublished draft"}
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
						<Button
							className="absolute top-3 right-3 opacity-70 transition-opacity group-hover:opacity-100"
							variant="ghost"
							size="icon-sm"
							aria-label={`Delete ${template.name}`}
							title={`Delete ${template.name}`}
							disabled={deletingId === template.id}
							onClick={() => void handleDelete(template)}
						>
							<TrashIcon />
						</Button>
					</div>
				))}
			</div>

			{templates.length === 0 && (
				<div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
					<PaintBrushBroadIcon className="mx-auto mb-3 size-8" />
					<Trans>No custom templates yet.</Trans>
				</div>
			)}
		</div>
	);
}
