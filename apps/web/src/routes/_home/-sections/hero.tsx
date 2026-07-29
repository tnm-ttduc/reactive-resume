import { Trans } from "@lingui/react/macro";
import {
	ArrowRightIcon,
	BriefcaseIcon,
	CheckCircleIcon,
	FileTextIcon,
	MagicWandIcon,
	ShieldCheckIcon,
	SparkleIcon,
	TargetIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { m } from "motion/react";
import { Button } from "@reactive-resume/ui/components/button";
import { Spotlight } from "@/components/animation/spotlight";

const applications = [
	{ company: "Northstar Labs", role: "Product Designer", status: "Interview", color: "bg-emerald-500" },
	{ company: "Atlas Studio", role: "UX Lead", status: "Applied", color: "bg-sky-500" },
	{ company: "Vertex", role: "Senior Designer", status: "Draft", color: "bg-amber-500" },
];

export function Hero() {
	return (
		<section id="hero" className="relative min-h-svh overflow-hidden border-b pt-28 pb-16 md:pt-36 md:pb-24">
			<Spotlight />

			<div
				aria-hidden="true"
				className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:42px_42px]"
			/>
			<div
				aria-hidden="true"
				className="absolute -top-32 right-[-12%] size-[34rem] rounded-full bg-primary/12 blur-3xl md:size-[46rem]"
			/>

			<div className="container relative z-10 mx-auto grid items-center gap-14 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:px-12">
				<div className="flex max-w-2xl flex-col items-start">
					<m.div
						className="mb-7 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 font-medium text-xs shadow-sm backdrop-blur-sm"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.35 }}
					>
						<SparkleIcon aria-hidden="true" className="size-3.5 text-primary" weight="fill" />
						<Trans>One workspace for every career move</Trans>
					</m.div>

					<m.h1
						className="text-balance font-semibold text-5xl leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl xl:text-[5.25rem]"
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.45 }}
					>
						<Trans>
							Turn experience into <span className="text-primary">opportunity.</span>
						</Trans>
					</m.h1>

					<m.p
						className="mt-7 max-w-xl text-balance text-base text-muted-foreground leading-relaxed sm:text-lg"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45, delay: 0.58 }}
					>
						<Trans>
							Create role-ready resumes, organize every application, and use AI to make each career move more
							confident—from one private workspace.
						</Trans>
					</m.p>

					<m.div
						className="mt-8 flex flex-col gap-3 sm:flex-row"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.45, delay: 0.7 }}
					>
						<Button
							size="lg"
							nativeButton={false}
							className="group min-w-44"
							render={
								<Link to="/dashboard">
									<Trans>Build your resume</Trans>
									<ArrowRightIcon
										aria-hidden="true"
										className="size-4 transition-transform group-hover:translate-x-0.5"
									/>
								</Link>
							}
						/>
						<Button
							size="lg"
							variant="outline"
							nativeButton={false}
							className="min-w-40 bg-background/60 backdrop-blur-sm"
							render={
								<a href="#workflow">
									<Trans>See how it works</Trans>
								</a>
							}
						/>
					</m.div>

					<m.div
						className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-muted-foreground text-xs sm:text-sm"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.5, delay: 0.86 }}
					>
						<span className="inline-flex items-center gap-1.5">
							<MagicWandIcon aria-hidden="true" className="text-primary" />
							<Trans>AI-assisted</Trans>
						</span>
						<span className="inline-flex items-center gap-1.5">
							<TargetIcon aria-hidden="true" className="text-primary" />
							<Trans>ATS-ready</Trans>
						</span>
						<span className="inline-flex items-center gap-1.5">
							<ShieldCheckIcon aria-hidden="true" className="text-primary" />
							<Trans>Private by design</Trans>
						</span>
					</m.div>
				</div>

				<m.div
					className="relative mx-auto w-full max-w-2xl"
					initial={{ opacity: 0, y: 28, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					transition={{ duration: 0.65, delay: 0.58, ease: "easeOut" }}
				>
					<div
						aria-hidden="true"
						className="absolute -inset-6 rounded-[2.5rem] bg-linear-to-br from-primary/20 via-primary/5 to-transparent blur-2xl"
					/>
					<div className="relative overflow-hidden rounded-2xl border bg-background/92 shadow-2xl shadow-primary/10 backdrop-blur-xl">
						<div className="flex h-11 items-center gap-2 border-b px-4">
							<span className="size-2.5 rounded-full bg-foreground/10" />
							<span className="size-2.5 rounded-full bg-foreground/10" />
							<span className="size-2.5 rounded-full bg-foreground/10" />
							<span className="ml-auto rounded-full bg-secondary px-3 py-1 text-[10px] text-muted-foreground">
								app.tnmhr.com
							</span>
						</div>

						<div className="grid min-h-[430px] grid-cols-[72px_1fr] sm:grid-cols-[180px_1fr]">
							<div className="border-r bg-secondary/25 p-3 sm:p-4">
								<div className="mb-7 flex items-center gap-2">
									<div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
										<span className="font-bold text-xs">TNM</span>
									</div>
									<span className="hidden font-semibold text-sm sm:block">HR Platform</span>
								</div>

								<div className="space-y-1">
									{[
										{ icon: FileTextIcon, label: "Resumes", active: true },
										{ icon: BriefcaseIcon, label: "Applications", active: false },
										{ icon: TargetIcon, label: "Career profile", active: false },
									].map(({ icon: Icon, label, active }) => (
										<div
											key={label}
											className={`flex items-center gap-2 rounded-md p-2 text-xs ${
												active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
											}`}
										>
											<Icon className="size-4 shrink-0" />
											<span className="hidden sm:block">{label}</span>
										</div>
									))}
								</div>
							</div>

							<div className="min-w-0 p-4 sm:p-6">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-muted-foreground text-xs">
											<Trans>Good morning, Alex</Trans>
										</p>
										<p className="mt-1 font-semibold text-lg tracking-tight">
											<Trans>Your career workspace</Trans>
										</p>
									</div>
									<div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
										AM
									</div>
								</div>

								<div className="mt-6 grid gap-3 sm:grid-cols-2">
									<div className="rounded-xl border bg-card p-4">
										<div className="flex items-center justify-between">
											<span className="text-muted-foreground text-xs">
												<Trans>Profile strength</Trans>
											</span>
											<TargetIcon className="text-primary" />
										</div>
										<p className="mt-3 font-semibold text-3xl tracking-tight">86%</p>
										<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
											<div className="h-full w-[86%] rounded-full bg-primary" />
										</div>
									</div>
									<div className="rounded-xl border bg-primary p-4 text-primary-foreground">
										<div className="flex items-center justify-between">
											<span className="text-xs opacity-75">
												<Trans>AI match</Trans>
											</span>
											<MagicWandIcon />
										</div>
										<p className="mt-3 font-semibold text-3xl tracking-tight">92</p>
										<p className="mt-1 text-[10px] opacity-75">
											<Trans>Strong fit for this role</Trans>
										</p>
									</div>
								</div>

								<div className="mt-3 rounded-xl border bg-card p-4">
									<div className="mb-3 flex items-center justify-between">
										<p className="font-medium text-xs">
											<Trans>Application pipeline</Trans>
										</p>
										<span className="text-[10px] text-muted-foreground">
											<Trans>3 active</Trans>
										</span>
									</div>
									<div className="space-y-2">
										{applications.map((application) => (
											<div
												key={application.company}
												className="flex items-center gap-3 rounded-lg bg-secondary/45 p-2.5"
											>
												<div className={`size-2 shrink-0 rounded-full ${application.color}`} />
												<div className="min-w-0 flex-1">
													<p className="truncate font-medium text-[11px]">{application.role}</p>
													<p className="truncate text-[10px] text-muted-foreground">{application.company}</p>
												</div>
												<span className="rounded-full border bg-background px-2 py-1 text-[9px]">
													{application.status}
												</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>

					<m.div
						className="absolute -right-2 -bottom-5 hidden items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-xl sm:flex"
						animate={{ y: [0, -5, 0] }}
						transition={{ duration: 3.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
					>
						<CheckCircleIcon className="size-5 text-primary" weight="fill" />
						<div>
							<p className="font-medium text-[11px]">
								<Trans>Resume ready</Trans>
							</p>
							<p className="text-[9px] text-muted-foreground">
								<Trans>Optimized for Product Designer</Trans>
							</p>
						</div>
					</m.div>
				</m.div>
			</div>
		</section>
	);
}
