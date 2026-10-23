import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { fr } from "@codegouvfr/react-dsfr";
import { EmbedFrame } from "@/components/widget/embed-frame";
import { COLLAPSED_SIZE } from "@/lib/embed-bridge";

const EMBED_SNIPPET = `<iframe
  src="https://<votre-hote>/embed"
  title="Assistant ANSSI"
  style="position:fixed;right:16px;bottom:16px;width:${COLLAPSED_SIZE.width}px;height:${COLLAPSED_SIZE.height}px;border:0;z-index:50"
></iframe>`;

export default function Home() {
  return (
    <>
      <Header
        brandTop={
          <>
            RÉPUBLIQUE
            <br />
            FRANÇAISE
          </>
        }
        homeLinkProps={{
          href: "/",
          title: "Accueil — Assistant ANSSI",
        }}
        serviceTitle="Assistant ANSSI"
        serviceTagline="Interroger les guides publics de l'ANSSI"
      />

      <main className={fr.cx("fr-container", "fr-py-8w")}>
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          <div className={fr.cx("fr-col-12", "fr-col-lg-8")}>
            <h1>Poser une question sur les guides de l&apos;ANSSI</h1>

            <p className={fr.cx("fr-text--lead")}>
              L&apos;assistant répond en citant le guide et la page. Vous pouvez
              donc vérifier chaque point dans le document d&apos;origine.
            </p>

            <h2 className={fr.cx("fr-mt-6w")}>Utiliser l&apos;assistant</h2>
            <ol>
              <li>Cliquez sur le bouton bleu en bas à droite.</li>
              <li>Écrivez votre question, puis appuyez sur Entrée.</li>
              <li>
                Dans la réponse, cliquez sur un numéro en bleu pour ouvrir le
                document à la page citée.
              </li>
            </ol>

            <h2 className={fr.cx("fr-mt-6w")}>Ajouter l&apos;assistant à une page</h2>
            <p>
              Copiez ce bloc dans la page où l&apos;assistant doit apparaître.
              C&apos;est la seule chose à faire. Le bouton, la fenêtre et son
              agrandissement sont déjà gérés par le widget.
            </p>

            <pre className={fr.cx("fr-mt-3w")}>
              <code className="rounded border border-[var(--border-default-grey)] bg-[var(--background-alt-grey)] p-4 text-[0.8125rem] leading-relaxed text-[var(--text-default-grey)] whitespace-pre-wrap break-words">
                {EMBED_SNIPPET}
              </code>
            </pre>

            <p className={fr.cx("fr-mt-3w")}>
              Remplacez <code>&lt;votre-hote&gt;</code> par l&apos;adresse du
              service. La clé de l&apos;API Albert reste sur le serveur : elle
              n&apos;apparaît jamais dans la page.
            </p>

            <CallOut
              className={fr.cx("fr-mt-6w")}
              title="Ce démonstrateur a des limites"
              iconId="ri-information-line"
            >
              L&apos;assistant ne cherche que dans les documents publics de
              l&apos;ANSSI. Une réponse peut être incomplète : les liens vers les
              pages citées servent à le vérifier. Le service accepte 500
              questions par jour, et 10 questions par minute et par visiteur.
            </CallOut>
          </div>
        </div>
      </main>

      <Footer
        accessibility="non compliant"
        contentDescription="Démonstrateur d'un assistant documentaire sur les guides publics de l'ANSSI, à des fins d'évaluation."
        brandTop={
          <>
            RÉPUBLIQUE
            <br />
            FRANÇAISE
          </>
        }
        homeLinkProps={{
          href: "/",
          title: "Accueil — Assistant ANSSI",
        }}
      />

      {/* Le bouton de l'assistant est fixé en bas à droite de la fenêtre. Cette
          bande vient après le pied de page, qui termine la page : sans elle, la
          dernière ligne du pied de page arrive pile sous le bouton quand on
          défile jusqu'en bas. */}
      <div aria-hidden="true" className="h-28" />

      <EmbedFrame />
    </>
  );
}
