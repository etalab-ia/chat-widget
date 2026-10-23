import type { Metadata } from "next";
import { EmbedWidget } from "@/components/widget/embed-widget";
import { parseAllowedParents } from "@/lib/embed-bridge";

export const metadata: Metadata = {
  title: "Assistant ANSSI",
  robots: { index: false, follow: false },
};

/**
 * Read once per process so the widget's resize messages are addressed at a
 * stable origin, and to the same list that `frame-ancestors` is built from in
 * `next.config.ts`.
 */
const ALLOWED_PARENTS = parseAllowedParents(process.env.EMBED_ALLOWED_PARENTS);

/**
 * Standalone surface intended to be embedded in an iframe. It carries only the
 * widget: no site chrome, transparent background.
 */
export default function EmbedPage() {
  return (
    <div data-embed-surface>
      <EmbedWidget allowedParents={ALLOWED_PARENTS} />
    </div>
  );
}
