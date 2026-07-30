#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_BRANCH = "main";
const DEFAULT_HEALTH_URL = "https://hr-platform.nomad.id.vn/api/health";
const DEFAULT_REMOTE = "origin";
const DEFAULT_WORKFLOW = "docker-build.yml";

function parseArgs(argv) {
	const options = {
		dryRun: false,
		healthUrl: DEFAULT_HEALTH_URL,
		message: "",
		repository: "",
		skipChecks: false,
		version: "",
	};

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === "--") continue;
		if (argument === "--dry-run") options.dryRun = true;
		else if (argument === "--skip-checks") options.skipChecks = true;
		else if (argument === "--message" || argument === "-m") options.message = argv[++index] ?? "";
		else if (argument === "--version") options.version = argv[++index] ?? "";
		else if (argument === "--health-url") options.healthUrl = argv[++index] ?? "";
		else if (argument === "--repo") options.repository = argv[++index] ?? "";
		else if (!argument.startsWith("-") && !options.message) options.message = argument;
		else throw new Error(`Unknown argument: ${argument}`);
	}

	if (!options.message) {
		throw new Error(
			'Provide a commit message, for example: pnpm release:production -- --message "feat: improve candidates"',
		);
	}

	return options;
}

function run(command, args, options = {}) {
	const printable = [command, ...args].join(" ");
	console.info(`\n> ${printable}`);

	if (options.dryRun) return "";

	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		env: process.env,
		stdio: options.capture ? ["inherit", "pipe", "inherit"] : "inherit",
	});

	if (result.status !== 0) {
		throw new Error(`Command failed (${result.status ?? "unknown"}): ${printable}`);
	}

	return options.capture ? result.stdout.trim() : "";
}

function capture(command, args, cwd) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `Command failed: ${command} ${args.join(" ")}`);
	}

	return result.stdout.trim();
}

function parseVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
	if (!match) throw new Error(`Expected a stable semantic version, received: ${version}`);
	return match.slice(1).map(Number);
}

function nextPatchVersion(version) {
	const [major, minor, patch] = parseVersion(version);
	return `${major}.${minor}.${patch + 1}`;
}

function normalizeVersion(version) {
	return version.replace(/^v/, "");
}

function getRepository(remoteUrl) {
	const match = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remoteUrl);
	if (!match) throw new Error(`Cannot derive GitHub repository from origin URL: ${remoteUrl}`);
	return match[1];
}

function waitForWorkflowRun({ cwd, repository, tag }) {
	const deadline = Date.now() + 2 * 60_000;

	while (Date.now() < deadline) {
		const output = capture(
			"gh",
			[
				"run",
				"list",
				"--repo",
				repository,
				"--workflow",
				DEFAULT_WORKFLOW,
				"--branch",
				tag,
				"--event",
				"push",
				"--limit",
				"1",
				"--json",
				"databaseId,url",
			],
			cwd,
		);
		const runs = JSON.parse(output || "[]");
		if (runs[0]?.databaseId) return runs[0];

		console.info(`Waiting for GitHub Actions run for ${tag}...`);
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5_000);
	}

	throw new Error(`Timed out waiting for the ${tag} GitHub Actions run`);
}

async function verifyHealth(url) {
	console.info(`\n> Verify production health: ${url}`);

	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		signal: AbortSignal.timeout(20_000),
	});
	const body = await response.text();
	if (!response.ok) throw new Error(`Health check failed (${response.status}): ${body.slice(0, 300)}`);

	const health = JSON.parse(body);
	if (health.status !== "healthy" || health.database?.status !== "healthy" || health.storage?.status !== "healthy") {
		throw new Error(`Production is not healthy: ${body.slice(0, 500)}`);
	}

	console.info(
		JSON.stringify(
			{
				database: health.database.status,
				service: health.service,
				status: health.status,
				storage: health.storage.status,
				storageType: health.storage.type,
			},
			null,
			2,
		),
	);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const cwd = capture("git", ["rev-parse", "--show-toplevel"], process.cwd());
	const packagePath = resolve(cwd, "package.json");
	const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
	const version = normalizeVersion(options.version || nextPatchVersion(packageJson.version));
	const tag = `v${version}`;
	const remoteUrl = capture("git", ["remote", "get-url", DEFAULT_REMOTE], cwd);
	const repository = options.repository || getRepository(remoteUrl);

	parseVersion(version);
	run("gh", ["auth", "status"], { cwd, dryRun: options.dryRun });
	run("git", ["fetch", DEFAULT_REMOTE, DEFAULT_BRANCH, "--tags"], { cwd, dryRun: options.dryRun });

	if (!options.dryRun) {
		run("git", ["merge-base", "--is-ancestor", `${DEFAULT_REMOTE}/${DEFAULT_BRANCH}`, "HEAD"], { cwd });
		const status = capture("git", ["status", "--porcelain"], cwd);
		if (!status) throw new Error("There are no working-tree changes to release");

		const existingTag = spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], { cwd });
		if (existingTag.status === 0) throw new Error(`Tag ${tag} already exists`);
	}

	console.info(`\nRelease plan: ${repository} ${tag} -> production`);

	if (!options.skipChecks) {
		run("pnpm", ["check"], { cwd, dryRun: options.dryRun });
		run("pnpm", ["typecheck"], { cwd, dryRun: options.dryRun });
		run("pnpm", ["test"], { cwd, dryRun: options.dryRun });
	}

	run("git", ["add", "-A"], { cwd, dryRun: options.dryRun });
	run("git", ["commit", "-m", options.message], { cwd, dryRun: options.dryRun });

	if (!options.dryRun) {
		packageJson.version = version;
		writeFileSync(packagePath, `${JSON.stringify(packageJson, null, "\t")}\n`);
	}

	run("git", ["add", "package.json"], { cwd, dryRun: options.dryRun });
	run("git", ["commit", "-m", `chore(release): ${tag}`], { cwd, dryRun: options.dryRun });
	run("git", ["tag", "-a", tag, "-m", `Release ${tag}`], { cwd, dryRun: options.dryRun });
	run("git", ["push", "--atomic", DEFAULT_REMOTE, `HEAD:${DEFAULT_BRANCH}`, `refs/tags/${tag}`], {
		cwd,
		dryRun: options.dryRun,
	});

	if (options.dryRun) {
		console.info("\nDry run completed; no files, commits, tags, or remote refs were changed.");
		return;
	}

	const workflowRun = waitForWorkflowRun({ cwd, repository, tag });
	console.info(`GitHub Actions: ${workflowRun.url}`);
	run(
		"gh",
		["run", "watch", String(workflowRun.databaseId), "--repo", repository, "--exit-status", "--interval", "10"],
		{
			cwd,
		},
	);
	await verifyHealth(options.healthUrl);
	console.info(`\nRelease ${tag} deployed successfully.`);
}

main().catch((error) => {
	console.error(`\nRelease failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
