import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { fr } from "@codegouvfr/react-dsfr";
import { EmbedFrame } from "@/components/widget/embed-frame";

const EMBED_SNIPPET = `<iframe
  src="https://<votre-hote>/embed"
  title="Assistant ANSSI"
  style="position:fixed;right:16px;bottom:16px;width:88px;height:88px;border:0;z-index:50"
></iframe>`;

const RESIZE_SNIPPET = `<script>
  // L'iframe ne peut pas se dimensionner sur son contenu : le widget annonce
  // son état et la page hôte ajuste le cadre.
  window.addEventListener("message", (event) => {
    const frame = document.querySelector("iframe[title='Assistant ANSSI']");
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== "anssi-widget" || data.type !== "resize") return;
    frame.style.width = data.open ? "420px" : "88px";
    frame.style.height = data.open ? "620px" : "88px";
  });
</script>`;

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
            <h1>Un assistant pour retrouver la bonne recommandation</h1>

            <p className={fr.cx("fr-text--lead")}>
              Les guides de l&apos;ANSSI sont nombreux et longs. L&apos;assistant
              répond à une question en langage courant et indique, pour chaque
              point, le guide et la page d&apos;où vient la réponse.
            </p>

            <p>
              Le corpus est composé de documents publics : les guides techniques
              de l&apos;ANSSI, en français et en anglais. Aucun document interne
              n&apos;est indexé et aucune donnée personnelle n&apos;est demandée.
            </p>

            <h2 className={fr.cx("fr-mt-6w")}>Comment l&apos;utiliser</h2>
            <p>
              Le bouton en bas à droite ouvre l&apos;assistant. Posez votre
              question ; la réponse s&apos;affiche avec la liste des sources
              utilisées. Un clic sur une source ouvre le PDF à la page citée.
            </p>

            <h2 className={fr.cx("fr-mt-6w")}>L&apos;intégrer à votre page</h2>
            <p>
              Le widget se charge depuis{" "}
              <code className="rounded bg-[var(--background-alt-grey)] px-1 py-0.5 text-[0.875em]">
                /embed
              </code>{" "}
              dans une iframe. La clé d&apos;API reste sur le serveur : elle
              n&apos;est jamais exposée au navigateur.
            </p>

            {/* DSFR ne fournit aucun style pour le code : ces deux blocs
                reprennent la palette du DSFR sans inventer de classe fr-*. */}
            <pre className="mt-6 overflow-x-auto rounded border border-[var(--border-default-grey)] bg-[var(--background-alt-grey)] p-4 font-mono text-[0.8125rem] leading-relaxed text-[var(--text-default-grey)]">
              <code className="whitespace-pre-wrap break-words">{EMBED_SNIPPET}</code>
            </pre>

            <p className={fr.cx("fr-mt-4w")}>
              L&apos;iframe ne peut pas se dimensionner sur son contenu. Le widget
              annonce donc son état d&apos;ouverture, et la page hôte ajuste le
              cadre :
            </p>

            <pre className="mt-6 overflow-x-auto rounded border border-[var(--border-default-grey)] bg-[var(--background-alt-grey)] p-4 font-mono text-[0.8125rem] leading-relaxed text-[var(--text-default-grey)]">
              <code className="whitespace-pre-wrap break-words">{RESIZE_SNIPPET}</code>
            </pre>

            <CallOut
              className={fr.cx("fr-mt-6w")}
              title="Démonstration"
              iconId="ri-information-line"
            >
              Ceci est un démonstrateur. Les réponses peuvent être incomplètes :
              les citations permettent de revenir au texte source. Une limite de
              500 questions par jour protège le service.
            </CallOut>
          </div>
        </div>
      </main>

      <Footer
        accessibility="non compliant"
        contentDescription="Démonstrateur technique d'un assistant documentaire sur les guides publics de l'ANSSI, à des fins d'évaluation."
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

      {/* Le déclencheur du widget est fixé au viewport : cette bande, placée
          dans le flux avant le pied de page, lui réserve la hauteur nécessaire
          pour qu'il ne recouvre pas le bloc marque une fois en bas de page. */}
      {/* 7rem couvre les 16px de marge du déclencheur plus ses 88px, avec une
          petite réserve ; mesuré aux deux largeurs de référence. */}
      <div aria-hidden="true" className="h-28" />

      <EmbedFrame />
    </>
  );
}
