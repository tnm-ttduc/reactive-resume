const loopbackHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export function isReleaseSafeAppUrl(value: string, nodeEnv = process.env.NODE_ENV): boolean {
	if (nodeEnv !== "production") return true;
	return !loopbackHostnames.has(new URL(value).hostname);
}
