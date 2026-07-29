// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

type SectionBaseProps = {
	children: React.ReactNode;
};

vi.mock("../shared/section-base", () => ({
	SectionBase: ({ children }: SectionBaseProps) => <div>{children}</div>,
}));

const { InformationSectionBuilder } = await import("./information");

beforeAll(() => {
	i18n.loadAndActivate({ locale: "en", messages: {} });
});

const renderInfo = () =>
	render(
		<I18nProvider i18n={i18n}>
			<InformationSectionBuilder />
		</I18nProvider>,
	);

describe("InformationSectionBuilder", () => {
	it("renders neutral platform information", () => {
		renderInfo();
		expect(screen.getByText("TNM HR Platform")).toBeInTheDocument();
		expect(screen.getByText(/Create, manage, and share professional resumes/)).toBeInTheDocument();
	});

	it("does not include promotional or community links", () => {
		renderInfo();
		expect(screen.queryAllByRole("link")).toHaveLength(0);
	});
});
