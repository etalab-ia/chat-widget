/**
 * Message contract between the embedded widget and its host page.
 *
 * An iframe cannot shrink to its content, so the widget announces whether it is
 * collapsed (a single launcher button) or open (the full panel) and the host
 * resizes the frame. The same contract is what a future web component would
 * consume, which is why it lives outside the React components.
 */

export const EMBED_MESSAGE_SOURCE = "anssi-widget";

export type EmbedResizeMessage = {
  source: typeof EMBED_MESSAGE_SOURCE;
  type: "resize";
  open: boolean;
};

/**
 * A scheme, a host and an optional port. Nothing else: `frame-ancestors` is a
 * space- and semicolon-delimited grammar, so an entry carrying either character
 * would be read as a second source or a second directive rather than as one
 * origin. The URL parser lowercases the host and drops a default port, so the
 * match is on its normalised output.
 */
const ORIGIN_PATTERN =
  /^https?:\/\/(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::\d+)?$/;

/**
 * Origins allowed to frame the widget, from `EMBED_ALLOWED_PARENTS`
 * (comma-separated).
 *
 * Only bare http(s) origins are kept. A path, a query or a fragment does not
 * narrow `frame-ancestors` the way it looks like it should, and a wildcard
 * (`https://*.example.com`) is accepted by the CSP parser but could never match
 * in `resolveTargetOrigin`, which compares whole origins — so the frame would
 * load while the widget fell back to a wildcard target. Both are refused here
 * rather than silently half-applied: list every host page instead.
 */
export function parseAllowedParents(raw: string | undefined): string[] {
  if (!raw) return [];

  const origins = new Set<string>();
  for (const entry of raw.split(",")) {
    const candidate = entry.trim();
    if (!candidate) continue;

    let origin: string;
    try {
      const url = new URL(candidate);
      if (url.pathname !== "/" || url.search || url.hash) continue;
      origin = url.origin;
    } catch {
      continue;
    }

    if (!ORIGIN_PATTERN.test(origin)) continue;
    origins.add(origin);
  }

  return [...origins];
}

/** Absolute origin of a URL, or null when it cannot be parsed. */
export function originOf(url: string, base?: string): string | null {
  try {
    return new URL(url, base).origin;
  } catch {
    return null;
  }
}

/**
 * Origin to address a `postMessage` at.
 *
 * The widget cannot read the parent's origin directly, so it takes it from the
 * referrer, which the browser truncates to the origin for a cross-origin
 * embedding (`strict-origin-when-cross-origin`). When the referrer is missing or
 * names an origin that is not allowed to frame the widget, the message falls
 * back to `"*"`: it carries the open/closed state and nothing else, and it is
 * addressed to `window.parent` only.
 */
export function resolveTargetOrigin({
  ownOrigin,
  allowedParents,
  referrer,
}: {
  ownOrigin: string;
  allowedParents: readonly string[];
  referrer: string;
}): string {
  if (!referrer) return "*";

  const parentOrigin = originOf(referrer);
  if (!parentOrigin) return "*";

  const allowed = new Set([ownOrigin, ...allowedParents]);
  return allowed.has(parentOrigin) ? parentOrigin : "*";
}
