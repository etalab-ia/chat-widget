import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { fr } from "@codegouvfr/react-dsfr";
import { EmbedFrame } from "@/components/widget/embed-frame";
import { COLLAPSED_SIZE, EXPANDED_SIZE } from "@/lib/embed-bridge";

const EMBED_SNIPPET = `<iframe
  src="https://<votre-hote>/embed"
  title="Assistant ANSSI"
  style="position:fixed;right:16px;bottom:16px;width:${COLLAPSED_SIZE.width}px;height:${COLLAPSED_SIZE.height}px;border:0;z-index:50"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  allow="camera 'none'; microphone 'none'; geolocation 'none'"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>

<script>
  const WIDGET_ORIGIN = "https://<votre-hote>";

  // Une iframe ne peut pas se redimensionner elle-même : le widget annonce
  // s'il est ouvert ou fermé, et cette page ajuste le cadre.
  window.addEventListener("message", (event) => {
    if (event.origin !== WIDGET_ORIGIN) return;
    const frame = document.querySelector("iframe[title='Assistant ANSSI']");
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== "anssi-widget" || data.type !== "resize") return;
    frame.style.width = data.open ? "${EXPANDED_SIZE.width}px" : "${COLLAPSED_SIZE.width}px";
    frame.style.height = data.open ? "${EXPANDED_SIZE.height}px" : "${COLLAPSED_SIZE.height}px";
  });
<\/script>`;

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
              Le cadre affiche le bouton ; le script qui suit l&apos;agrandit
              quand la fenêtre s&apos;ouvre, car une iframe ne peut pas changer
              sa taille toute seule.
            </p>

            {/* The box is the <pre> and the <code> stays a plain block inside
                it. Padding on an inline <code> does not grow the <pre>, so
                styling the inner element left the text spilling over its own
                background. */}
            <pre className="mt-3w overflow-x-auto rounded border border-[var(--border-default-grey)] bg-[var(--background-alt-grey)] p-4 font-mono text-[0.8125rem] leading-relaxed text-[var(--text-default-grey)]">
              <code className="block whitespace-pre-wrap break-words">
                {EMBED_SNIPPET}
              </code>
            </pre>

            <p className={fr.cx("fr-mt-3w")}>
              Remplacez <code>&lt;votre-hote&gt;</code> par l&apos;adresse du
              service. La clé de l&apos;API Albert reste sur le serveur : elle
              n&apos;apparaît jamais dans la page.
            </p>

            <h3 className={fr.cx("fr-mt-4w", "fr-h6")}>
              Ce que le bloc empêche
            </h3>
            <p>
              Une page qui accueille une iframe lui donne des droits. Ceux qui
              sont inutiles ici sont refusés dès le cadre, et non laissés au
              choix du navigateur.
            </p>
            <ul>
              <li>
                <code>sandbox</code> : le cadre exécute le widget et ouvre les
                PDF cités. Il ne peut pas naviguer à la place de la page
                hôte, ni lui substituer une autre adresse. C&apos;est ce qui
                empêche un cadre piégé de vous rediriger vers un faux site.
              </li>
              <li>
                <code>allow</code> : la caméra, le microphone et la position
                sont refusés. L&apos;assistant n&apos;en a pas besoin, et une
                même origine lui donnerait sinon les droits de votre page.
              </li>
              <li>
                <code>referrerpolicy</code> : votre page ne transmet que son
                adresse d&apos;origine à un autre domaine, jamais le chemin ni
                les paramètres d&apos;adresse.
              </li>
              <li>
                Le script vérifie l&apos;origine et la forme du message avant
                d&apos;agir, et n&apos;accepte un message que du cadre
                lui-même. Remplacez <code>&lt;votre-hote&gt;</code> aux deux
                endroits.
              </li>
            </ul>
            <p>
              Deux réglages s&apos;ajoutent sur les serveurs, car ce sont eux
              qui décident qui peut afficher quoi. Le service n&apos;accepte
              d&apos;être affiché que par les sites listés dans{" "}
              <code>frame-ancestors</code>, et votre page doit autoriser
              l&apos;adresse du widget dans sa propre règle{" "}
              <code>frame-src</code>. Sans le second, le navigateur bloque le
              cadre même si le premier l&apos;autorise.
            </p>
            <p>
              Ces réglages séparent d&apos;autant mieux que le widget est servi
              par un autre domaine que la page qui l&apos;affiche : le
              navigateur interdit alors au cadre de lire les cookies et le
              stockage de cette page. Sur ce démonstrateur, les deux partagent
              la même origine et le navigateur les traite comme un seul site.
            </p>

            <CallOut
              className={fr.cx("fr-mt-6w")}
              title="Ce démonstrateur a des limites"
              iconId="ri-information-line"
            >
              L&apos;assistant ne cherche que dans les documents publics de
              l&apos;ANSSI. Une réponse peut être incomplète : les liens vers les
              pages citées servent à le vérifier. Le service accepte 500
              questions par jour au total, et 10 questions par minute et par
              adresse&nbsp;IP.
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
