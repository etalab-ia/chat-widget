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

export const COLLAPSED_SIZE = { width: 88, height: 88 } as const;
export const EXPANDED_SIZE = { width: 420, height: 620 } as const;

export function isEmbedResizeMessage(value: unknown): value is EmbedResizeMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EmbedResizeMessage>;
  return (
    candidate.source === EMBED_MESSAGE_SOURCE &&
    candidate.type === "resize" &&
    typeof candidate.open === "boolean"
  );
}

/**
 * Origins allowed to frame the widget, from `EMBED_ALLOWED_PARENTS`
 * (comma-separated). Only bare http(s) origins are kept: a path, a query or a
 * wildcard would make the `frame-ancestors` directive mean something else than
 * what it reads like.
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
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (url.pathname !== "/" || url.search || url.hash) continue;
      origin = url.origin;
    } catch {
      continue;
    }

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
