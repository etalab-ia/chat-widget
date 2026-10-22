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
- éventuellement `ALBERT_CHAT_MODEL` (par défaut `gpt-oss-120b`).

La variable `ALBERT_BASE_URL` permet de cibler une autre instance de l'API.

Le seul état est celui du fil de conversation, conservé en mémoire du navigateur : aucun stockage serveur, aucune session utilisateur.

## Intégration dans une page hôte

```html
<iframe
  src="https://<hote>/embed"
  title="Assistant ANSSI"
  style="position:fixed;right:16px;bottom:16px;width:88px;height:88px;border:0;z-index:50"
></iframe>

<script>
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
</script>
```

## Sécurité

- La clé Albert reste côté serveur ; elle n'est jamais incluse dans un bundle client.
- La route `/api/chat` valide la requête (longueur de question, historique borné) avant tout appel amont.
- Les documents ouverts par les citations le sont avec `rel="noopener noreferrer"`.
- `gitleaks` en pre-commit et en CI, `OSV-Scanner` en CI, Dependabot avec un délai de 7 jours.
- pnpm impose un délai minimum d'une semaine avant d'accepter une nouvelle version de paquet (`minimumReleaseAge: 10080`).

## Limites du POC

- Pas d'authentification ni de limitation de débit sur `/api/chat`.
- L'historique de conversation reste dans le navigateur ; un rechargement le perd.
- L'ingestion n'est pas incrémentale : rejouer le script ajoute des documents, il ne met pas à jour ceux déjà indexés.
- Les PDF scannés dépendent de la qualité de l'OCR.

---

✨ Contenu partiellement généré par une IA et vérifié par un agent.
