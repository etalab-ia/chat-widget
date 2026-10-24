# Chat widget ANSSI

Widget de chat RAG pour interroger le corpus public des guides de l'ANSSI depuis une page intranet, via l'API Albert. POC.

Le widget est chargé dans une iframe. L'architecture reste compatible avec un empaquetage ultérieur en web component : la configuration, le protocole de streaming et le contrat de redimensionnement sont indépendants du rendu.

## Fonctionnement

```
Page intranet hôte
  -> iframe /embed
     -> assistant-ui (modale flottante, fil de conversation uniquement)
     -> POST /api/chat                    (clé Albert côté serveur)
        -> Albert POST /v1/search         (méthode hybride)
        -> construction du contexte et des citations
        -> Albert POST /v1/chat/completions (flux SSE, gpt-oss-120b)
     <- flux NDJSON : sources, puis deltas de la réponse
```

Le navigateur ne reçoit jamais la clé Albert : seule la route serveur `/api/chat` la lit.

## Citations et numéros de page

Le découpage automatique de l'API Albert ne conserve pas les numéros de page. L'ingestion découpe donc chaque PDF page par page et attache à chaque chunk :

- `page`, le numéro de page ;
- `citation_url`, l'URL du PDF suivie de `#page=N`, qui ouvre le document à la bonne page dans un lecteur PDF ;
- `guide_id`, `guide_title`, `source_url`, `collection`, `extraction`.

Ces métadonnées sont conservées à l'indexation et restituées par `/v1/search`, ce qui permet au widget d'afficher une liste de sources cliquables sous chaque réponse.

Les PDF dont la couche texte est inexploitable passent par l'OCR Albert (`mistral-ocr-2512`), qui renvoie du markdown page par page.

## Développement

Prérequis : Node 22, pnpm 11, et `poppler-utils` (`pdftotext`, `pdfinfo`) pour l'ingestion.

```bash
pnpm install
pre-commit install
cp .env.example .env.local   # renseigner ALBERT_API_KEY
pnpm dev
```

La page `/` simule une page intranet et charge le widget depuis `/embed`. La page `/embed` ne contient que le widget.

| Commande | Effet |
| --- | --- |
| `pnpm dev` | serveur de développement |
| `pnpm build` | build de production |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript |
| `pnpm test` | tests Vitest |
| `pnpm ingest` | indexation du corpus ANSSI |
| `pnpm verify:corpus` | vérifie citations et numéros de page |

## Indexation du corpus

Le catalogue est lu depuis `https://messervices.cyber.gouv.fr/api/guides` : 185 PDF en français, 60 en anglais. Deux collections publiques sont alimentées, `anssi-guides-fr` et `anssi-guides-en`.

```bash
# Vérification à blanc sur deux documents
pnpm ingest -- --language FR --limit 2 --dry-run

# Corpus complet, les deux langues
pnpm ingest -- --all --concurrency 3

# Vérifie que chaque collection renvoie des chunks avec page et URL de citation
pnpm verify:corpus
```

Le script est rejouable : il réutilise les collections existantes et n'efface aucun document. Repartir de zéro suppose de supprimer les collections côté Albert.

Les identifiants des collections créées doivent être reportés dans `ALBERT_COLLECTION_FR` et `ALBERT_COLLECTION_EN`.

## Déploiement

L'application est un Next.js standard (App Router). Elle exige :

- `ALBERT_API_KEY` côté serveur ;
- `ALBERT_COLLECTION_FR` et `ALBERT_COLLECTION_EN` ;
- éventuellement `ALBERT_CHAT_MODEL` (par défaut `gpt-oss-120b`) ;
- éventuellement `EMBED_ALLOWED_PARENTS`, la liste des origines autorisées à afficher `/embed` dans une iframe (voir « Intégration dans une page hôte »). Vide, seule la page `/` du service peut l'afficher.

La variable `ALBERT_BASE_URL` permet de cibler une autre instance de l'API.

Le seul état est celui du fil de conversation, conservé en mémoire du navigateur : aucun stockage serveur, aucune session utilisateur.

## Intégration dans une page hôte

```html
<iframe
  src="https://<hote>/embed"
  title="Assistant ANSSI"
  style="position:fixed;right:16px;bottom:16px;width:88px;height:88px;border:0;z-index:50"
  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
  allow="camera 'none'; microphone 'none'; geolocation 'none'"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>

<script>
  const WIDGET_ORIGIN = "https://<hote>";

  // L'iframe ne peut pas se dimensionner sur son contenu : le widget annonce
  // son état et la page hôte ajuste le cadre.
  window.addEventListener("message", (event) => {
    if (event.origin !== WIDGET_ORIGIN) return;
    const frame = document.querySelector("iframe[title='Assistant ANSSI']");
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.source !== "anssi-widget" || data.type !== "resize") return;
    frame.style.width = data.open ? "420px" : "88px";
    frame.style.height = data.open ? "620px" : "88px";
  });
</script>
```

