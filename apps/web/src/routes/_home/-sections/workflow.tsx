import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, BriefcaseIcon, FileTextIcon, UserFocusIcon } from "@phosphor-icons/react";
import { m } from "motion/react";

const steps = [
	{
		number: "01",
		icon: UserFocusIcon,
		title: <Trans>Build your career profile</Trans>,
		description: <Trans>Capture your experience once, then keep it current as your career grows.</Trans>,
	},
	{
		number: "02",
		icon: FileTextIcon,
		title: <Trans>Shape the right resume</Trans>,
		description: <Trans>Choose the strongest details for the role and present them in a polished format.</Trans>,
	},
	{
		number: "03",
		icon: BriefcaseIcon,
		title: <Trans>Apply with clarity</Trans>,
		description: <Trans>Track progress, keep notes, and always know the next action for every opportunity.</Trans>,
	},
];

export function Workflow() {
	return (
		<section id="workflow" className="overflow-hidden bg-foreground p-4 text-background md:p-8 xl:p-16">
			<m.div
				className="max-w-3xl"
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.45 }}
			>
				<p className="mb-3 font-semibold text-primary text-xs uppercase tracking-[0.2em]">
					<Trans>A clearer way forward</Trans>
				</p>
				<h2 className="text-balance font-semibold text-3xl tracking-tight md:text-5xl">
					<Trans>One simple flow, from career story to next step.</Trans>
				</h2>
			</m.div>

			<div className="mt-12 grid lg:grid-cols-3">
				{steps.map(({ number, icon: Icon, title, description }, index) => (
					<m.article
						key={number}
						className="relative border-background/15 border-t py-7 lg:border-t-0 lg:border-l lg:px-7 lg:first:border-l-0 lg:first:pl-0"
						initial={{ opacity: 0, y: 18 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.35 }}
						transition={{ duration: 0.4, delay: index * 0.08 }}
					>
						<div className="flex items-center justify-between text-background/45">
							<span className="font-mono text-xs">{number}</span>
							<Icon className="size-6 text-primary" />
						</div>
						<h3 className="mt-12 font-semibold text-xl tracking-tight">{title}</h3>
						<p className="mt-3 max-w-sm text-background/60 text-sm leading-relaxed">{description}</p>
						{index < steps.length - 1 && (
							<ArrowRightIcon
								aria-hidden="true"
								className="absolute top-1/2 -right-3 z-10 hidden size-6 rounded-full bg-primary p-1 text-primary-foreground lg:block"
							/>
						)}
					</m.article>
				))}
			</div>
		</section>
	);
}
