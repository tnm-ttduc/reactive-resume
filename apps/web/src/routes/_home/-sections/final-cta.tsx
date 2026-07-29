import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { m } from "motion/react";
import { Button } from "@reactive-resume/ui/components/button";

export function FinalCta() {
	return (
		<section className="relative overflow-hidden p-4 text-center md:p-8 xl:p-16">
			<div
				aria-hidden="true"
				className="absolute inset-x-1/4 top-0 h-px bg-linear-to-r from-transparent via-primary to-transparent"
			/>
			<m.div
				className="mx-auto flex max-w-3xl flex-col items-center py-10 md:py-16"
				initial={{ opacity: 0, y: 20 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true }}
				transition={{ duration: 0.45 }}
			>
				<p className="font-semibold text-primary text-xs uppercase tracking-[0.2em]">
					<Trans>Your next move starts here</Trans>
				</p>
				<h2 className="mt-4 text-balance font-semibold text-4xl tracking-tight md:text-6xl">
					<Trans>Make your experience impossible to overlook.</Trans>
				</h2>
				<p className="mt-5 max-w-xl text-balance text-muted-foreground leading-relaxed">
					<Trans>
						Build a stronger career profile, create a resume for the opportunity ahead, and keep every application
						moving.
					</Trans>
				</p>
				<Button
					size="lg"
					nativeButton={false}
					className="group mt-8"
					render={
						<Link to="/dashboard">
							<Trans>Start building</Trans>
							<ArrowRightIcon className="transition-transform group-hover:translate-x-0.5" />
						</Link>
					}
				/>
			</m.div>
		</section>
	);
}
