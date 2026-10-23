import { EmbedFrame } from "@/components/widget/embed-frame";

const NAV = [
  { href: "#assistant", label: "Assistant" },
  { href: "#actualites", label: "Actualités" },
  { href: "#questions", label: "Questions types" },
  { href: "#integration", label: "Intégration" },
];

const CORPUS = [
  { value: "185", label: "guides publics français" },
  { value: "60", label: "guides en anglais" },
  { value: "16 850", label: "extraits indexés" },
  { value: "Page", label: "citée pour chaque extrait" },
];

const ARTICLES = [
  {
    tag: "Publication",
    title: "Nouvelle version du guide d'hygiène informatique",
    excerpt:
      "Le guide d'hygiène informatique rassemble les mesures de base à mettre en oeuvre pour renforcer la sécurité d'un système d'information.",
    read: "12 min",
  },
  {
    tag: "Menace",
    title: "Campagne de sensibilisation au rançongiciel",
    excerpt:
      "Les rançongiciels restent la première menace observée. Les réflexes à adopter et les mesures de prévention recommandées.",
    read: "6 min",
  },
  {
    tag: "Guide",
    title: "Recommandations pour les architectures Zero Trust",
    excerpt:
      "Recommandations d'architecture pour les systèmes d'information sensibles, articulées autour des principes Zero Trust.",
    read: "9 min",
  },
  {
    tag: "Vulnérabilité",
    title: "Bulletin d'actualité sur les vulnérabilités critiques",
    excerpt:
      "Suivi des vulnérabilités exploitées activement, avec les mesures de contournement et les échéances de mise à jour.",
    read: "4 min",
  },
];

const QUESTIONS = [
  "Comment segmenter un réseau en zones ?",
  "Quelles règles pour les mots de passe et l'authentification multifacteur ?",
  "Comment préparer et gérer une crise cyber ?",
  "Quelles mesures d'hygiène pour un poste de travail ?",
  "Comment sécuriser les accès nomades et le télétravail ?",
  "Quels principes d'architecture Zero Trust appliquer ?",
];

const STEPS = [
  {
    title: "Recherche dans le corpus",
    body: "La question part vers l'API Albert, qui retrouve les extraits les plus proches dans les guides publics indexés. Aucun document interne n'est interrogé.",
  },
  {
    title: "Réponse rédigée",
    body: "Les extraits retrouvés sont transmis à un modèle de langage, qui rédige la réponse dans la langue de la question.",
  },
  {
    title: "Citations vérifiables",
    body: "Chaque point renvoie à un guide et à une page. Le lien ouvre le PDF au bon endroit, pour vérifier la source d'un clic.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[15px] font-semibold tracking-tight text-[#000091]">
              Intranet
            </span>
            <span className="hidden text-[13px] text-slate-500 sm:inline">
              Sécurité numérique
            </span>
          </div>

          <nav aria-label="Sections de la page" className="hidden md:block">
            <ul className="flex items-center gap-5">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-[12.5px] font-medium text-slate-600 transition-colors hover:text-[#000091] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#000091]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <span className="shrink-0 rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
            Démonstration
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-16">
        <section id="assistant" className="scroll-mt-20 pt-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#000091]">
            Assistant documentaire
          </p>
          <h1 className="mt-2 max-w-2xl text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
            Interroger les guides de l&apos;ANSSI en langage courant
          </h1>
          <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600">
            Le corpus public des guides de l&apos;ANSSI est indexé et interrogeable
            depuis cette page. L&apos;assistant répond et cite le guide et la page
            d&apos;où vient chaque extrait, pour que la réponse reste vérifiable.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
            {CORPUS.map((item) => (
              <div key={item.label} className="bg-white px-4 py-3">
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span className="block text-[17px] font-semibold leading-tight tabular-nums text-slate-900">
                    {item.value}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">
                    {item.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="actualites" className="scroll-mt-20 pt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              Actualités sécurité
            </h2>
            <span className="text-[11.5px] text-slate-500">
              Semaine du 19 octobre
            </span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ARTICLES.map((article) => (
              <article
                key={article.title}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#000091]">
                    {article.tag}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {article.read}
                  </span>
                </div>
                <h3 className="mt-1.5 text-[14px] font-semibold leading-snug text-slate-900">
                  {article.title}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                  {article.excerpt}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="questions" className="scroll-mt-20 pt-10">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
            Questions types
          </h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-600">
            Quelques formulations que le corpus couvre bien, pour démarrer.
          </p>

          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {QUESTIONS.map((question, index) => (
              <li key={question} className="flex items-baseline gap-3 px-4 py-2.5">
                <span
                  aria-hidden="true"
                  className="w-4 shrink-0 text-right text-[11px] font-medium tabular-nums text-slate-400"
                >
                  {index + 1}
                </span>
                <span className="text-[12.5px] leading-relaxed text-slate-700">
                  {question}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section id="fonctionnement" className="scroll-mt-20 pt-10">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
            Comment la réponse est construite
          </h2>

          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="border-t-2 border-[#000091] pt-2.5">
                <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1 text-[12.5px] font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section id="integration" className="scroll-mt-20 pt-10">
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
            Intégration dans la page hôte
          </h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-slate-600">
            Le widget est chargé depuis{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11.5px]">
              /embed
            </code>
            , en iframe. Un composant web pourrait remplacer l&apos;iframe sans
            changer la configuration, le protocole de flux ni le contrat de
            redimensionnement.
          </p>
          <pre className="mt-2.5 overflow-x-auto rounded-lg bg-slate-900 p-3.5 text-[11.5px] leading-relaxed whitespace-pre-wrap break-words text-slate-100">
            <code>{`<iframe
  src="https://<hote>/embed"
  title="Assistant ANSSI"
  style="position:fixed;right:0;bottom:0;width:420px;height:640px;border:0;z-index:50"
/>`}</code>
          </pre>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        {/* Bottom padding reserves room for the floating trigger, which is
            fixed to the viewport and would otherwise sit on top of the
            footer once the page is scrolled to the end. */}
        <div className="mx-auto flex max-w-4xl flex-col gap-2 px-6 pt-6 pb-24 text-[11.5px] leading-relaxed text-slate-500 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="max-w-xl">
            Démonstration technique. Le corpus interrogé est composé de
            documents publics ; aucune donnée personnelle n&apos;est demandée.
            Les réponses peuvent être incomplètes : les citations permettent de
            revenir au texte source.
          </p>
          <p className="shrink-0 text-slate-400">Albert · gpt-oss-120b</p>
        </div>
      </footer>

      <EmbedFrame />
    </div>
  );
}
