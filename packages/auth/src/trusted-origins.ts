export function getTrustedOrigins(appUrl: string): string[] {
	const normalizeOrigin = (origin: string): string => origin.replace(/\/$/, "");
	const configuredUrl = new URL(appUrl);
	const trustedOrigins = new Set<string>([normalizeOrigin(configuredUrl.origin)]);

	if (configuredUrl.hostname === "localhost" || configuredUrl.hostname === "127.0.0.1") {
		const loopbackAlias = configuredUrl.hostname === "localhost" ? "127.0.0.1" : "localhost";
		configuredUrl.hostname = loopbackAlias;
		trustedOrigins.add(normalizeOrigin(configuredUrl.origin));
	}

	return Array.from(trustedOrigins);
}