Deux réglages côté serveurs complètent le bloc :

- le service n'accepte d'être affiché que par `'self'` et par les origines listées dans `EMBED_ALLOWED_PARENTS` (en-tête `Content-Security-Policy: frame-ancestors` sur `/embed`) ; une page non listée reçoit un cadre vide. La liste est lue au chargement de la configuration, donc un redéploiement est nécessaire pour la modifier ;
- la page hôte doit autoriser l'adresse du widget dans sa propre règle `frame-src`.

Le redimensionnement évite `postMessage(..., "*")` : le widget adresse son message à l'origine du parent, qu'il lit dans `document.referrer`. C'est la raison du `referrerpolicy="strict-origin-when-cross-origin"` : pour une page hôte sur un autre domaine, le navigateur ne transmet que l'origine, jamais le chemin ni les paramètres ; pour une page de même origine, le widget n'a rien de plus à savoir. Si la page hôte impose `referrerpolicy="no-referrer"`, le référent est vide et le message retombe sur `"*"` — il ne contient alors que l'état ouvert/fermé.

La liste des parents est volontairement limitée à des origines nues : une entrée avec un chemin ou une requête ne restreindrait pas `frame-ancestors` comme elle en a l'air, et un joker (`https://*.exemple.gouv.fr`) serait accepté par l'en-tête mais jamais reconnu par le widget, qui compare des origines entières. Ces entrées sont écartées au chargement ; il faut lister chaque page hôte.

## Sécurité

