import type { IconProps } from "@phosphor-icons/react";
import type { FeatureFlags } from "@reactive-resume/api/features/flags";
import type { AuthSession } from "@reactive-resume/auth/types";
import type { Locale } from "@reactive-resume/utils/locale";
import type { QueryClient } from "@tanstack/react-query";
import type { orpc } from "@/libs/orpc/client";
import type { Theme } from "@/libs/theme";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { IconContext } from "@phosphor-icons/react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { useEffect, useMemo } from "react";
import { Toaster } from "@reactive-resume/ui/components/sonner";
import { TooltipProvider } from "@reactive-resume/ui/components/tooltip";
import { BreakpointIndicator } from "@/components/layout/breakpoint-indicator";
import { DialogManager } from "@/dialogs/manager";
import { CommandPalette } from "@/features/command-palette";
import { ThemeProvider } from "@/features/theme/provider";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { PromptDialogProvider } from "@/hooks/use-prompt";
import { getAppUrl } from "@/libs/app-url";
import { getSession } from "@/libs/auth/session";
import { getLocale, isRTL, loadLocale } from "@/libs/locale";
import { client } from "@/libs/orpc/client";
import { getTheme } from "@/libs/theme";

type RouterContext = {
	theme: Theme;
	locale: Locale;
	orpc: typeof orpc;
	queryClient: QueryClient;
	session: AuthSession | null;
	flags: FeatureFlags;
};

const appName = "TNM HR Platform";
const tagline = "Turn experience into opportunity";
const title = `${appName} — ${tagline}`;
const description =
	"Create role-ready resumes, organize job applications, and use AI to make every career move more confident.";

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
	head: () => {
		const appUrl = getAppUrl();

		return {
			links: [
				// Icons
				{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml", sizes: "256x256 any" },
				// Manifest
				{ rel: "manifest", href: "/manifest.webmanifest", crossOrigin: "use-credentials" },
			],
			meta: [
				{ title },
				{ charSet: "UTF-8" },
				{ name: "description", content: description },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				// Meta Tags
				{ name: "theme-color", content: "#09090B" },
				{ name: "application-name", content: appName },
				{ name: "mobile-web-app-capable", content: "yes" },
				{ name: "apple-mobile-web-app-capable", content: "yes" },
				{ name: "apple-mobile-web-app-title", content: appName },
				{ name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
				// Twitter Tags
				{ property: "twitter:image", content: `${appUrl}/og.png` },
				{ property: "twitter:card", content: "summary_large_image" },
				{ property: "twitter:title", content: title },
				{ property: "twitter:description", content: description },
				// OpenGraph Tags
				{ property: "og:image", content: `${appUrl}/og.png` },
				{ property: "og:site_name", content: appName },
				{ property: "og:title", content: title },
				{ property: "og:description", content: description },
				{ property: "og:url", content: appUrl },
			],
		};
	},
	beforeLoad: async () => {
		const [theme, locale, session, flags] = await Promise.all([
			getTheme(),
			getLocale(),
			getSession(),
			client.flags.get(),
		]);

		await loadLocale(locale);

		return { theme, locale, session, flags };
	},
});

function RootComponent() {
	const { theme, locale, queryClient } = Route.useRouteContext();
	const dir = isRTL(locale) ? "rtl" : "ltr";

	const iconContextValue = useMemo<IconProps>(() => ({ size: 16, weight: "regular" }), []);

	useEffect(() => {
		document.documentElement.lang = locale;
		document.documentElement.dir = dir;
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [dir, locale, theme]);

	return (
		<>
			<HeadContent />

			<QueryClientProvider client={queryClient}>
				<MotionConfig reducedMotion="user">
					<LazyMotion features={domAnimation}>
						<I18nProvider i18n={i18n}>
							<IconContext.Provider value={iconContextValue}>
								<ThemeProvider theme={theme}>
									<HotkeysProvider>
										<DirectionProvider>
											<TooltipProvider>
												<ConfirmDialogProvider>
													<PromptDialogProvider>
														<Outlet />

														<DialogManager />
														<CommandPalette />
														<Toaster richColors position="bottom-center" />

														{import.meta.env.DEV && <BreakpointIndicator />}
														{import.meta.env.DEV && (
															<TanStackDevtools
																config={{ position: "bottom-left" }}
																plugins={[
																	{
																		name: "TanStack Query",
																		render: <ReactQueryDevtoolsPanel />,
																	},
																	{
																		name: "TanStack Router",
																		render: <TanStackRouterDevtoolsPanel />,
																	},
																]}
															/>
														)}
													</PromptDialogProvider>
												</ConfirmDialogProvider>
											</TooltipProvider>
										</DirectionProvider>
									</HotkeysProvider>
								</ThemeProvider>
							</IconContext.Provider>
						</I18nProvider>
					</LazyMotion>
				</MotionConfig>
			</QueryClientProvider>
		</>
	);
}
