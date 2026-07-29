import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { DialogProps } from "../store";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { FileArrowUpIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { parseJSONResume } from "@reactive-resume/import/json-resume";
import { parseReactiveResumeJSON } from "@reactive-resume/import/reactive-resume-json";
import { parseReactiveResumeV4JSON } from "@reactive-resume/import/reactive-resume-v4-json";
import { Button } from "@reactive-resume/ui/components/button";
import {
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import { useHasUsableAiProvider } from "@/features/settings/integrations/hooks/use-has-usable-ai-provider";
import { getOrpcErrorMessage } from "@/libs/error-message";
import { client, orpc } from "@/libs/orpc/client";
import { detectJsonImportType } from "../resume/import.utils";
import { useDialogStore } from "../store";

type CandidateImportType = "pdf" | "docx" | "reactive-resume-json" | "reactive-resume-v4-json" | "json-resume-json";

async function fileToBase64(file: File) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

async function detectCandidateImportType(file: File): Promise<CandidateImportType | undefined> {
	const name = file.name.toLowerCase();
	if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
	if (
		file.type === "application/msword" ||
		file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		name.endsWith(".doc") ||
		name.endsWith(".docx")
	) {
		return "docx";
	}
	if (file.type === "application/json" || name.endsWith(".json")) {
		const type = detectJsonImportType(JSON.parse(await file.text()));
		return type || undefined;
	}
	return undefined;
}

async function parseCandidateFile(file: File, type: CandidateImportType): Promise<ResumeData> {
	if (type === "json-resume-json") return parseJSONResume(await file.text());
	if (type === "reactive-resume-json") return parseReactiveResumeJSON(await file.text());
	if (type === "reactive-resume-v4-json") return parseReactiveResumeV4JSON(await file.text());

	const base64 = await fileToBase64(file);
	if (type === "pdf") {
		return client.ai.parsePdf({ file: { name: file.name, data: base64 } });
	}

	const mediaType =
		file.type === "application/msword"
			? ("application/msword" as const)
			: ("application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const);
	return client.ai.parseDocx({ mediaType, file: { name: file.name, data: base64 } });
}

export function ImportCandidateDialog(_: DialogProps<"candidate.import">) {
	const closeDialog = useDialogStore((state) => state.closeDialog);
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File>();
	const [isImporting, setIsImporting] = useState(false);
	const { hasUsableProvider, isLoading: isLoadingAiProviders } = useHasUsableAiProvider();
	const { mutateAsync: importCandidate } = useMutation(orpc.candidates.import.mutationOptions());

	const onImport = async () => {
		if (!file) return;
		setIsImporting(true);
		const toastId = toast.loading(t`Importing candidate CV...`);
		try {
			const type = await detectCandidateImportType(file);
			if (!type) throw new Error(t`Unsupported candidate CV format.`);
			if ((type === "pdf" || type === "docx") && (isLoadingAiProviders || !hasUsableProvider)) {
				throw new Error(t`PDF and Word candidate imports require a connected AI provider.`);
			}
			const data = await parseCandidateFile(file, type);
			await importCandidate({ file, data, tags: [] });
			await queryClient.invalidateQueries({ queryKey: orpc.candidates.list.queryOptions().queryKey });
			toast.success(t`Candidate imported successfully.`, { id: toastId });
			closeDialog();
		} catch (error) {
			toast.error(getOrpcErrorMessage(error, { fallback: t`Could not import candidate CV.` }), { id: toastId });
		} finally {
			setIsImporting(false);
		}
	};

	return (
		<DialogContent>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<FileArrowUpIcon />
					<Trans>Import candidate CV</Trans>
				</DialogTitle>
				<DialogDescription>
					<Trans>
						Extract candidate content from PDF, Word or JSON. Layout and styling are not imported as a template.
					</Trans>
				</DialogDescription>
			</DialogHeader>

			<input
				ref={inputRef}
				hidden
				type="file"
				accept=".pdf,.doc,.docx,.json,application/pdf,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
				onChange={(event) => setFile(event.target.files?.[0])}
			/>
			<Button variant="outline" className="h-24" onClick={() => inputRef.current?.click()}>
				<FileArrowUpIcon />
				{file?.name ?? <Trans>Select candidate CV</Trans>}
			</Button>

			<DialogFooter>
				<Button disabled={!file || isImporting} onClick={() => void onImport()}>
					{isImporting ? <Trans>Importing...</Trans> : <Trans>Import candidate</Trans>}
				</Button>
			</DialogFooter>
		</DialogContent>
	);
}
