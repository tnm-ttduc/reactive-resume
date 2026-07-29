import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@reactive-resume/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";

const RELATIVE_TIME_DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
	{ amount: 31_536_000_000, unit: "year" },
	{ amount: 2_592_000_000, unit: "month" },
	{ amount: 604_800_000, unit: "week" },
	{ amount: 86_400_000, unit: "day" },
	{ amount: 3_600_000, unit: "hour" },
	{ amount: 60_000, unit: "minute" },
];

function formatRelativeTime(value: Date | string, formatter: Intl.RelativeTimeFormat) {
	const date = value instanceof Date ? value : new Date(value);
	const diffMs = date.getTime() - Date.now();
	const division = RELATIVE_TIME_DIVISIONS.find((candidate) => Math.abs(diffMs) >= candidate.amount);
	if (!division) return formatter.format(0, "second");
	return formatter.format(Math.round(diffMs / division.amount), division.unit);
}

type CandidateVersionHistoryProps = {
	candidateId: string;
	currentVersion: number;
	onRestored: () => void;
};

export function CandidateVersionHistory({ candidateId, currentVersion, onRestored }: CandidateVersionHistoryProps) {
	const [open, setOpen] = useState(false);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const formatter = useMemo(() => new Intl.RelativeTimeFormat(i18n.locale, { numeric: "auto" }), []);
	const versionsQuery = orpc.candidates.listVersions.queryOptions({ input: { candidateId } });
	const { data: versions, isLoading } = useQuery({ ...versionsQuery, enabled: open });
	const { mutate: restoreVersion, isPending } = useMutation(orpc.candidates.restoreVersion.mutationOptions());

	const handleRestore = async (versionId: string, version: number) => {
		const confirmed = await confirm(t`Restore candidate version ${version}?`, {
			description: t`The current data and all earlier versions will be kept. Restoring creates a new version.`,
		});
		if (!confirmed) return;

		restoreVersion(
			{ candidateId, versionId, expectedVersion: currentVersion },
			{
				onSuccess: async () => {
					await queryClient.invalidateQueries({ queryKey: versionsQuery.queryKey });
					onRestored();
					toast.success(t`Candidate version restored.`);
					setOpen(false);
				},
				onError: (error) =>
					toast.error(getOrpcErrorMessage(error, { fallback: t`Could not restore candidate version.` })),
			},
		);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				render={
					<Button size="sm" variant="outline">
						<ClockCounterClockwiseIcon />
						<Trans>Version history</Trans>
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="w-72">
				<DropdownMenuGroup>
					<DropdownMenuLabel>
						<Trans>Candidate versions</Trans>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />
					{isLoading && (
						<div className="px-2 py-3 text-muted-foreground text-xs">
							<Trans>Loading…</Trans>
						</div>
					)}
					{!isLoading && (!versions || versions.length === 0) && (
						<div className="px-2 py-3 text-muted-foreground text-xs">
							<Trans>No saved versions yet.</Trans>
						</div>
					)}
					{versions?.map((version) => (
						<DropdownMenuItem
							key={version.id}
							disabled={isPending || version.version === currentVersion}
							className="flex-col items-start gap-0.5"
							onClick={() => void handleRestore(version.id, version.version)}
						>
							<span className="font-medium">
								v{version.version} · {version.label}
							</span>
							<span className="text-muted-foreground text-xs">
								{version.name} · {formatRelativeTime(version.createdAt, formatter)}
							</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
