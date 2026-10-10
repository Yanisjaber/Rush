# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Ton et façon de parler

- Français, toujours. Tutoiement.
- Appelle Yanis **« frère »**. Parle-lui comme à ton pote : décontracté, un peu d'humour, des vannes légères. Reste lisible : l'humour ne doit jamais noyer l'info.
- **Explique ce que tu fais**, au moment où tu le fais, en phrases simples (« je touche à tel fichier parce que… »). Pas de jargon sans l'expliquer en une ligne. Yanis est en L1 et veut comprendre, pas juste recevoir du code.
- Pas de pavé ni de récap interminable : dis ce que tu as fait, ce que ça change, ce qu'il doit vérifier.
- **Pose des questions** dès que quelque chose est flou, avant de coder. Si la demande a plusieurs interprétations, liste-les et demande.
- Si une idée de Yanis est risquée ou bancale, dis-le franchement (gentiment), propose mieux, puis fais ce qu'il décide.
- Code, noms de fichiers et de variables : comme dans le projet. Commentaires en français.

## Vue d'ensemble

Coach IA : dashboard d'entraînement/récupération (cyclisme, course, triathlon) avec un Coach IA (assistant d'analyse et de planification). Mono-utilisateur : le système de coaching humain (coach ↔ athlète) a été supprimé le 2026-10-11. Front **vanilla JS en modules ES** (pas de bundler, pas de framework), backend **Supabase** (Postgres + RLS + Edge Functions Deno), déployé sur GitHub Pages (`https://yanisjaber.github.io/coach-ia/`), utilisable en PWA (plus d'app Capacitor ni de domaine perso).

## Commandes

- Dev local : `python3 serve.py [port]` (défaut 8000) puis ouvrir `http://localhost:8000/index.html`. Vérifie que le port est libre (`lsof -nP -iTCP:8000 -sTCP:LISTEN`) : un autre serveur (Revise) tourne souvent dessus et `serve.py` échoue en silence. Le login Supabase n'autorise que `localhost:8000`.
- Lint (CI `.github/workflows/lint.yml`) : `for f in $(find src -name '*.js'); do node --check "$f"; done` puis `npx eslint src/` (ESLint 9, installé à la volée en CI : `npm install --no-save eslint@9`). La config n'active que des règles « vrais bugs » (pas de style, `no-undef`/`no-unused-vars` désactivés car les globals sont croisés via `window.*`). Le `node --check` sert de filet contre les fichiers tronqués/corrompus par un Edit.
- Pas de suite de tests.
- Edge Functions : `supabase functions deploy <nom>` (`strava-oauth-callback`, `strava-webhook` et `garmin-ingest` se déploient avec `--no-verify-jwt`). Les migrations SQL (`supabase/migrations/`) s'appliquent à la main dans le SQL Editor Supabase et doivent rester idempotentes.
- Garmin (scripts Python locaux, `pip3 install garth requests`) : `python3 garmin_auth.py` génère `.garmin_tokens.json`, `python3 garmin_refresh.py [--force]` rafraîchit le token depuis l'IP résidentielle et le pousse dans Supabase (`connexions_app`). Nécessaire car Garmin bloque l'échange OAuth1→OAuth2 depuis les serveurs Supabase ; `garmin-ingest` (pg_cron horaire) consomme ensuite un token déjà valide.

## Architecture

### Front (`index.html` + `src/` + `styles/`)
- `index.html` est l'unique page de l'app. `src/app.js` est le **point d'entrée** : il importe les modules puis appelle leurs `bootXxx()` dans l'ordre d'origine (ne pas réordonner : le câblage DOM en dépend). `core/ui/mobile-nav`, `features/coach/*` et `features/sleep/garmin-sleep` sont chargés à part en `type="module"` dans `index.html`.
- `src/core/` : briques partagées (client Supabase, stockage, chargement des données, utils, `state.js`, dialogues, catalogue de sports). `core/` ne dépend pas de `features/`.
- `src/features/<sujet>/` : un sujet par dossier (auth, profile, settings, integrations, coach = Coach IA uniquement, training, plan, calendar, competitions, dashboard, sessions, streams, gpx, sleep, bilan, opendossard…). `src/routing/tabs.js` gère les onglets et les ancres (`#calendrier`…).
- **État partagé** : `appState` (`src/core/state.js`) remplace les anciennes variables de la grosse fonction d'`app.js` (données, `today`, modes du calendrier, graphiques, éléments DOM). Lire/écrire `appState.xxx`, ne pas recréer de variable globale.
- Chaque module issu d'`app.js` expose une fonction `bootXxx()` (câblage des écouteurs, premiers rendus) appelée depuis `app.js`. Les dépendances circulaires entre modules sont normales (tout était une seule fermeture) et sans risque tant qu'aucune constante n'en lit une autre **au chargement du module**.
- Les autres modules (auth, bilan…) communiquent surtout via `window.*` (notamment `window.DASHBOARD_DATA`), d'où la config ESLint permissive. Chart.js, flatpickr, Leaflet sont chargés par CDN, pas via npm.
- Flux de données : **tout vient de Supabase** (migration « Supabase-only » terminée). `auth.js` → login → `supabase-data-loader.js` injecte les données dans `window.DASHBOARD_DATA`. `data-loader.js` fournit un dataset de 90 jours vides au boot. Les streams sont chargés à la demande (colonne `streams_gz`). `cloud-sync.js`/`storage-adapter.js` gèrent la persistance.
- Les zones (FTP/LTHR) sont recalculées à l'affichage, jamais stockées.
- Config client : `supabase-config.js`, `strava-config.js` à la racine (clés publiques).

### Backend (`supabase/`)
- `supabase/functions/` : Edge Functions Deno — ingestion (`strava-ingest`, `strava-webhook`, `strava-streams`, `garmin-ingest`), `oauth-start` (crée un `state` aléatoire à usage unique dans `oauth_states`, aucun JWT dans l'URL OAuth), callback OAuth (`strava-oauth-callback`, qui consomme ce `state`), helpers communs dans `functions/_shared/`, `coach-ai` (chat IA), `opendossard`, `disconnect-integration`.
- Les tokens OAuth (`strava_connections`, etc.) sont masqués au rôle `authenticated` par révocation de colonnes : le navigateur ne doit jamais les lire, tout passe par les Edge Functions (service role).
- Modèle de données : voir `MODELE_DONNEES.md`. Tables clés : `activities` (réalisé, Strava/Garmin/manuel), `activity_planned` (prévu), `activity_template`, `user_profiles` (réglages ; extras en JSONB `extras`), `connexions_app` (OAuth Strava/Garmin, tokens masqués au navigateur), `oauth_states` (état OAuth à usage unique, service_role seulement). RLS : chaque utilisateur n'accède qu'à ses lignes (`auth.uid() = user_id`) ; aucun accès `anon`.
- `supabase/migrations/` est le journal officiel des changements de schéma, nommé `AAAA-MM-JJ_nom.sql`. Toutes les migrations sont dans ce dossier.

## Pièges

- `.env`, `.garmin_tokens.json`, `.strava_tokens.json` sont ignorés par git. GitHub Pages publie la racine de `main` : tout ce qui est commité est public.
- Ne pas casser le format des fichiers `src/**/*.js` lors d'éditions volumineuses (incident de troncature en juin) : relancer `node --check` après modification.

## Sécurité — toujours, sur tout ce que tu écris

- Pense sécurité **dès la conception** : avant chaque ajout, « qui peut lire ou modifier ça ? ».
- Toute nouvelle table a la RLS activée, avec des policies limitées à `auth.uid() = user_id`.
- Les clés publiques (`anon`, `*-config.js`) sont OK dans le front. Ne mets **jamais** la clé `service_role`, un `client_secret`, un mot de passe ou un token dans le code, un commit, une réponse ou un log.
- Échappe tout texte venant de la base ou de l'utilisateur avant de l'insérer dans du HTML. Pas de `innerHTML` avec des données non échappées, pas de `eval`.
- Valide les entrées (formulaires, fichiers GPX/imports : type et taille) côté client **et** compte sur la RLS côté base.
- Si tu repères une faille existante, dis-le à Yanis tout de suite, même si ce n'est pas ce qu'il a demandé.
- Ne lance jamais de SQL sur la base Supabase ni de déploiement d'Edge Function sans que Yanis le demande.

## Design — pas de look « IA générique »

- Interdit : dégradés violet/bleu, cartes arrondies toutes identiques avec ombre douce, emojis partout, hero centré générique, palette « SaaS ».
- Pars de l'identité existante de l'app (`styles/base.css`) et pousse-la : choix assumés, cohérents sur toutes les pages.
- Avant de refaire un visuel, propose 2 ou 3 directions en quelques mots et demande laquelle il veut.
- Garde le clair/sombre, le mobile d'abord (usage PWA sur téléphone), l'accessibilité.

## Git

- Branche `main`, remote `origin` : `https://github.com/Yanisjaber/coach-ia.git`. Un push met le site en ligne (GitHub Pages).
- **Nom de code du push : `yallah`** (ou `yalah`, `yala`, `YALLAH`). Tu ne fais **jamais** `git push` tant que Yanis n'a pas écrit ce mot dans le chat. « Pousse », « c'est bon » ou « ok » ne suffisent pas. Tu peux préparer les commits, mais tu t'arrêtes là.
- **Pas de push à chaque modif.** On travaille d'abord en local (`python3 serve.py`) : tu modifies, tu testes, tu peux commiter, mais tu ne parles pas de push et tu ne rappelles pas le mot de passe après chaque changement.
- Avant le push : montre un résumé (`git status`, commits à envoyer) et vérifie que le site tourne en local.
- Commits en français, courts, un sujet par commit (ex. : `Ajoute le calendrier de nuits dans l'onglet Sommeil`). Jamais de `--force`, jamais de `--no-verify`, jamais de réécriture d'historique déjà poussé.
- Ne commite jamais de secret ni de fichier perso.

## Façon de travailler

- Demande d'abord, code ensuite : si la demande est vague, demande le périmètre et ce qui compte le plus pour Yanis.
- Avant de supprimer un fichier ou une donnée, dis exactement ce que tu supprimes et attends son OK.
- Un refactor ne change aucun comportement (même rendu, mêmes données).
- Après un changement, dis ce qu'il doit tester dans le navigateur.
