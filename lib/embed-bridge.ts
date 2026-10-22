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
