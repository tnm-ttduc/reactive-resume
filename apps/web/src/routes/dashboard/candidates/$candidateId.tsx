import type { CandidateProfile } from "@reactive-resume/schema/candidate/data";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowLeftIcon, FilePlusIcon, FloppyDiskIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Input } from "@reactive-resume/ui/components/input";
import { Label } from "@reactive-resume/ui/components/label";
import { Separator } from "@reactive-resume/ui/components/separator";
import { useDialogStore } from "@/dialogs/store";
import { CandidateProfileEditor } from "@/features/candidates/components/candidate-profile-editor";
import { CandidateVersionHistory } from "@/features/candidates/components/candidate-version-history";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/candidates/$candidateId")({ component: RouteComponent });

function RouteComponent() {
	const { candidateId } = Route.useParams();
	const openDialog = useDialogStore((state) => state.openDialog);
	const queryClient = useQueryClient();
	const options = orpc.candidates.getById.queryOptions({ input: { id: candidateId } });
	const { data: candidate } = useQuery(options);
	const { mutateAsync: updateCandidate, isPending } = useMutation(orpc.candidates.update.mutationOptions());
	const [profile, setProfile] = useState<CandidateProfile>();
	const [name, setName] = useState("");
	const [tags, setTags] = useState("");

	useEffect(() => {
		if (!candidate) return;
		setName(candidate.name);
		setTags(candidate.tags.join(", "));
		setProfile(structuredClone(candidate.profile));
	}, [candidate]);

	if (!candidate || !profile) return null;

	const refreshCandidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: options.queryKey }),
			queryClient.invalidateQueries({ queryKey: orpc.candidates.list.queryOptions().queryKey }),
			queryClient.invalidateQueries({
				queryKey: orpc.candidates.listVersions.queryOptions({ input: { candidateId } }).queryKey,
			}),
		]);
	};

	const onSave = async () => {
		const toastId = toast.loading(t`Saving candidate profile...`);
		try {
			const normalizedName = name.trim();
			const updated = await updateCandidate({
				id: candidate.id,
				name: normalizedName,
				tags: tags
					.split(",")
					.map((tag) => tag.trim())
					.filter(Boolean),
				profile: {
					...profile,
					basics: { ...profile.basics, name: normalizedName },
				},
				expectedVersion: candidate.currentVersion,
			});
			queryClient.setQueryData(options.queryKey, updated);
			await refreshCandidate();
			toast.success(t`Candidate profile saved as version ${updated.currentVersion}.`, { id: toastId });
		} catch (error) {
			toast.error(getOrpcErrorMessage(error, { fallback: t`Could not save candidate profile.` }), {
				id: toastId,
			});
		}
	};

	return (
		<div className="space-y-4">
			<DashboardHeader
				icon={UsersThreeIcon}
				title={candidate.name}
				actions={
					<>
						<Button size="sm" variant="outline" nativeButton={false} render={<Link to="/dashboard/candidates" />}>
							<ArrowLeftIcon />
							<Trans>Candidates</Trans>
						</Button>
						<CandidateVersionHistory
							candidateId={candidate.id}
							currentVersion={candidate.currentVersion}
							onRestored={() => void refreshCandidate()}
						/>
						<Button
							size="sm"
							onClick={() =>
								openDialog("candidate.create-resume", {
									candidateId: candidate.id,
									candidateName: candidate.name,
								})
							}
						>
							<FilePlusIcon />
							<Trans>Create CV</Trans>
						</Button>
					</>
				}
			/>
			<Separator />

			<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
				<section className="space-y-5 rounded-lg border bg-card p-4 sm:p-6">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div className="flex items-center gap-2">
								<h2 className="font-semibold text-lg">
									<Trans>Complete candidate profile</Trans>
								</h2>
								<Badge variant="secondary">v{candidate.currentVersion}</Badge>
							</div>
							<p className="text-muted-foreground text-sm">
								<Trans>
									Review and edit every normalized field extracted from the source CV. Each save creates a new version.
								</Trans>
							</p>
						</div>
						<Button disabled={isPending || !name.trim()} onClick={() => void onSave()}>
							<FloppyDiskIcon />
							{isPending ? <Trans>Saving…</Trans> : <Trans>Save new version</Trans>}
						</Button>
					</div>

					<div className="grid gap-4 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="candidate-record-name">
								<Trans>Candidate name</Trans>
							</Label>
							<Input id="candidate-record-name" value={name} onChange={(event) => setName(event.target.value)} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="candidate-tags">
								<Trans>Tags</Trans>
							</Label>
							<Input
								id="candidate-tags"
								value={tags}
								placeholder={t`engineering, senior, referral`}
								onChange={(event) => setTags(event.target.value)}
							/>
						</div>
					</div>

					<CandidateProfileEditor value={profile} onChange={setProfile} />
				</section>

				<div className="space-y-4 xl:sticky xl:top-4">
					<section className="space-y-3 rounded-lg border bg-card p-5">
						<div className="flex items-center justify-between">
							<h2 className="font-semibold">
								<Trans>Current version</Trans>
							</h2>
							<Badge>v{candidate.currentVersion}</Badge>
						</div>
						<div className="space-y-1 text-sm">
							<p>
								<span className="text-muted-foreground">
									<Trans>Last saved</Trans>:
								</span>{" "}
								{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
									new Date(candidate.updatedAt),
								)}
							</p>
							<p className="text-muted-foreground text-xs">
								<Trans>Restoring an older snapshot creates another version and preserves the full history.</Trans>
							</p>
						</div>
					</section>

					<section className="space-y-3 rounded-lg border bg-card p-5">
						<h2 className="font-semibold">
							<Trans>Source documents</Trans>
						</h2>
						{candidate.sources.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								<Trans>No source documents.</Trans>
							</p>
						) : (
							candidate.sources.map((source) => (
								<div key={source.id} className="rounded-md border p-3">
									<p className="truncate font-medium text-sm">{source.filename}</p>
									<p className="text-muted-foreground text-xs">
										{source.mediaType} · {Math.ceil(source.size / 1024)} KB
									</p>
									<p className="text-muted-foreground text-xs">
										{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(source.createdAt))}
									</p>
								</div>
							))
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
