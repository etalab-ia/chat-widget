import type { Metadata } from "next";
import { EmbedWidget } from "@/components/widget/embed-widget";
import { parseAllowedParents } from "@/lib/embed-bridge";

export const metadata: Metadata = {
	title: "Assistant ANSSI",
	description:
		"Widget de chat RAG pour interroger le corpus public des guides de l'ANSSI via l'API Albert.",
	robots: { index: false, follow: false },
};

/**
 * Read once per process so the widget's resize messages are addressed at a
 * stable origin, and to the same list that `frame-ancestors` is built from in
 * `next.config.ts`.
 */
const ALLOWED_PARENTS = parseAllowedParents(process.env.EMBED_ALLOWED_PARENTS);

/**
 * Surface embedded in a host page's iframe. It carries only the widget: no site
 * chrome, no design system, transparent background.
 */
export default function EmbedPage() {
	return <EmbedWidget allowedParents={ALLOWED_PARENTS} />;
}
