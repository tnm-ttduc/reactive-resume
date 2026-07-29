import { describe, expect, it } from "vitest";
import { resolveAiBaseUrl } from "./url-policy";

describe("AI provider base URL policy", () => {
	it("allows public HTTPS provider URLs", () => {
		expect(resolveAiBaseUrl({ provider: "openai", baseURL: "https://api.openai.com/v1" }, { allowUnsafe: false })).toBe(
			"https://api.openai.com/v1",
		);
	});

	it("blocks private and non-HTTPS provider URLs by default", () => {
		expect(() =>
			resolveAiBaseUrl(
				{ provider: "openai-compatible", baseURL: "https://localhost:11434/v1" },
				{ allowUnsafe: false },
			),
		).toThrow("INVALID_AI_BASE_URL");
		expect(() =>
			resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "http://example.com/v1" }, { allowUnsafe: false }),
		).toThrow("INVALID_AI_BASE_URL");
	});

	it("allows private and non-HTTPS provider URLs when explicitly enabled", () => {
		expect(
			resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "http://localhost:11434/v1" }, { allowUnsafe: true }),
		).toBe("http://localhost:11434/v1");
		expect(
			resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "https://10.0.0.5/v1" }, { allowUnsafe: true }),
		).toBe("https://10.0.0.5/v1");
	});

	it("rejects non-HTTP schemes even when unsafe provider URLs are enabled", () => {
		expect(() =>
			resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "file:///etc/passwd" }, { allowUnsafe: true }),
		).toThrow("INVALID_AI_BASE_URL");
		expect(() =>
			resolveAiBaseUrl({ provider: "openai-compatible", baseURL: "ftp://example.com/v1" }, { allowUnsafe: true }),
		).toThrow("INVALID_AI_BASE_URL");
	});
});
