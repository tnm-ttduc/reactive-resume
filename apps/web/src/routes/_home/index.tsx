import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl } from "@/libs/app-url";
import { createRootStructuredDataScript, getCanonicalRootUrl } from "@/libs/seo";
import { AiSpotlight } from "./-sections/ai-spotlight";
import { Faq } from "./-sections/faq";
import { Features } from "./-sections/features";
import { FinalCta } from "./-sections/final-cta";
import { Footer } from "./-sections/footer";
import { Hero } from "./-sections/hero";
import { Statistics } from "./-sections/statistics";
import { Templates } from "./-sections/templates";
import { Workflow } from "./-sections/workflow";

export const Route = createFileRoute("/_home/")({
	component: RouteComponent,
	head: () => {
		const appUrl = getAppUrl();
		const canonicalUrl = getCanonicalRootUrl(appUrl);

		return {
			links: [{ rel: "canonical", href: canonicalUrl }],
			scripts: [createRootStructuredDataScript(canonicalUrl)],
		};
	},
});

function RouteComponent() {
	return (
		<main id="main-content" className="relative">
			<Hero />

			<div className="container mx-auto px-4 sm:px-6 lg:px-12">
				<div className="border-border border-x [&>section:first-child]:border-t-0 [&>section]:border-border [&>section]:border-t">
					<Statistics />
					<Features />
					<Workflow />
					<AiSpotlight />
					<Templates />
					<FinalCta />
					<Faq />
					<Footer />
				</div>
			</div>
		</main>
	);
}
