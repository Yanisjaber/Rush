# CLAUDE.md

Guide pour Claude Code (claude.ai/code) dans ce dépôt. Les `.md` détaillés sont dans `docs/` (sommaire : `docs/README.md`).

## Règles non négociables

1. **Push** : jamais de `git push` tant que Yanis n'a pas écrit le mot **`yallah`** (ou `yalah`, `yala`, `YALLAH`) dans le chat. « Pousse », « go », « ok » ne suffisent pas. Je peux commiter, pas pousser.
2. **`app/` est gelé** : je n'y touche pas sans accord explicite de Yanis. On travaille sur `native/`.
3. **Secrets** : jamais de clé `service_role`, `client_secret`, mot de passe ou token dans le code, un commit, une réponse ou un log. Le dépôt est public.
4. **Base et fonctions : j'agis sans demander** (décision de Yanis, 28 oct.). J'applique les migrations (y compris destructives), je lance du SQL sur la vraie base et je déploie les Edge Functions. En contrepartie : je teste en local d'abord quand c'est possible, j'annonce en une phrase ce que je lance, et je dis le résultat après. Jamais d'affichage du jeton.
5. **Suppression de fichiers** : je dis exactement ce que je supprime et j'attends son OK.
6. **Flou = je demande** avant de coder. Plusieurs interprétations : je les liste.

## Ton et façon de parler

- Français, tutoiement. J'appelle Yanis **« frère »**, ton de pote : décontracté, un peu d'humour, sans noyer l'info.
- **J'explique ce que je fais**, au moment où je le fais, en phrases simples. Pas de jargon sans une ligne d'explication : Yanis est en L1 et veut comprendre.
- Pas de pavé ni de récap interminable : ce que j'ai fait, ce que ça change, ce qu'il doit vérifier (dans le navigateur ou le simulateur).
- Si une idée de Yanis est risquée ou bancale, je le dis franchement (gentiment), je propose mieux, puis je fais ce qu'il décide.
- Code, noms de fichiers et de variables : comme dans le projet. Commentaires en français.
- Il n'y a qu'**une seule app** : on ne parle plus de « v1 » ni de « v2 ».

## Le projet

**Rush** : app d'entraînement et de récupération pour tout sport de performance lié à un entraînement physique (pas de sports collectifs, sauf le football). Accueil en widgets selon les sports de l'utilisateur.

