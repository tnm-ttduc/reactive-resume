import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FilePlusIcon, UploadSimpleIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Separator } from "@reactive-resume/ui/components/separator";
import { useDialogStore } from "@/dialogs/store";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/candidates/")({ component: RouteComponent });

function RouteComponent() {
	const { data: candidates = [] } = useQuery(orpc.candidates.list.queryOptions());
	const openDialog = useDialogStore((state) => state.openDialog);

	return (
		<div className="space-y-4">
			<DashboardHeader
				icon={UsersThreeIcon}
				title={t`Candidates`}
				actions={
					<Button size="sm" variant="outline" onClick={() => openDialog("candidate.import", undefined)}>
						<UploadSimpleIcon />
						<Trans>Import candidate CV</Trans>
					</Button>
				}
			/>
			<Separator />

			{candidates.length === 0 ? (
				<div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center">
					<UsersThreeIcon className="size-12 text-muted-foreground" />
					<div>
						<h2 className="font-semibold text-lg">
							<Trans>No candidates yet</Trans>
						</h2>
						<p className="text-muted-foreground text-sm">
							<Trans>Import a candidate CV to extract and normalize their profile.</Trans>
						</p>
					</div>
					<Button onClick={() => openDialog("candidate.import", undefined)}>
						<UploadSimpleIcon />
						<Trans>Import candidate CV</Trans>
					</Button>
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{candidates.map((candidate) => (
						<article key={candidate.id} className="space-y-4 rounded-lg border bg-card p-5 text-card-foreground">
							<div>
								<h2 className="font-semibold text-lg">
									<Link
										to="/dashboard/candidates/$candidateId"
										params={{ candidateId: candidate.id }}
										className="hover:underline"
									>
										{candidate.name}
									</Link>
								</h2>
								<p className="text-muted-foreground text-sm">{candidate.email || candidate.phone || "—"}</p>
							</div>
							{candidate.tags.length > 0 && (
								<div className="flex flex-wrap gap-2">
									{candidate.tags.map((tag) => (
										<Badge key={tag} variant="secondary">
											{tag}
										</Badge>
									))}
								</div>
							)}
							<Button
								className="w-full"
								onClick={() =>
									openDialog("candidate.create-resume", {
										candidateId: candidate.id,
										candidateName: candidate.name,
									})
								}
							>
								<FilePlusIcon />
								<Trans>Create CV from template</Trans>
							</Button>
						</article>
					))}
				</div>
			)}
		</div>
	);
}
