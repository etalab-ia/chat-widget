import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextConfig } from "next";

/**
 * The response headers are the control that actually bounds who can embed the
 * widget, so they are asserted here rather than only checked by hand against a
 * running server. `EMBED_ALLOWED_PARENTS` is read when the config module loads,
 * hence a fresh import per case.
 */
async function loadConfig(allowedParents?: string): Promise<NextConfig> {
  vi.resetModules();
  if (allowedParents === undefined) {
    delete process.env.EMBED_ALLOWED_PARENTS;
  } else {
    process.env.EMBED_ALLOWED_PARENTS = allowedParents;
  }
  const mod = await import("../next.config");
  return mod.default;
}

async function headersFor(
  config: NextConfig,
  source: string,
): Promise<Record<string, string>> {
  const entries = (await config.headers?.()) ?? [];
  const headers: Record<string, string> = {};
  for (const entry of entries) {
    // Later entries win, which is how Next resolves two rules setting one key.
    if (entry.source === source) {
      for (const header of entry.headers) headers[header.key] = header.value;
    }
  }
  return headers;
}

afterEach(() => {
  delete process.env.EMBED_ALLOWED_PARENTS;
});

describe("security headers", () => {
  it("refuses to let any site frame /embed when no parent is configured", async () => {
    const headers = await headersFor(await loadConfig(), "/embed");
    expect(headers["Content-Security-Policy"]).toBe(
      "frame-ancestors 'self'; frame-src 'none'",
    );
  });

  it("adds the configured parents to frame-ancestors", async () => {
    const headers = await headersFor(
      await loadConfig("https://intranet.example.gouv.fr,https://demo.example.org"),
      "/embed",
    );
    expect(headers["Content-Security-Policy"]).toBe(
      "frame-ancestors 'self' https://intranet.example.gouv.fr https://demo.example.org; frame-src 'none'",
    );
  });

  it("does not let a malformed entry reach the header", async () => {
    const headers = await headersFor(
      await loadConfig("https://*.example.com,https://a.example;frame-src"),
      "/embed",
    );
    expect(headers["Content-Security-Policy"]).toBe(
      "frame-ancestors 'self'; frame-src 'none'",
    );
  });

  it("keeps the demo page unframable and limited to framing its own widget", async () => {
    const headers = await headersFor(await loadConfig(), "/");
    expect(headers["Content-Security-Policy"]).toBe(
      "frame-ancestors 'none'; frame-src 'self'",
    );
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("denies device APIs on every route", async () => {
    const headers = await headersFor(await loadConfig(), "/:path*");
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(headers["Permissions-Policy"]).toContain(`${feature}=()`);
    }
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});
