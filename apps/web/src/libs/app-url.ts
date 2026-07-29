export const appUrlPlaceholder = "https://app.tnm.invalid";

export function getAppUrl(): string {
	if (typeof window !== "undefined") return window.location.origin;
	return appUrlPlaceholder;
}

export function getAppEndpoint(pathname: string): string {
	return new URL(pathname, getAppUrl()).toString();
}
