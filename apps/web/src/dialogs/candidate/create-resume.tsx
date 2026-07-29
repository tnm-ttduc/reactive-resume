import type { DialogProps } from "../store";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FilePlusIcon } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
import {
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { slugify } from "@reactive-resume/utils/string";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { useDialogStore } from "../store";

export function CreateCandidateResumeDialog({ data }: DialogProps<"candidate.create-resume">) {
	const closeDialog = useDialogStore((state) => state.closeDialog);
	const navigate = useNavigate();
	const { data: templates = [] } = useQuery(orpc.customTemplates.list.queryOptions());
	const publishedTemplates = useMemo(
		() => templates.filter((template) => template.status === "published" && template.currentVersion > 0),
		[templates],
	);
	const [templateId, setTemplateId] = useState("");
	const [name, setName] = useState(`${data.candidateName} CV`);
	const [slug, setSlug] = useState(slugify(`${data.candidateName} CV`));
	const { mutateAsync: createResume, isPending } = useMutation(orpc.candidates.createResume.mutationOptions());

	useEffect(() => {
		if (!templateId && publishedTemplates[0]) setTemplateId(publishedTemplates[0].id);
	}, [publishedTemplates, templateId]);

	const onCreate = async () => {
		const toastId = toast.loading(t`Creating CV from candidate and template...`);
		try {
			const id = await createResume({
				candidateId: data.candidateId,
				templateId,
				name,
				slug,
				tags: [],
			});
			toast.success(t`CV created successfully.`, { id: toastId });
			closeDialog();
			void navigate({ to: "/builder/$resumeId", params: { resumeId: id } });
		} catch (error) {
			toast.error(getOrpcErrorMessage(error, { fallback: t`Could not create CV from candidate.` }), {
				id: toastId,
			});
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<FilePlusIcon />
					<Trans>Create CV from candidate</Trans>
				</DialogTitle>
				<DialogDescription>
					<Trans>Candidate content will be combined with an immutable published template version.</Trans>
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="candidate-resume-name">
						<Trans>CV name</Trans>
					</Label>
					<Input
						id="candidate-resume-name"
						value={name}
						onChange={(event) => {
							setName(event.target.value);
							setSlug(slugify(event.target.value));
						}}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="candidate-resume-slug">
						<Trans>Slug</Trans>
					</Label>
					<Input id="candidate-resume-slug" value={slug} onChange={(event) => setSlug(slugify(event.target.value))} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="candidate-template">
						<Trans>Published template</Trans>
					</Label>
					<select
						id="candidate-template"
						className="h-9 w-full rounded-md border bg-background px-3 text-sm"
						value={templateId}
						onChange={(event) => setTemplateId(event.target.value)}
					>
						<option value="" disabled>
							Select a published template
						</option>
						{publishedTemplates.map((template) => (
							<option key={template.id} value={template.id}>
								{template.name} · v{template.currentVersion}
							</option>
						))}
					</select>
					{publishedTemplates.length === 0 && (
						<p className="text-muted-foreground text-sm">
							<Trans>Publish a template in Template Studio before creating a CV.</Trans>
						</p>
					)}
				</div>
			</div>

			<DialogFooter>
				<Button disabled={isPending || !templateId || !name.trim() || !slug.trim()} onClick={() => void onCreate()}>
					<Trans>Create CV</Trans>
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}
