import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	readCustomTemplateSource: vi.fn(),
}));

vi.mock("@reactive-resume/auth/config", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@reactive-resume/api/features/custom-templates/source", () => ({
	readCustomTemplateSource: mocks.readCustomTemplateSource,
}));

const { handleCustomTemplateSource } = await import("./custom-template-source");

describe("handleCustomTemplateSource", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("serves the owned source inline with private caching", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
		mocks.readCustomTemplateSource.mockResolvedValue({
			filename: "Original CV.pdf",
			mediaType: "application/pdf",
			size: 4,
			data: new Uint8Array([37, 80, 68, 70]),
		});

		const request = new Request("https://example.com/api/custom-templates/template-1/source", {
			headers: { cookie: "session=test" },
		});
		const response = await handleCustomTemplateSource(request, "template-1");

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/pdf");
		expect(response.headers.get("Content-Disposition")).toContain("inline");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
		expect(await response.text()).toBe("%PDF");
		expect(mocks.readCustomTemplateSource).toHaveBeenCalledWith({ id: "template-1", userId: "user-1" });
	});

	it("rejects unauthenticated source access", async () => {
		mocks.getSession.mockResolvedValue(null);

		const response = await handleCustomTemplateSource(
			new Request("https://example.com/api/custom-templates/template-1/source"),
			"template-1",
		);

		expect(response.status).toBe(401);
		expect(mocks.readCustomTemplateSource).not.toHaveBeenCalled();
	});
});
