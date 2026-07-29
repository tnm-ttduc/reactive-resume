// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

vi.stubGlobal("__APP_VERSION__", "9.9.9");

// The footer module evaluates `socialLinks = [{ label: t`...`, ... }]` at module
// scope. That `t` call needs an activated locale BEFORE the import, so do that
// here instead of in beforeAll.
i18n.loadAndActivate({ locale: "en", messages: {} });

const { Footer } = await import("./footer");

const renderFooter = () =>
	render(
		<I18nProvider i18n={i18n}>
			<Footer />
		</I18nProvider>,
	);

describe("Footer", () => {
	it("renders the TNM HR Platform brand", () => {
		renderFooter();
		expect(screen.getByText("TNM HR Platform")).toBeInTheDocument();
	});

	it("does not render upstream promotional or community links", () => {
		const { container } = renderFooter();
		expect(container.querySelectorAll("a")).toHaveLength(0);
	});

	it("includes TNM HR Platform version copy via Copyright", () => {
		renderFooter();
		// The version is wrapped in <bdi> for RTL isolation, so it is its own text node.
		expect(screen.getByText("9.9.9")).toBeInTheDocument();
	});
});
