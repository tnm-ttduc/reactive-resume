import { Trans } from "@lingui/react/macro";
import { SectionBase } from "../shared/section-base";

export function InformationSectionBuilder() {
	return (
		<SectionBase type="information" className="space-y-4">
			<div className="space-y-2 rounded-md border bg-muted p-5">
				<h4 className="font-medium tracking-tight">
					<Trans>TNM HR Platform</Trans>
				</h4>

				<div className="space-y-2 text-muted-foreground text-xs leading-normal">
					<Trans>
						<p>Create, manage, and share professional resumes from one focused workspace.</p>
						<p>Use the builder controls to customize content, layout, templates, typography, and export settings.</p>
					</Trans>
				</div>
			</div>
		</SectionBase>
	);
}
