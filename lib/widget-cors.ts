import { parseAllowedParents } from "./embed-bridge";

function requestOrigin(request: Request): string {
	const url = new URL(request.url);
	// Next's Request URL can name the internal listener. Host is the browser's
	// destination; the deployment proxy supplies the external HTTPS protocol.
	const host = request.headers.get("host");
	const protocol =
		request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
	if (host && (protocol === "http" || protocol === "https")) {
		return parseAllowedParents(`${protocol}://${host}`)[0] ?? url.origin;
	}
	return url.origin;
}

/** CORS is a browser integration policy, not authentication or an abuse limit. */
export function widgetCorsHeaders(
	request: Request,
	allowedOrigins: string | undefined,
): Headers | null {
	const headers = new Headers({ Vary: "Origin" });
	const origin = request.headers.get("Origin");
	if (!origin) return headers;
	const ownOrigin = requestOrigin(request);
	if (
		origin !== ownOrigin &&
		!parseAllowedParents(allowedOrigins).includes(origin)
	)
		return null;
	if (origin !== ownOrigin) {
		headers.set("Access-Control-Allow-Origin", origin);
		headers.set("Access-Control-Expose-Headers", "Retry-After");
	}
	return headers;
}

export function deniedOrigin(): Response {
	return Response.json(
		{ error: "Origine non autorisée." },
		{
			status: 403,
			headers: { Vary: "Origin" },
		},
	);
}

export function widgetPreflight(
	request: Request,
	allowedOrigins: string | undefined,
): Response {
	const headers = widgetCorsHeaders(request, allowedOrigins);
	const method = request.headers.get("Access-Control-Request-Method");
	const requestedHeaders =
		request.headers.get("Access-Control-Request-Headers") ?? "";
	if (
		!headers ||
		!request.headers.has("Origin") ||
		method !== "POST" ||
		requestedHeaders
			.split(",")
			.some(
				(name) => name.trim() && name.trim().toLowerCase() !== "content-type",
			)
	)
		return deniedOrigin();
	headers.set("Access-Control-Allow-Methods", "POST");
	headers.set("Access-Control-Allow-Headers", "Content-Type");
	headers.set(
		"Vary",
		"Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
	);
	return new Response(null, { status: 204, headers });
}
