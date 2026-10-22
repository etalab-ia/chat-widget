import type { Metadata } from "next";
import { EmbedWidget } from "@/components/widget/embed-widget";

export const metadata: Metadata = {
  title: "Assistant ANSSI",
  robots: { index: false, follow: false },
};

/**
 * Standalone surface intended to be embedded in an iframe. It carries only the
 * widget: no site chrome, transparent background.
 */
export default function EmbedPage() {
  return (
    <div data-embed-surface>
      <EmbedWidget />
    </div>
  );
}
