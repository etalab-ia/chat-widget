import { describe, expect, it } from "vitest";
import {
  isEmbedResizeMessage,
  originOf,
  parseAllowedParents,
  resolveTargetOrigin,
} from "@/lib/embed-bridge";

describe("parseAllowedParents", () => {
  it("returns nothing when the variable is absent or empty", () => {
    expect(parseAllowedParents(undefined)).toEqual([]);
    expect(parseAllowedParents("")).toEqual([]);
    expect(parseAllowedParents("  ,  ")).toEqual([]);
  });

  it("keeps the origins of a comma-separated list", () => {
    expect(
      parseAllowedParents("https://intranet.example.gouv.fr, https://demo.example.org"),
    ).toEqual(["https://intranet.example.gouv.fr", "https://demo.example.org"]);
  });

  it("drops entries that are not bare origins", () => {
    // A path or a query in `frame-ancestors` does not mean what it looks like,
    // so anything that is not an origin is refused rather than passed through.
    expect(
      parseAllowedParents(
        "https://a.example/page,https://b.example/?x=1,ftp://c.example,a.example,not a url",
      ),
    ).toEqual([]);
  });

  it("drops a wildcard, which the CSP parser would accept but the bridge cannot match", () => {
    // `frame-ancestors https://*.example.com` loads the frame, but
    // `resolveTargetOrigin` compares whole origins, so the widget would fall
    // back to a wildcard target on every subdomain. Half-applied is worse than
    // refused.
    expect(parseAllowedParents("https://*.example.com")).toEqual([]);
  });

  it("drops an entry that would break the header grammar", () => {
    // A `;` survives the URL parser in the host and would be read as the start
    // of another CSP directive.
    expect(parseAllowedParents("https://a.example;frame-src")).toEqual([]);
    expect(parseAllowedParents("https://a.example;")).toEqual([]);
  });

  it("keeps a bracketed IPv6 origin", () => {
    expect(parseAllowedParents("http://[::1]:3000")).toEqual(["http://[::1]:3000"]);
  });

  it("normalises duplicates and trailing slashes", () => {
    expect(
      parseAllowedParents("https://a.example/,https://a.example,https://a.example/"),
    ).toEqual(["https://a.example"]);
  });

  it("keeps a non-default port, which changes the origin", () => {
    expect(parseAllowedParents("http://localhost:3000")).toEqual([
      "http://localhost:3000",
    ]);
  });
});

describe("originOf", () => {
  it("resolves a relative URL against the given base", () => {
    expect(originOf("/embed", "https://widget.example/demo?x=1")).toBe(
      "https://widget.example",
    );
  });

  it("returns null for something that is not a URL", () => {
    expect(originOf("not a url")).toBeNull();
  });
});

describe("resolveTargetOrigin", () => {
  const ownOrigin = "https://widget.example";

  it("addresses the parent at its own origin when the widget is embedded same-origin", () => {
    expect(
      resolveTargetOrigin({
        ownOrigin,
        allowedParents: [],
        referrer: "https://widget.example/demo",
      }),
    ).toBe(ownOrigin);
  });

  it("addresses an allowlisted cross-origin parent at its origin", () => {
    expect(
      resolveTargetOrigin({
        ownOrigin,
        allowedParents: ["https://intranet.example.gouv.fr"],
        referrer: "https://intranet.example.gouv.fr/",
      }),
    ).toBe("https://intranet.example.gouv.fr");
  });

  it("ignores the path and query of the referrer", () => {
    expect(
      resolveTargetOrigin({
        ownOrigin,
        allowedParents: ["https://intranet.example.gouv.fr"],
        referrer: "https://intranet.example.gouv.fr/page?secret=1",
      }),
    ).toBe("https://intranet.example.gouv.fr");
  });

  it("falls back to a wildcard when the referrer names an unlisted origin", () => {
    // `frame-ancestors` should have blocked this embedding already; the wildcard
    // is the only target left, and the message carries no data about the user.
    expect(
      resolveTargetOrigin({
        ownOrigin,
        allowedParents: ["https://intranet.example.gouv.fr"],
        referrer: "https://attacker.example/",
      }),
    ).toBe("*");
  });

  it("falls back to a wildcard when the referrer is withheld", () => {
    // A host page that sets `referrerpolicy="no-referrer"` leaves the widget
    // unable to learn its origin.
    expect(
      resolveTargetOrigin({ ownOrigin, allowedParents: [], referrer: "" }),
    ).toBe("*");
  });

  it("falls back to a wildcard when the referrer is not a usable URL", () => {
    // `about:client` is what the spec suggests for a withheld referrer; its
    // origin serialises as the string "null" and matches nothing.
    expect(
      resolveTargetOrigin({
        ownOrigin,
        allowedParents: [],
        referrer: "about:client",
      }),
    ).toBe("*");
  });
});

describe("isEmbedResizeMessage", () => {
  it("accepts the documented shape", () => {
    expect(
      isEmbedResizeMessage({ source: "anssi-widget", type: "resize", open: true }),
    ).toBe(true);
  });

  it("rejects other shapes", () => {
    expect(isEmbedResizeMessage(null)).toBe(false);
    expect(isEmbedResizeMessage("resize")).toBe(false);
    expect(isEmbedResizeMessage({ source: "anssi-widget", type: "resize" })).toBe(
      false,
    );
    expect(
      isEmbedResizeMessage({ source: "other", type: "resize", open: true }),
    ).toBe(false);
  });
});
