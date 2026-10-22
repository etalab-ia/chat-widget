import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assistant ANSSI",
  description:
    "Widget de chat RAG pour interroger le corpus public des guides de l'ANSSI via l'API Albert.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="h-full bg-transparent font-sans">{children}</body>
    </html>
  );
}
