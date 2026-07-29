#!/usr/bin/env node

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_WAIT_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_HEALTH_TIMEOUT_MS = 2 * 60_000;

const command = process.argv[2] ?? "preflight";

function requireEnv(name) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function optionalEnv(name) {
	const value = process.env[name]?.trim();
	return value || undefined;
}

function parsePositiveInteger(name, fallback) {
	const raw = optionalEnv(name);
	if (!raw) return fallback;

	const value = Number.parseInt(raw, 10);
	if (!Number.isFinite(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}

	return value;
}

function normalizeBaseUrl(value) {
	return value.replace(/\/+$/, "").replace(/\/api$/, "");
}

function getConfig() {
	return {
		apiKey: requireEnv("DOKPLOY_API_KEY"),
		applicationId: requireEnv("DOKPLOY_APPLICATION_ID"),
		baseUrl: normalizeBaseUrl(requireEnv("DOKPLOY_URL")),
		healthUrl: optionalEnv("DOKPLOY_HEALTH_URL") ?? optionalEnv("APP_URL"),
		image: optionalEnv("DOKPLOY_IMAGE"),
		pollIntervalMs: parsePositiveInteger("DOKPLOY_POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS),
		registryPassword: optionalEnv("DOKPLOY_REGISTRY_PASSWORD"),
		registryUrl: optionalEnv("DOKPLOY_REGISTRY_URL") ?? "",
		registryUsername: optionalEnv("DOKPLOY_REGISTRY_USERNAME") ?? "",
		waitTimeoutMs: parsePositiveInteger("DOKPLOY_WAIT_TIMEOUT_MS", DEFAULT_WAIT_TIMEOUT_MS),
	};
}

function getData(payload) {
	if (payload && typeof payload === "object" && "data" in payload) return payload.data;
	return payload;
}

function getApplicationSummary(payload) {
	const application = getData(payload) ?? {};
	return {
		applicationId: application.applicationId,
		applicationStatus: application.applicationStatus ?? application.status,
		appName: application.appName,
		dockerImage: application.dockerImage,
		name: application.name,
	};
}

async function dokployRequest(config, path, init = {}) {
	const response = await fetch(`${config.baseUrl}/api/${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			"x-api-key": config.apiKey,
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...init.headers,
		},
		signal: AbortSignal.timeout(30_000),
	});

	const responseText = await response.text();
	let payload;

	try {
		payload = responseText ? JSON.parse(responseText) : {};
	} catch {
		payload = { message: responseText };
	}

	if (!response.ok) {
		const message = payload?.message ?? payload?.error ?? response.statusText;
		throw new Error(`Dokploy API ${path} failed (${response.status}): ${message}`);
	}

	return payload;
}

async function getApplication(config) {
	const query = new URLSearchParams({ applicationId: config.applicationId });
	return dokployRequest(config, `application.one?${query}`);
}

async function printApplication(config) {
	const payload = await getApplication(config);
	console.info(JSON.stringify(getApplicationSummary(payload), null, 2));
}

async function setImage(config) {
	if (!config.image) return;

	if ((config.registryUsername && !config.registryPassword) || (!config.registryUsername && config.registryPassword)) {
		throw new Error(
			"DOKPLOY_REGISTRY_USERNAME and DOKPLOY_REGISTRY_PASSWORD must either both be set or both be omitted",
		);
	}

	console.info(`Updating Dokploy image to ${config.image}`);
	await dokployRequest(config, "application.saveDockerProvider", {
		method: "POST",
		body: JSON.stringify({
			applicationId: config.applicationId,
			dockerImage: config.image,
			password: config.registryPassword ?? "",
			registryUrl: config.registryUrl,
			username: config.registryUsername,
		}),
	});
}

async function triggerDeploy(config) {
	console.info(`Triggering Dokploy deployment for application ${config.applicationId}`);
	await dokployRequest(config, "application.deploy", {
		method: "POST",
		body: JSON.stringify({ applicationId: config.applicationId }),
	});
}

async function waitForDeployment(config) {
	const startedAt = Date.now();
	let observedRunning = false;
	let lastStatus;

	while (Date.now() - startedAt < config.waitTimeoutMs) {
		const summary = getApplicationSummary(await getApplication(config));
		const status = summary.applicationStatus;

		if (status !== lastStatus) {
			console.info(`Dokploy application status: ${status ?? "unknown"}`);
			lastStatus = status;
		}

		if (status === "error") throw new Error("Dokploy deployment reported an error");
		if (status === "running") observedRunning = true;
		if (status === "done" && (observedRunning || Date.now() - startedAt >= config.pollIntervalMs)) return;

		await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
	}

	throw new Error(`Timed out after ${config.waitTimeoutMs}ms waiting for Dokploy deployment`);
}

function getHealthUrl(config) {
	if (!config.healthUrl) {
		throw new Error("Set DOKPLOY_HEALTH_URL or APP_URL before running the smoke check");
	}

	const baseUrl = normalizeBaseUrl(config.healthUrl);
	return baseUrl.endsWith("/api/health") ? baseUrl : `${baseUrl}/api/health`;
}

async function waitForHealth(config) {
	const healthUrl = getHealthUrl(config);
	const startedAt = Date.now();
	let lastError;

	console.info(`Waiting for health check: ${healthUrl}`);

	while (Date.now() - startedAt < DEFAULT_HEALTH_TIMEOUT_MS) {
		try {
			const response = await fetch(healthUrl, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(10_000),
			});
			const body = await response.text();

			if (response.ok) {
				const health = JSON.parse(body);
				console.info(
					JSON.stringify(
						{
							database: health.database?.status,
							service: health.service,
							status: health.status,
							storage: health.storage?.status,
						},
						null,
						2,
					),
				);
				return;
			}

			lastError = `HTTP ${response.status}: ${body.slice(0, 300)}`;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}

		await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
	}

	throw new Error(`Health check did not become ready: ${lastError ?? "unknown error"}`);
}

async function main() {
	const config = getConfig();

	switch (command) {
		case "preflight":
			await printApplication(config);
			console.info("Dokploy API preflight passed");
			break;
		case "inspect":
			await printApplication(config);
			break;
		case "deploy":
			await setImage(config);
			await triggerDeploy(config);
			await waitForDeployment(config);
			if (config.healthUrl) await waitForHealth(config);
			else console.warn("Skipping smoke check because DOKPLOY_HEALTH_URL and APP_URL are unset");
			break;
		case "wait":
			await waitForDeployment(config);
			break;
		case "smoke":
			await waitForHealth(config);
			break;
		default:
			throw new Error(`Unknown command "${command}". Use: preflight, inspect, deploy, wait, or smoke`);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
