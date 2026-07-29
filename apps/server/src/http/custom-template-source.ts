import { readCustomTemplateSource } from "@reactive-resume/api/features/custom-templates/source";
import { auth } from "@reactive-resume/auth/config";

function errorStatus(error: unknown) {
	const code = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : undefined;
	return code === "NOT_FOUND" ? 404 : 500;
}

function toArrayBuffer(data: Uint8Array) {
	return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export async function handleCustomTemplateSource(request: Request, id: string) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });
	}

	try {
		const source = await readCustomTemplateSource({ id, userId: session.user.id });
		const encodedFilename = encodeURIComponent(source.filename);
		return new Response(toArrayBuffer(source.data), {
			headers: {
				"Content-Type": source.mediaType,
				"Content-Length": source.size.toString(),
				"Content-Disposition": `inline; filename*=UTF-8''${encodedFilename}`,
				"Cache-Control": "private, no-store",
				"X-Content-Type-Options": "nosniff",
				"X-Frame-Options": "SAMEORIGIN",
				"Cross-Origin-Resource-Policy": "same-origin",
			},
		});
	} catch (error) {
		return new Response("Template source not found", {
			status: errorStatus(error),
			headers: { "Cache-Control": "private, no-store" },
		});
	}
}
