import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./deploy-dokploy.mjs", import.meta.url));

function runDeploy(env) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [scriptPath, "deploy"], {
			env: { ...process.env, ...env },
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stderr = "";
		let stdout = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("close", (code) => resolve({ code, stderr, stdout }));
	});
}

test("updates the image, deploys, waits, and verifies health", async (context) => {
	const calls = [];
	let applicationReads = 0;

	const server = createServer(async (request, response) => {
		const body = [];
		for await (const chunk of request) body.push(chunk);
		const text = Buffer.concat(body).toString("utf8");
		calls.push({ body: text ? JSON.parse(text) : undefined, method: request.method, url: request.url });

		response.setHeader("Content-Type", "application/json");

		if (request.url?.startsWith("/api/application.one")) {
			applicationReads += 1;
			response.end(
				JSON.stringify({
					applicationId: "app-123",
					applicationStatus: applicationReads === 1 ? "running" : "done",
					name: "TNM HR Platform",
				}),
			);
			return;
		}

		if (request.url === "/api/health") {
			response.end(
				JSON.stringify({
					database: { status: "healthy" },
					service: "tnm-hr-platform",
					status: "healthy",
					storage: { status: "healthy" },
				}),
			);
			return;
		}

		response.end("{}");
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	context.after(() => server.close());

	const address = server.address();
	assert(address && typeof address === "object");
	const baseUrl = `http://127.0.0.1:${address.port}`;

	const result = await runDeploy({
		APP_URL: baseUrl,
		DOKPLOY_API_KEY: "test-api-key",
		DOKPLOY_APPLICATION_ID: "app-123",
		DOKPLOY_IMAGE: "ghcr.io/tnm/platform@sha256:abc",
		DOKPLOY_POLL_INTERVAL_MS: "10",
		DOKPLOY_URL: baseUrl,
	});

	assert.equal(result.code, 0, result.stderr);
	assert.match(result.stdout, /Dokploy application status: done/);
	assert.match(result.stdout, /"status": "healthy"/);
	assert.deepEqual(calls.find((call) => call.url === "/api/application.saveDockerProvider")?.body, {
		applicationId: "app-123",
		dockerImage: "ghcr.io/tnm/platform@sha256:abc",
		password: "",
		registryUrl: "",
		username: "",
	});
	assert(calls.some((call) => call.url === "/api/application.deploy"));
});
