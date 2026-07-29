import type { Icon } from "@phosphor-icons/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	BriefcaseIcon,
	FilePdfIcon,
	FilesIcon,
	GlobeIcon,
	MagicWandIcon,
	PaletteIcon,
	ShieldCheckIcon,
	TargetIcon,
} from "@phosphor-icons/react";
import { m } from "motion/react";

type Feature = {
	id: string;
	icon: Icon;
	title: string;
	description: string;
	accent: string;
};

const getFeatures = (): Feature[] => [
	{
		id: "career-profile",
		icon: TargetIcon,
		title: t`One career profile`,
		description: t`Keep your experience, skills, education, and achievements organized as a reliable source of truth.`,
		accent: "from-emerald-500/15",
	},
	{
		id: "tailored-resumes",
		icon: FilesIcon,
		title: t`Role-ready resumes`,
		description: t`Create focused resume versions for different opportunities without rebuilding your story from scratch.`,
		accent: "from-sky-500/15",
	},
	{
		id: "ai-guidance",
		icon: MagicWandIcon,
		title: t`Practical AI guidance`,
		description: t`Review job fit, strengthen your writing, and surface the experience that matters most for each role.`,
		accent: "from-violet-500/15",
	},
	{
		id: "applications",
		icon: BriefcaseIcon,
		title: t`Application tracking`,
		description: t`See every opportunity, stage, note, and next step in one calm, focused workflow.`,
		accent: "from-amber-500/15",
	},
	{
		id: "design",
		icon: PaletteIcon,
		title: t`Flexible design`,
		description: t`Choose a professional template and make it yours with typography, color, spacing, and layout controls.`,
		accent: "from-rose-500/15",
	},
	{
		id: "pdf",
		icon: FilePdfIcon,
		title: t`Polished PDF export`,
		description: t`Download a sharp, consistent PDF that is ready for recruiters, hiring managers, and applications.`,
		accent: "from-orange-500/15",
	},
	{
		id: "sharing",
		icon: GlobeIcon,
		title: t`Simple, controlled sharing`,
		description: t`Share with a direct link, add password protection, or keep a resume private until it is ready.`,
		accent: "from-cyan-500/15",
	},
	{
		id: "privacy",
		icon: ShieldCheckIcon,
		title: t`Private by design`,
		description: t`Your career data stays in your workspace, with clear controls over what you publish and share.`,
		accent: "from-primary/15",
	},
];

export function Features() {
	return (
		<section id="features" className="p-4 md:p-8 xl:p-16">
			<m.div
				className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.4 }}
				transition={{ duration: 0.45 }}
			>
				<div>
					<p className="mb-3 font-semibold text-primary text-xs uppercase tracking-[0.2em]">
						<Trans>Built for momentum</Trans>
					</p>
					<h2 className="text-balance font-semibold text-3xl tracking-tight md:text-5xl">
						<Trans>Everything between your experience and your next role.</Trans>
					</h2>
				</div>
				<p className="max-w-xl text-muted-foreground leading-relaxed lg:justify-self-end">
					<Trans>
						TNM HR Platform brings the scattered pieces of a job search together, so you can spend less time managing
						documents and more time making a strong impression.
					</Trans>
				</p>
			</m.div>

			<div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{getFeatures().map(({ id, icon: Icon, title, description, accent }, index) => (
					<m.article
						key={id}
						className="group relative min-h-56 overflow-hidden rounded-xl border bg-card p-5"
						initial={{ opacity: 0, y: 18 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.2 }}
						transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }}
					>
						<div
							aria-hidden="true"
							className={`absolute inset-0 bg-linear-to-br ${accent} via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-100`}
						/>
						<div className="relative flex h-full flex-col">
							<div className="grid size-10 place-items-center rounded-lg border bg-background/80 text-primary shadow-sm">
								<Icon size={20} />
							</div>
							<div className="mt-auto pt-10">
								<h3 className="font-semibold tracking-tight">{title}</h3>
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>
							</div>
						</div>
					</m.article>
				))}
			</div>
		</section>
	);
}
