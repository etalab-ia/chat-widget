import type { Metadata } from "next";
import { createGetHtmlAttributes } from "@codegouvfr/react-dsfr/next-app-router/getHtmlAttributes";
import { getScriptToRunAsap } from "@codegouvfr/react-dsfr/useIsDark/scriptToRunAsap";
import "@codegouvfr/react-dsfr/dsfr/dsfr.min.css";
import "@codegouvfr/react-dsfr/dsfr/utility/icons/icons.main.min.css";
import "./globals.css";
import { DsfrProvider, StartDsfrOnHydration } from "./dsfr-bootstrap";
import { defaultColorScheme } from "./dsfr-bootstrap/defaultColorScheme";

export const metadata: Metadata = {
  title: "Assistant ANSSI",
  description:
    "Widget de chat RAG pour interroger le corpus public des guides de l'ANSSI via l'API Albert.",
  robots: { index: false, follow: false },
};

const { getHtmlAttributes } = createGetHtmlAttributes({ defaultColorScheme });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html {...getHtmlAttributes({ lang: "fr" })} className="h-full antialiased">
      <head>
        {/* Resolves the light/dark scheme before the first CSS paint, which is
            what prevents the white flash DSFR is known for in App Router. */}
        <script
          dangerouslySetInnerHTML={{
            __html: getScriptToRunAsap({
              defaultColorScheme,
              nonce: undefined,
              trustedTypesPolicyName: "react-dsfr",
            }),
          }}
        />
      </head>
      <body className="h-full bg-transparent font-sans">
        <DsfrProvider lang="fr">
          {children}
          <StartDsfrOnHydration />
        </DsfrProvider>
      </body>
    </html>
  );
}
