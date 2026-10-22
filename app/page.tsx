import { EmbedFrame } from "@/components/widget/embed-frame";

const ARTICLES = [
  {
    title: "Nouvelle version du guide d'hygiène informatique",
    excerpt:
      "Le guide d'hygiène informatique rassemble les mesures de base à mettre en oeuvre pour renforcer la sécurité d'un système d'information.",
    tag: "Publication",
  },
  {
    title: "Campagne de sensibilisation au rançongiciel",
    excerpt:
      "Les rançongiciels restent la première menace observée. Les réflexes à adopter et les mesures de prévention recommandées.",
    tag: "Menace",
  },
  {
    title: "Recommandations pour les architectures Zero Trust",
    excerpt:
      "Recommandations d'architecture pour les systèmes d'information sensibles, articulées autour des principes Zero Trust.",
    tag: "Guide",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[15px] font-semibold tracking-tight text-[#000091]">
              Intranet
            </span>
            <span className="text-[13px] text-slate-500">
              Sécurité numérique
            </span>
          </div>
          <span className="rounded-sm bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
            Démonstration
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Actualités sécurité
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600">
          Cette page simule une page intranet hôte. Le widget de l&apos;assistant
          documentaire est chargé dans une iframe et interroge le corpus public
          des guides de l&apos;ANSSI.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ARTICLES.map((article) => (
            <article
              key={article.title}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-[#000091]">
                {article.tag}
              </span>
              <h2 className="mt-1.5 text-[14px] font-semibold leading-snug text-slate-900">
                {article.title}
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                {article.excerpt}
              </p>
            </article>
          ))}
        </div>

        <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-[13px] font-semibold text-slate-900">
            Intégration dans la page hôte
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
            Le widget est chargé depuis{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11.5px]">
              /embed
            </code>
            . L&apos;intégration cible aujourd&apos;hui une iframe ;
            l&apos;architecture reste compatible avec un empaquetage ultérieur en
            web component.
          </p>
          <pre className="mt-2.5 overflow-x-auto rounded-md bg-slate-900 p-3 text-[11.5px] leading-relaxed text-slate-100">
            <code>{`<iframe
  src="https://<hote>/embed"
  title="Assistant ANSSI"
  style="position:fixed;right:0;bottom:0;width:420px;height:640px;border:0;z-index:50"
/>`}</code>
          </pre>
        </section>
      </main>

      <EmbedFrame />
    </div>
  );
}
