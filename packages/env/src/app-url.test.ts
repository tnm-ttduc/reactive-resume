import { describe, expect, it } from "vitest";
import { isReleaseSafeAppUrl } from "./app-url";

describe("isReleaseSafeAppUrl", () => {
	it.each([
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://0.0.0.0:3000",
		"http://[::1]:3000",
	])("rejects loopback APP_URL values in production: %s", (appUrl) => {
		expect(isReleaseSafeAppUrl(appUrl, "production")).toBe(false);
	});

	it("accepts an internal deployment hostname in production", () => {
		expect(isReleaseSafeAppUrl("https://hr.internal.example", "production")).toBe(true);
	});

	it("keeps localhost available for development and tests", () => {
		expect(isReleaseSafeAppUrl("http://localhost:3000", "development")).toBe(true);
		expect(isReleaseSafeAppUrl("http://localhost:3000", "test")).toBe(true);
	});
});
