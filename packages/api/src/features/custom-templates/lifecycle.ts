import type { TemplateLifecycleStatus } from "@reactive-resume/schema/template-ast";

const allowedTransitions: Record<TemplateLifecycleStatus, readonly TemplateLifecycleStatus[]> = {
	draft: ["review"],
	review: ["draft", "published"],
	published: ["draft", "deprecated"],
	deprecated: ["archived"],
	archived: [],
};

export function canTransitionTemplateStatus(from: TemplateLifecycleStatus, to: TemplateLifecycleStatus) {
	return allowedTransitions[from].includes(to);
}
