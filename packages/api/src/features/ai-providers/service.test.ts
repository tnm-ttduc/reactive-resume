import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, envMock, queryMock, queryState } = vi.hoisted(() => {
	const state = {
		rows: [] as unknown[],
		whereArg: undefined as unknown,
		orderByArgs: [] as unknown[],
	};
	const query = {
		from: vi.fn(() => query),
		where: vi.fn((arg: unknown) => {
			state.whereArg = arg;
			return query;
		}),
		orderBy: vi.fn((...args: unknown[]) => {
			state.orderByArgs = args;
			return query;
		}),
		limit: vi.fn(async () => state.rows),
	};

	return {
		dbMock: { select: vi.fn(() => query) },
		envMock: {
			AI_PROVIDER_BASE_URL: undefined as string | undefined,
			AI_PROVIDER_API_KEY: undefined as string | undefined,
			AI_PROVIDER_MODEL: undefined as string | undefined,
		},
		queryMock: query,
		queryState: state,
	};
});

vi.mock("@reactive-resume/db/client", () => ({ db: dbMock }));
vi.mock("@reactive-resume/env/server", () => ({ env: envMock }));
vi.mock("@reactive-resume/db/schema", () => ({
	aiProvider: {
		id: "ai_provider.id",
		userId: "ai_provider.user_id",
		label: "ai_provider.label",
		provider: "ai_provider.provider",
		model: "ai_provider.model",
		baseUrl: "ai_provider.base_url",
		encryptedApiKey: "ai_provider.encrypted_api_key",
		apiKeySalt: "ai_provider.api_key_salt",
		apiKeyHash: "ai_provider.api_key_hash",
		apiKeyPreview: "ai_provider.api_key_preview",
		testStatus: "ai_provider.test_status",
		testError: "ai_provider.test_error",
		lastTestedAt: "ai_provider.last_tested_at",
		lastUsedAt: "ai_provider.last_used_at",
		enabled: "ai_provider.enabled",
		createdAt: "ai_provider.created_at",
		updatedAt: "ai_provider.updated_at",
	},
}));
vi.mock("drizzle-orm", () => ({
	and: (...conditions: unknown[]) => ({ type: "and", conditions }),
	asc: (value: unknown) => ({ type: "asc", value }),
	desc: (value: unknown) => ({ type: "desc", value }),
	eq: (left: unknown, right: unknown) => ({ type: "eq", left, right }),
	sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings: [...strings], values }),
}));
vi.mock("../ai/credentials", () => ({
	assertCredentialEncryptionConfigured: vi.fn(),
	decryptCredential: vi.fn(() => "decrypted-key"),
	encryptCredential: vi.fn(),
	isCredentialEncryptionConfigured: vi.fn(() => false),
	redactEncryptedCredential: vi.fn(() => ({
		apiKeyFingerprint: "fingerprint",
		apiKeyPreview: "sk-...test",
	})),
}));
vi.mock("../ai/service", () => ({ testConnection: vi.fn() }));
vi.mock("../ai/url-policy", () => ({
	resolveAiBaseUrl: vi.fn(({ baseURL }: { baseURL: string }) => baseURL),
}));

const { aiProvidersService } = await import("./service");

function providerRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "provider-1",
		userId: "user-1",
		label: "OpenAI",
		provider: "openai",
		model: "gpt-5-mini",
		baseUrl: null,
		encryptedApiKey: "encrypted-key",
		apiKeySalt: "salt",
		apiKeyHash: "hash",
		apiKeyPreview: "preview",
		testStatus: "success",
		testError: null,
		lastTestedAt: new Date("2026-07-01T00:00:00Z"),
		lastUsedAt: new Date("2026-07-07T00:00:00Z"),
		enabled: true,
		createdAt: new Date("2026-07-01T00:00:00Z"),
		updatedAt: new Date("2026-07-01T00:00:00Z"),
		...overrides,
	};
}

describe("aiProvidersService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		envMock.AI_PROVIDER_BASE_URL = undefined;
		envMock.AI_PROVIDER_API_KEY = undefined;
		envMock.AI_PROVIDER_MODEL = undefined;
		queryState.rows = [];
		queryState.whereArg = undefined;
		queryState.orderByArgs = [];
	});

	it("uses the server environment provider before user providers", async () => {
		envMock.AI_PROVIDER_BASE_URL = "https://ai.example.com/v1";
		envMock.AI_PROVIDER_API_KEY = "secret-key";
		envMock.AI_PROVIDER_MODEL = "example-model";

		await expect(aiProvidersService.getDefaultRunnable({ userId: "user-1" })).resolves.toMatchObject({
			id: "environment:openai-compatible",
			provider: "openai-compatible",
			model: "example-model",
			baseURL: "https://ai.example.com/v1",
			apiKey: "secret-key",
			source: "environment",
		});

		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it("lists the environment provider without exposing its API key", async () => {
		envMock.AI_PROVIDER_BASE_URL = "https://ai.example.com/v1";
		envMock.AI_PROVIDER_API_KEY = "secret-key";
		envMock.AI_PROVIDER_MODEL = "example-model";

		const [provider] = await aiProvidersService.list({ userId: "user-1" });

		expect(provider).toMatchObject({
			id: "environment:openai-compatible",
			apiKeyPreview: "Configured on server",
			source: "environment",
		});
		expect(provider).not.toHaveProperty("apiKey");
		expect(dbMock.select).not.toHaveBeenCalled();
	});

	it("rejects a partially configured environment provider", async () => {
		envMock.AI_PROVIDER_BASE_URL = "https://ai.example.com/v1";
		envMock.AI_PROVIDER_MODEL = "example-model";

		await expect(aiProvidersService.getDefaultRunnable({ userId: "user-1" })).rejects.toThrow(
			"AI_ENV_PROVIDER_INCOMPLETE",
		);
	});

	it("resolves the environment provider by its stable ID", async () => {
		envMock.AI_PROVIDER_BASE_URL = "https://ai.example.com/v1";
		envMock.AI_PROVIDER_API_KEY = "secret-key";
		envMock.AI_PROVIDER_MODEL = "example-model";

		await expect(
			aiProvidersService.getRunnableById({ id: "environment:openai-compatible", userId: "user-1" }),
		).resolves.toMatchObject({ apiKey: "secret-key", source: "environment" });
	});

	it("gets the first enabled and tested provider by creation order", async () => {
		queryState.rows = [providerRow({ id: "first-created" })];

		await expect(aiProvidersService.getDefaultRunnable({ userId: "user-1" })).resolves.toMatchObject({
			id: "first-created",
			apiKey: "decrypted-key",
		});

		expect(queryState.whereArg).toEqual({
			type: "and",
			conditions: [
				{ type: "eq", left: "ai_provider.user_id", right: "user-1" },
				{ type: "eq", left: "ai_provider.enabled", right: true },
				{ type: "eq", left: "ai_provider.test_status", right: "success" },
			],
		});
		expect(queryState.orderByArgs).toEqual([{ type: "asc", value: "ai_provider.created_at" }]);
		expect(queryMock.limit).toHaveBeenCalledWith(1);
	});
});