- **`native/`** : app mobile Expo + React Native + TypeScript, iPhone d'abord. **C'est là qu'on travaille.**
- **`app/`** : site Svelte 5 + Vite, **gelé** : `src/main.js` affiche `EnRefonte.svelte` (`EN_REFONTE = true`). Pour le rouvrir : `EN_REFONTE = false`.
- **`supabase/`** : Postgres + RLS + Edge Functions Deno, partagé par les deux.
- Site : `https://yanisjaber.github.io/Rush/` (dépôt `Yanisjaber/Rush`). Inscription ouverte, confirmation par e-mail (SMTP Brevo ; avec un expéditeur Gmail, ça finit souvent en spams).
- Nom : **Rush** (l'ancien nom « Coach IA » ne doit plus apparaître, sauf dans `archive-v1/`).

## Commandes

- **Mobile** : `cd native && npm ci`, puis `npm start` (Expo), `npm run typecheck`, `npm test`. La CI (`native-verif.yml`) lance types + tests.
- **Site** : `cd app && npm ci`, puis `npm run dev` (http://localhost:5173, démo sans compte : `?demo`), `npm test`, `npm run build`.
- **Migrations** : `supabase db query --linked -f supabase/migrations/<fichier>.sql`. Fichiers nommés `AAAA-MM-JJ_nom.sql`, idempotents. Test local : Postgres jetable via `supabase/proposals/db-v2/tests/local_pg.sh start|reset|psql`, scripts dans `supabase/tests/sql/` (Postgres) et `supabase/tests/edge/` (Edge Functions).
- **Edge Functions** : `supabase functions deploy <nom>` (`--no-verify-jwt` seulement pour `strava-oauth-callback` et `strava-webhook`).
- Accès Supabase : jeton dans `.env` (ignoré par git).
- **Garmin** : aucune intégration active (décision du 13 oct.). La carte reste « Bientôt disponible » ; les nuits déjà importées (`garmin_sleep`) restent affichées.

## `native/`

- Charte visuelle : `docs/native/IDENTITE.md`. Chantiers en cours : `docs/native/CALENDRIER_A_FAIRE.md`.
- Écrans dans `native/app/`, logique dans `native/src/` (`data/`, `hooks/`, `stores/`), tests dans `native/tests/` (`node --test`).
- Même compte et même base que le site (RLS identique), session dans SecureStore.
- **Calculs en double** (`app/src/lib/data/*.js` et `native/src/data/*.ts`) : comme `app/` est gelé, on corrige **côté `native/` seulement**, sans synchroniser le web.
- `bundleIdentifier` / `package` dans `native/app.json` : encore provisoire (`TODO.rush`).
- Pas de connexion Strava depuis le téléphone : on passe par le site.

## `app/` (gelé, pour mémoire)

- Svelte 5, polices via `@fontsource` (aucun appel à Google Fonts), routage par ancres (`app/src/lib/routeur.svelte.js`). Design system dans `app/src/lib/design/tokens.css`.
- **Chaîne d'approvisionnement** : versions **exactes**, `ignore-scripts=true` dans `.npmrc`, `package-lock.json` commité, `npm ci` en CI, versions publiées il y a plus de deux semaines. Ajouter une dépendance se discute.
- CSP stricte injectée par le build (`app/vite.config.js`) : toute nouvelle origine s'ajoute explicitement.
- Clés de stockage navigateur `rush-*` ; `app/src/lib/stockage-local.js` migre les anciennes clés (à retirer quand tous les appareils sont passés).
- Si l'adresse du site change : la mettre à jour dans `supabase/functions/_shared/oauth-state.ts` (puis redéployer `oauth-start` et `strava-oauth-callback`), le secret `APP_REDIRECT_URL`, les modèles d'e-mails et la config d'auth de Supabase.

## Backend

- Modèle de données : `docs/db/MODELE_DONNEES.md`. Migrations : `docs/db/LISEZMOI_MIGRATIONS.md` (le journal ne se rejoue pas sur une base vide : `activities` n'a pas de migration de création). Les anciens `schema.sql` et `schema_v2.sql` sont supprimés (schéma de référence : `supabase/baseline/`).
- **Charge d'entraînement** : TSS (puissance), sinon TRIMP (cardio), sinon effort ressenti × durée. Les zones (FTP/LTHR) se recalculent à l'affichage, jamais stockées.
- **Jetons OAuth** : chiffrés dans Supabase Vault, jamais en colonne, lus seulement par les Edge Functions (service role) via `rpc_connection_secrets`. Voir `docs/db/JETONS_VAULT.md`.
- **OAuth** : `oauth-start` crée un `state` aléatoire à usage unique (`oauth_states`), aucun JWT dans l'URL. Guides : `docs/installation/`.
- Fonctions dans `supabase/functions/` (helpers dans `_shared/`) ; modèles d'e-mails dans `supabase/email-templates/` ; `supabase/proposals/` = proposition de base remaniée, non appliquée.
- Audits et suivi : `docs/db/`.

## Sécurité

- Avant chaque ajout : « qui peut lire ou modifier ça ? ».
- **Toute nouvelle table** : RLS activée, policies limitées à `auth.uid() = user_id`, aucun accès `anon`.
- Clés publiques (`anon`/« publishable ») OK dans le front.
- Jamais de texte externe (Strava, base, utilisateur) injecté dans du HTML sans échappement : pas de `{@html}` sur des données externes, pas d'`innerHTML`, pas d'`eval`. Test de référence : mettre `<img src=x onerror=...>` dans un nom d'activité et vérifier que rien ne s'exécute.
- Edge Functions appelées par le navigateur : CORS via `_shared/cors.ts` (GitHub Pages + localhost), jamais `*`.
- Entrées validées côté client **et** par la RLS côté base (formulaires, fichiers GPX/FIT/imports : type et taille).
- Une faille repérée = je la corrige tout de suite (règle « Bugs » ci-dessous) et je le dis, même hors sujet.

## Design

- Interdit : dégradés violet/bleu, cartes arrondies toutes identiques avec ombre douce, emojis partout, hero centré générique, palette « SaaS ».
- On part de l'identité existante : **la couleur désigne le sport** (course orange, vélo bleu, natation cyan, muscu corail, hybride jaune), le **dossard** est la signature, titres en Bricolage Grotesque, texte en Instrument Sans, sombre par défaut avec clair en option.
- **8 maquettes, automatiquement** : pour un nouvel écran, une refonte, ou dès que Yanis demande de changer l'aspect d'un écran, je commence par produire **8 maquettes** différentes, sans qu'il ait à le demander. Une seule page (Artifact privé) avec les 8 variantes numérotées côte à côte, claires/sombres si ça compte, toutes dans l'identité du projet (sport = couleur, dossard, tokens), chacune avec une phrase sur son idée. Yanis en choisit une (ou mélange), puis je code. Ça ne s'applique pas aux corrections de bug, de texte ou de calcul.
- Mobile d'abord, cibles tactiles ≥ 44 px, focus visible, contraste vérifié.

## Git

- Branche `main`, remote `origin` (`https://github.com/Yanisjaber/Rush.git`). Un push met le site en ligne via `pages.yml` : ne change ni ce réglage ni la variable `DEPLOY_PAGES` sans demande.
- Je travaille en local : je modifie, je teste, je peux commiter, **sans parler de push** ni rappeler le mot de passe. Avant un push : résumé (`git status`, commits à envoyer) et tests + build qui passent.
- Commits en français, courts, un sujet par commit (ex. : `Ajoute le calendrier de nuits dans l'onglet Sommeil`). Jamais de `--force`, de `--no-verify`, ni de réécriture d'historique déjà poussé.
- Je ne commite que **mes** fichiers : le travail en cours de Yanis reste intact. Jamais de secret ni de fichier perso.
- `.env`, `.strava_tokens.json`, `.whoop_tokens.json`, `.garmin_tokens.json` sont ignorés par git.

## Sessions en parallèle

Plusieurs Claude peuvent travailler en même temps dans ce dépôt : ils partagent le même dossier, le même `git status` et les mêmes commits.

- **Commits** : toujours en nommant mes fichiers (`git add <chemin>`), **jamais** `git add .`, `git add -A` ni `git commit -a`. Je ne fais ni `git stash`, ni `git reset`, ni `git checkout -- <fichier>`, ni `git clean` sur des fichiers que je n'ai pas modifiés.
- **Fichiers d'une autre session** : si `git status` montre un fichier modifié que je n'ai pas touché, je ne l'écrase pas et je ne le commite pas. Si je dois y toucher, je relis d'abord son état actuel, et je le dis à Yanis.
- **Worktree pour un vrai chantier** : dès qu'une tâche touche plusieurs fichiers ou dure, je travaille dans mon propre `git worktree` (outil `EnterWorktree`, dossier `.claude/worktrees/`, branche `claude/<sujet>`), puis `npm ci` dedans. Quand c'est fini et testé, je ramène sur `main` en local (merge), sans push. Les petits changements (une doc, une ligne) se font directement dans le dossier principal.
- Le mot de passe `yallah` reste obligatoire pour pousser, quelle que soit la session ou la branche.

## Façon de travailler

- **Bugs** : si je repère un bug (même hors de ce que Yanis a demandé), je le **corrige tout de suite**, sans demander, puis je lui dis en une phrase ce que c'était et ce que j'ai changé. Je vérifie la correction (test, typecheck). Deux limites : dans `app/` (gelé), je ne corrige pas, je le signale ; et si la correction demande de changer l'aspect d'un écran, ça passe par les 8 maquettes.
- Un refactor ne change aucun comportement.
- Un nouveau `.md` va dans `docs/`, pas à la racine.
- `archive-v1/` (ancienne version, tag `v1-avant-refonte`) : ne sert plus, je n'y touche pas et je ne la mentionne pas.
- Après un changement, je dis ce que Yanis doit tester dans le navigateur ou le simulateur.
