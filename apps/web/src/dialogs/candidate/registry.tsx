import type { AnyDialogRendererEntry } from "../renderer-registry";
import { CreateCandidateResumeDialog } from "./create-resume";
import { ImportCandidateDialog } from "./import";

export const candidateDialogRenderers: readonly AnyDialogRendererEntry[] = [
	{ type: "candidate.import", render: () => <ImportCandidateDialog /> },
	{
		type: "candidate.create-resume",
		render: (dialog) => <CreateCandidateResumeDialog data={dialog.data} />,
	},
];
