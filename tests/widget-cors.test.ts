import { afterEach, describe, expect, it, vi } from "vitest";
import { widgetCorsHeaders, widgetPreflight } from "@/lib/widget-cors";

const allowed = "https://intranet.example.gouv.fr";
function request(origin?: string, headers: Record<string, string> = {}) {
	return new Request("https://widget.example.org/api/chat", {
		headers: { ...(origin ? { Origin: origin } : {}), ...headers },
	});
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("widget CORS", () => {
	it("recognises the public host behind a TLS-terminating proxy", () => {
		const proxied = new Request("http://localhost:8080/api/chat", {
			headers: {
				Host: "widget.example.org",
				"X-Forwarded-Proto": "https",
				Origin: "https://widget.example.org",
			},
		});
		expect(widgetCorsHeaders(proxied, undefined)).not.toBeNull();
		expect(
			widgetCorsHeaders(
				new Request(proxied, {
					headers: {
						Host: "widget.example.org",
						"X-Forwarded-Proto": "https",
						Origin: "https://evil.org",
					},
				}),
				undefined,
			),
		).toBeNull();
	});
	it("keeps same-origin and non-browser callers working without configuration", () => {
		expect(widgetCorsHeaders(request(), undefined)?.get("Vary")).toBe("Origin");
		expect(
			widgetCorsHeaders(request("https://widget.example.org"), undefined),
		).not.toBeNull();
		expect(widgetCorsHeaders(request(allowed), undefined)).toBeNull();
	});
	it("allows only an exact listed origin without granting credentials", () => {
		const headers = widgetCorsHeaders(request(allowed), allowed);
		expect(headers?.get("Access-Control-Allow-Origin")).toBe(allowed);
		expect(headers?.get("Access-Control-Expose-Headers")).toBe("Retry-After");
		expect(headers?.has("Access-Control-Allow-Credentials")).toBe(false);
		for (const bad of [
			"null",
			"https://intranet.example.gouv.fr.evil.org",
			"https://other.example.org",
		]) {
			expect(widgetCorsHeaders(request(bad), allowed)).toBeNull();
		}
	});
	it("rejects wildcard and malformed configuration entries", () => {
		for (const config of [
			"*",
			"https://*.example.gouv.fr",
			`${allowed}/path`,
			`${allowed};`,
		]) {
			expect(widgetCorsHeaders(request(allowed), config)).toBeNull();
		}
	});
	it("permits JSON POST preflight only", () => {
		const headers = {
			"Access-Control-Request-Method": "POST",
			"Access-Control-Request-Headers": "Content-Type",
		};
		const response = widgetPreflight(request(allowed, headers), allowed);
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowed);
		expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
			"Content-Type",
		);
		expect(
			widgetPreflight(
				request(allowed, {
					...headers,
					"Access-Control-Request-Method": "DELETE",
				}),
				allowed,
			).status,
		).toBe(403);
		expect(
			widgetPreflight(
				request(allowed, {
					...headers,
					"Access-Control-Request-Headers": "Content-Type, Authorization",
				}),
				allowed,
			).status,
		).toBe(403);
		expect(
			widgetPreflight(request("https://evil.org", headers), allowed).status,
		).toBe(403);
	});
	it("rejects an unlisted POST before parsing or calling Albert", async () => {
		vi.stubEnv("WIDGET_ALLOWED_ORIGINS", "");
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const { POST } = await import("@/app/api/chat/route");
		const response = await POST(request(allowed));
		expect(response.status).toBe(403);
		expect(fetchMock).not.toHaveBeenCalled();
	});
	it("adds CORS to validation errors so allowed hosts can read them", async () => {
		vi.stubEnv("WIDGET_ALLOWED_ORIGINS", allowed);
		const { POST } = await import("@/app/api/chat/route");
		const response = await POST(request(allowed));
		expect(response.status).toBe(400);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(allowed);
		expect(await response.json()).toHaveProperty("error");
	});
});