- La clé Albert reste côté serveur ; elle n'est jamais incluse dans un bundle client.
- L'iframe est confinée par `sandbox` : scripts et origine (nécessaires pour appeler `/api/chat`), ouverture des PDF cités dans un nouvel onglet. Ni navigation de la fenêtre hôte, ni formulaires, ni fenêtres modales, ni téléchargements. Sur une page hôte d'un autre domaine, un widget compromis ne peut donc pas rediriger l'utilisateur ni recouvrir l'interface. Sur la page de démonstration, l'iframe est de même origine : un bac à sable ne sépare pas deux documents de même origine, c'est le domaine distinct qui apporte cette séparation.
- Les API de l'appareil sont refusées deux fois : par l'attribut `allow` de l'iframe et par l'en-tête `Permissions-Policy` du service (caméra, micro, position, capture d'écran, lecture du presse-papiers, paiement, USB…). Une iframe de même origine hériterait sinon des droits de la page hôte.
- `/embed` porte `frame-ancestors` (qui peut l'afficher) et `/` porte `frame-ancestors 'none'` plus `frame-src 'self'` (la page de démonstration ne se laisse pas encadrer et n'encadre que son propre widget). Les autres en-têtes : `X-Content-Type-Options: nosniff` et `Referrer-Policy: strict-origin-when-cross-origin`.
- Les messages de redimensionnement sont filtrés des deux côtés : la page hôte vérifie `event.source` **et** `event.origin` ainsi que la forme du message, et le widget adresse son message à une origine précise plutôt qu'à `"*"`.
- Une politique de sécurité du contenu complète (scripts, styles) reste à écrire : le bootstrap DSFR utilise un script en ligne, qui demande soit un nonce par requête, soit un rendu dynamique. Les règles ci-dessus ne couvrent que l'encadrement.
- La route `/api/chat` valide la requête (longueur de question, historique borné) avant tout appel amont.
- Deux plafonds protègent la route : 10 questions par minute et par client, et 500 questions par jour pour l'ensemble du service. Les deux refusent avec un code 429 avant tout appel amont, donc une salve coûte une réponse JSON et non une recherche plus une complétion. Les plafonds se règlent par `ABUSE_MAX_PER_CLIENT` et `ABUSE_MAX_PER_DAY`.
- Le plafond par client s'appuie sur `X-Real-IP` puis sur la première adresse `X-Forwarded-For`. Ces en-têtes sont contrôlés par le client lorsque le service est joignable directement : c'est une mesure d'équité, pas une authentification. Le plafond quotidien, lui, borne réellement le coût total.
- Les documents ouverts par les citations le sont avec `rel="noopener noreferrer"`.
- pnpm impose un délai minimum d'une semaine avant d'accepter une nouvelle version de paquet (`minimumReleaseAge: 10080`). Les deux exceptions exactes pour des correctifs de sécurité sont documentées dans `pnpm-workspace.yaml` ; les autres paquets restent soumis à ce délai.
- `gitleaks` et `cve-lite` sont configurés en pre-commit (`.pre-commit-config.yaml`), à activer par `pre-commit install`. Le second analyse le lockfile Node et bloque les vulnérabilités de sévérité élevée ou critique avec `cve-lite . --fail-on high`.
- OSV-Scanner compare les dépendances de chaque pull request à sa branche cible et échoue si elle introduit une nouvelle vulnérabilité. Un scan hebdomadaire et un scan à chaque push sur `main` alimentent aussi Code Scanning, sans bloquer sur les vulnérabilités déjà présentes.
- Dependabot est actif (`.github/dependabot.yml`), avec un délai de 7 jours avant de proposer une version publiée.

Les workflows sont versionnés dans `.github/workflows/`. Le hook `gitleaks` reste local : il ne protège que les postes où `pre-commit install` a été lancé.

## Limites du POC

- Pas d'authentification sur `/api/chat` : toute personne qui connaît l'URL peut poser des questions, dans la limite des plafonds ci-dessus.
- Les compteurs des plafonds vivent en mémoire du processus. Ils sont donc propres à chaque instance : si le service est un jour déployé sur plusieurs instances, il faudra un stockage partagé, sinon la limite effective est multipliée par le nombre d'instances.
- L'historique de conversation reste dans le navigateur ; un rechargement le perd.
- L'ingestion n'est pas incrémentale : rejouer le script ajoute des documents, il ne met pas à jour ceux déjà indexés.
- Les PDF scannés dépendent de la qualité de l'OCR.

## Déploiement (Scaleway Serverless Containers)

Le conteneur tourne sur Scaleway, en `fr-par`, avec `min_scale: 0` et `max_scale: 1`. Il écoute sur le port 8080.

Deux points ont coûté du temps et méritent d'être connus avant de redéployer :

- **`HOSTNAME=0.0.0.0` est obligatoire.** Le serveur standalone de Next lit `process.env.HOSTNAME` et l'utilise comme adresse d'écoute. Un conteneur renseigne `HOSTNAME` avec son propre identifiant, que le DNS de Scaleway ne résout pas : le conteneur démarre, écrit `Ready`, et n'écoute sur rien. Scaleway signale alors `Container is unable to start OR is not listening on port 8080`. Le nom d'hôte se résout quand on teste en local avec Podman, ce qui rend le diagnostic trompeur.
- **`PORT` est un nom réservé** et Scaleway refuse de le définir. Le port se règle par le champ `port` de la ressource, pas par l'environnement.

Le champ d'image de l'API s'appelle `image` (et non `registry_image`), et les limites s'expriment en `memory_limit_bytes` et `mvcpu_limit`. Le `timeout` est une durée au format protobuf, donc une chaîne comme `"300s"`.

La nomenclature du registre est `rg.<region>.scw.cloud/<espace>/<image>:<tag>`. Le pipeline utilise cette référence complète pour pousser l'image et pour renseigner le champ `image` du conteneur.

Le secret `ALBERT_API_KEY` est stocké comme variable d'environnement secrète : l'API le renvoie haché en argon2id, ce qui est le comportement attendu et non une corruption de la valeur.

## CI/CD

Le workflow `ci-cd.yml` exécute ESLint, TypeScript, les tests Vitest et le build Next.js sur chaque pull request et chaque push sur `main`. Sur `main`, le job `deploy` démarre seulement après la réussite de ces vérifications. Il construit et publie une image taguée `sha-<SHA complet du commit>`, met à jour le conteneur, attend que cette image précise soit à l'état `ready`, puis vérifie les réponses HTTP de `/` et `/embed`. Un dépassement de délai ou un échec de ces vérifications fait échouer le workflow.

Le déploiement requiert quatre secrets GitHub Actions, avec les noms idiomatiques Scaleway :

- `SCW_ACCESS_KEY` ;
- `SCW_SECRET_KEY` ;
- `SCW_ORGANIZATION_ID` ;
- `SCW_PROJECT_ID`.

Le job vérifie avant le déploiement que l'organisation, le projet et le conteneur configurés correspondent bien entre eux, en lisant l'espace de noms du conteneur. La région, l'identifiant du conteneur et la référence du registre sont des paramètres non secrets du workflow. `ALBERT_API_KEY` reste configuré uniquement dans Scaleway : la CI n'a pas besoin de cette clé pour vérifier ou construire l'application.

---

✨ Contenu partiellement généré par une IA et vérifié par un agent.
