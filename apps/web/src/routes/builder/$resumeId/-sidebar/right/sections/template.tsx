import { Trans } from "@lingui/react/macro";
import { PaintBrushBroadIcon, SwapIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { templates } from "@/dialogs/resume/template/data";
import { useDialogStore } from "@/dialogs/store";
import { useCurrentResume, useUpdateResumeData } from "@/features/resume/builder/draft";
import { orpc } from "@/libs/orpc/client";
import { SectionBase } from "../shared/section-base";

export function TemplateSectionBuilder() {
	return (
		<SectionBase type="template">
			<TemplateSectionForm />
		</SectionBase>
	);
}

function TemplateSectionForm() {
	const openDialog = useDialogStore((state) => state.openDialog);
	const resume = useCurrentResume();
	const updateResumeData = useUpdateResumeData();
	const queryClient = useQueryClient();
	const { data: customTemplates = [] } = useQuery(orpc.customTemplates.list.queryOptions());
	const template = resume.data.metadata.template;
	const metadata = templates[template];
	const customTemplate = resume.data.metadata.customTemplate;
	const publishedCustomTemplates = customTemplates.filter(
		(item) => item.status === "published" && item.currentVersion > 0,
	);

	const onOpenTemplateGallery = () => {
		openDialog("resume.template.gallery", undefined);
	};

	const onSelectCustomTemplate = async (id: string) => {
		if (id === "legacy") {
			updateResumeData((draft) => {
				delete draft.metadata.customTemplate;
			});
			return;
		}

		try {
			const details = await queryClient.fetchQuery(orpc.customTemplates.getById.queryOptions({ input: { id } }));
			const version = details.versions[0];
			if (!version) throw new Error("Publish the custom template before using it.");
			updateResumeData((draft) => {
				draft.metadata.customTemplate = {
					id: details.id,
					name: details.name,
					version: version.version,
					ast: version.ast,
				};
			});
			toast.success(`Switched to ${details.name} v${version.version}.`);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not select custom template.");
		}
	};

	return (
		<div className="flex flex-col items-stretch gap-4">
			<div className="flex @md:flex-row flex-col items-stretch gap-x-4 gap-y-2">
				<Button
					variant="ghost"
					onClick={onOpenTemplateGallery}
					className="group/preview relative h-auto w-40 shrink-0 cursor-pointer p-0"
				>
					<div className="relative z-10 flex aspect-page size-full items-center justify-center overflow-hidden rounded-md bg-muted opacity-100 transition-opacity group-hover/preview:opacity-50">
						{customTemplate ? (
							<PaintBrushBroadIcon className="size-12 text-primary" />
						) : (
							<img src={metadata.imageUrl} alt={metadata.name} className="size-full object-cover" />
						)}
					</div>

					<div className="absolute inset-0 flex items-center justify-center">
						<SwapIcon size={48} weight="thin" className="size-12" />
					</div>
				</Button>

				<div className="flex flex-1 flex-col gap-y-4 @md:pt-1 @md:pb-3">
					<div className="space-y-1">
						<h3 className="font-semibold text-2xl capitalize tracking-tight">
							{customTemplate?.name ?? metadata.name}
						</h3>
						<p className="text-muted-foreground text-sm">
							{customTemplate ? `Custom AST template · version ${customTemplate.version}` : "Legacy template"}
						</p>
					</div>

					<div className="flex flex-wrap gap-2.5">
						{(customTemplate ? ["Custom", "Versioned", "AST"] : metadata.tags).map((tag) => (
							<Badge key={tag} variant="secondary">
								{tag}
							</Badge>
						))}
					</div>
				</div>
			</div>

			<div className="space-y-2">
				<label htmlFor="custom-template-select" className="font-medium text-sm">
					<Trans>Published custom template</Trans>
				</label>
				<select
					id="custom-template-select"
					className="h-9 w-full rounded-md border bg-background px-3 text-sm"
					value={customTemplate?.id ?? "legacy"}
					onChange={(event) => void onSelectCustomTemplate(event.target.value)}
				>
					<option value="legacy">Use legacy template gallery</option>
					{publishedCustomTemplates.map((item) => (
						<option key={item.id} value={item.id}>
							{item.name} · v{item.currentVersion}
						</option>
					))}
				</select>
				<Button nativeButton={false} variant="outline" size="sm" render={<a href="/dashboard/templates" />}>
					<PaintBrushBroadIcon />
					<Trans>Open Template Studio</Trans>
				</Button>
			</div>
		</div>
	);
}
