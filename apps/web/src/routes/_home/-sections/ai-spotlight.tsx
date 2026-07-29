import { Trans } from "@lingui/react/macro";
import { CheckIcon, MagicWandIcon, SparkleIcon, TargetIcon } from "@phosphor-icons/react";
import { m } from "motion/react";

const insights = [
	<Trans key="impact">Lead with measurable product impact</Trans>,
	<Trans key="keywords">Add two role-specific skills</Trans>,
	<Trans key="clarity">Make the opening summary more direct</Trans>,
];

export function AiSpotlight() {
	return (
		<section className="p-4 md:p-8 xl:p-16">
			<div className="relative overflow-hidden rounded-2xl border bg-primary/5 p-5 sm:p-8 lg:p-12">
				<div aria-hidden="true" className="absolute -top-24 -right-16 size-80 rounded-full bg-primary/20 blur-3xl" />
				<div className="relative grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
					<m.div
						initial={{ opacity: 0, x: -20 }}
						whileInView={{ opacity: 1, x: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.45 }}
					>
						<div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 font-medium text-xs">
							<MagicWandIcon className="text-primary" />
							<Trans>AI that keeps you in control</Trans>
						</div>
						<h2 className="text-balance font-semibold text-3xl tracking-tight md:text-5xl">
							<Trans>Sharper applications, grounded in your real experience.</Trans>
						</h2>
						<p className="mt-5 max-w-xl text-muted-foreground leading-relaxed">
							<Trans>
								Use AI as a thoughtful second pair of eyes. Compare your profile with a role, find gaps, and improve the
								story—without inventing experience or losing your voice.
							</Trans>
						</p>
					</m.div>

					<m.div
						className="rounded-xl border bg-background p-4 shadow-primary/5 shadow-xl sm:p-6"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.08 }}
					>
						<div className="flex items-center justify-between border-b pb-4">
							<div className="flex items-center gap-3">
								<div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
									<TargetIcon size={20} />
								</div>
								<div>
									<p className="font-semibold text-sm">
										<Trans>Role fit analysis</Trans>
									</p>
									<p className="text-muted-foreground text-xs">
										<Trans>Senior Product Designer</Trans>
									</p>
								</div>
							</div>
							<div className="text-right">
								<p className="font-semibold text-2xl text-primary">92%</p>
								<p className="text-[10px] text-muted-foreground">
									<Trans>Strong match</Trans>
								</p>
							</div>
						</div>
						<div className="mt-5 space-y-3">
							{insights.map((insight, index) => (
								<div key={index} className="flex items-start gap-3 rounded-lg bg-secondary/50 p-3">
									<div className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
										<CheckIcon size={12} weight="bold" />
									</div>
									<p className="text-sm">{insight}</p>
								</div>
							))}
						</div>
						<div className="mt-5 flex items-center gap-2 text-muted-foreground text-xs">
							<SparkleIcon className="text-primary" weight="fill" />
							<Trans>Suggestions based only on the information you provide</Trans>
						</div>
					</m.div>
				</div>
			</div>
		</section>
	);
}
