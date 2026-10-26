import { fr } from "@codegouvfr/react-dsfr";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { Header } from "@codegouvfr/react-dsfr/Header";
import { IntegrationDemo } from "@/components/widget/integration-demo";

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

						<h2 className={fr.cx("fr-mt-6w")}>
							Ajouter l&apos;assistant à une page
						</h2>
						<p>
							Deux modes d&apos;intégration sont proposés : une iframe pilotée
							par un script, ou un web component rendu directement dans la page.
							L&apos;extrait à copier, l&apos;explication et l&apos;assistant en
							bas à droite s&apos;adaptent au mode choisi.
						</p>

						<IntegrationDemo />

						<CallOut
							className={fr.cx("fr-mt-6w")}
							title="Ce démonstrateur a des limites"
							iconId="ri-information-line"
						>
							L&apos;assistant ne cherche que dans les documents publics de
							l&apos;ANSSI. Une réponse peut être incomplète : les liens vers
							les pages citées servent à le vérifier. Le service accepte 500
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
		</>
	);
}
