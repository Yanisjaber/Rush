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
- On ne parle plus de « v1 » ni de « v2 » : il n'y a qu'**une seule app**. (L'ancienne version est archivée, voir plus bas.)

## Vue d'ensemble

Rush : app d'entraînement et de récupération pour **tout sport de performance lié à un entraînement physique et une forme** (pas de sports collectifs). Accueil composé de widgets selon les sports de l'utilisateur, mode édition, deux coques (mobile simple, desktop complet). Front **Svelte 5 + Vite 8** (dossier `app/`), backend **Supabase** (Postgres + RLS + Edge Functions Deno), publié sur GitHub Pages (`https://yanisjaber.github.io/coach-ia/`), utilisable en PWA. Inscription ouverte (confirmation par e-mail, SMTP Brevo).

## Commandes

- Dev local : `cd app && npm ci` puis `npm run dev` → http://localhost:5173 (le catalogue du design system est sur `#/catalogue`). Mode démo sans compte : `?demo`.
- Vérifications : `npm test` (tests de calcul, `node --test`) et `npm run build`. La CI (`.github/workflows/app-build.yml` et `pages.yml`) fait `npm ci --ignore-scripts`, l'audit des dépendances de production, les tests et le build.
- Edge Functions : `supabase functions deploy <nom>` (`strava-oauth-callback` et `strava-webhook` avec `--no-verify-jwt`). Les migrations SQL (`supabase/migrations/`, nommées `AAAA-MM-JJ_nom.sql`, idempotentes) s'appliquent avec `supabase db query --linked -f <fichier>`. **Tests de base en local** : Postgres jetable via `supabase/proposals/db-v2/tests/local_pg.sh start|reset|psql` (jamais la vraie base).
- Garmin : **aucune intégration active** (décision du 2026-10-13). La carte « Garmin » de Paramètres › Connexions reste en « Bientôt disponible » (accès officiel à demander plus tard) ; les nuits déjà importées (`garmin_sleep`) restent affichées dans Sommeil.

## Architecture

### Front (`app/`)
- **Stack** : Svelte 5 + Vite 8. Polices hébergées via `@fontsource` (aucun appel à Google Fonts). Routage par ancres (`#/calendrier`…), voir `app/src/lib/routeur.svelte.js`.
- `app/src/routes/` : un écran par fichier (Accueil, Calendrier, Plan, Force, Hyrox, Compétitions, Bilan, Sommeil, Paramètres, Confidentialité…). `app/src/lib/components/` : briques réutilisables. `app/src/lib/stores/` : état partagé (`auth`, `profil`, `disposition`, `theme`, `connexions`). `app/src/lib/data/` : accès Supabase et calculs purs (testés dans `app/tests/`).
- **Chaîne d'approvisionnement** : versions **exactes** (`save-exact`), `ignore-scripts=true` dans `app/.npmrc`, `package-lock.json` commité, `npm ci` en CI. Choisir des versions publiées il y a plus de deux semaines. Peu de dépendances : en ajouter une est une décision à discuter.
- **Sécurité front** : les templates Svelte échappent le HTML (jamais `{@html}` avec des données externes). Le build injecte une CSP stricte (voir `app/vite.config.js`) : si une nouvelle origine est nécessaire (Supabase, Strava…), l'ajouter explicitement.
- **Design system** (`app/src/lib/design/tokens.css`) : **la couleur désigne le sport**, pas le profil (course orange, vélo bleu, natation cyan, muscu corail, hybride jaune). Fond sombre par défaut, thème clair en option (suit le compte via `user_preferences`). Titres et chiffres en Bricolage Grotesque, texte en Instrument Sans. Le **dossard** (bloc clair avec quatre points d'attache) est la signature visuelle. Cibles tactiles d'au moins 44 px, focus visible, contraste vérifié.
- **Données** : tout vient de Supabase (RLS `auth.uid() = user_id`). Charge d'entraînement universelle : TSS (puissance), sinon TRIMP (cardio), sinon effort ressenti × durée. Les zones (FTP/LTHR) sont recalculées à l'affichage, jamais stockées.
- **Nom de l'app : Rush** (ancien nom « Coach IA », abandonné le 15 oct : il ne doit plus apparaître nulle part, sauf dans `archive-v1/`). Clés de stockage navigateur : `rush-*` (thème, disposition, brouillons…) ; `app/src/lib/stockage-local.js` recopie une fois les anciennes clés de l'ancien nom au premier lancement, pour que personne ne perde ses réglages (fichier à retirer quand tous les appareils sont passés).
- Restent à l'ancien nom tant que le dépôt GitHub n'est pas renommé : l'adresse GitHub Pages (`yanisjaber.github.io/coach-ia/`), l'adresse du dépôt, et ce qui en dépend (liste des redirections de `oauth-state.ts`, liens des e-mails, commentaire de `pages.yml`).

### Backend (`supabase/`)
- `supabase/functions/` : Edge Functions Deno — ingestion (`strava-ingest`, `strava-webhook`, `strava-streams`, `strava-laps`), `oauth-start` (crée un `state` aléatoire à usage unique dans `oauth_states`, aucun JWT dans l'URL OAuth), callback OAuth (`strava-oauth-callback`), `delete-account` (suppression en 3 étapes : préparer, purger par lots, supprimer), `opendossard`, `disconnect-integration`, `coach-ai`. Helpers communs dans `functions/_shared/` (dont `jetons.ts` pour les jetons et `cors.ts`).
- **Jetons OAuth** : chiffrés dans Supabase Vault (`connexions_app.secret_id`), jamais en colonne ; lus seulement par les Edge Functions (service role) via `rpc_connection_secrets`. Le navigateur ne voit que le statut de la connexion. Voir `docs/db/JETONS_VAULT.md`.
- Modèle de données : voir `MODELE_DONNEES.md`. Tables clés : `activities`, `activity_planned`, `activity_template`, `user_profiles` (réglages ; extras en JSONB `extras`), `user_preferences` (disposition de l'accueil et thème), `connexions_app`, `oauth_states` (service_role seulement), tables de force et Hyrox. RLS : chaque utilisateur n'accède qu'à ses lignes (`auth.uid() = user_id`) ; aucun accès `anon`.
- `supabase/migrations/` est le journal officiel des changements de schéma. `supabase/proposals/` contient la proposition d'une future base remaniée (non appliquée). `supabase/email-templates/` : les modèles d'e-mails d'authentification (à coller dans Supabase). Audit et plans : `docs/db/`.

### Archive
- `archive-v1/` : l'ancienne version de l'app (code source) et le schéma de la base de l'époque, sans données. **Ne sert plus à rien**, ne pas y toucher ni la mentionner. Le tag git `v1-avant-refonte` marque cette époque.

## Pièges

- `.env`, `.strava_tokens.json`, `.whoop_tokens.json`, `.garmin_tokens.json` sont ignorés par git. Le dépôt est public : tout ce qui est commité l'est (jetons, clés secrètes, fichiers perso : jamais). GitHub Pages ne sert que ce que `pages.yml` assemble (le build de `app/`).
- Un push sur `main` met l'app en ligne : le déploiement est piloté par `.github/workflows/pages.yml` (source Pages = « GitHub Actions », variable de dépôt `DEPLOY_PAGES=true`). Ne change ni ce réglage ni cette variable sans que Yanis le demande.
- Les e-mails envoyés par Brevo avec un expéditeur Gmail finissent souvent en spams (un domaine à lui réglerait ça).

## Sécurité — toujours, sur tout ce que tu écris

- Pense sécurité **dès la conception** : avant chaque ajout, « qui peut lire ou modifier ça ? ».
- Toute nouvelle table a la RLS activée, avec des policies limitées à `auth.uid() = user_id`.
- Les clés publiques (`anon`/« publishable », `app/src/lib/config.js`) sont OK dans le front. Ne mets **jamais** la clé `service_role`, un `client_secret`, un mot de passe ou un token dans le code, un commit, une réponse ou un log.
- N'insère jamais de texte venant de Strava, de la base ou de l'utilisateur dans du HTML sans l'échapper (les templates Svelte le font ; pas de `{@html}` sur des données externes, pas d'`innerHTML`, pas d'`eval`). Test dynamique de référence : mettre `<img src=x onerror=...>` dans les noms d'activités, parcourir les écrans et vérifier que rien ne s'exécute.
- Edge Functions appelées par le navigateur : CORS via `_shared/cors.ts` (GitHub Pages + localhost), jamais `*`.
- Valide les entrées (formulaires, fichiers GPX/imports : type et taille) côté client **et** compte sur la RLS côté base.
- Si tu repères une faille existante, dis-le à Yanis tout de suite, même si ce n'est pas ce qu'il a demandé.
- Ne lance jamais de SQL sur la base Supabase ni de déploiement d'Edge Function sans que Yanis le demande.

## Design — pas de look « IA générique »

- Interdit : dégradés violet/bleu, cartes arrondies toutes identiques avec ombre douce, emojis partout, hero centré générique, palette « SaaS ».
- Pars de l'identité existante (`app/src/lib/design/tokens.css`) et pousse-la : choix assumés, cohérents sur toutes les pages.
- Avant de refaire un visuel, propose 2 ou 3 directions en quelques mots et demande laquelle il veut.
- Garde le clair/sombre, le mobile d'abord (usage PWA sur téléphone), l'accessibilité.

## Git

- Branche `main`, remote `origin` : `https://github.com/Yanisjaber/coach-ia.git`. Un push met le site en ligne (GitHub Pages via `pages.yml`).
- **Nom de code du push : `yallah`** (ou `yalah`, `yala`, `YALLAH`). Tu ne fais **jamais** `git push` tant que Yanis n'a pas écrit ce mot dans le chat. « Pousse », « go », « c'est bon » ou « ok » ne suffisent pas. Tu peux préparer les commits, mais tu t'arrêtes là.
- **Pas de push à chaque modif.** On travaille d'abord en local : tu modifies, tu testes, tu peux commiter, mais tu ne parles pas de push et tu ne rappelles pas le mot de passe après chaque changement.
- Avant le push : montre un résumé (`git status`, commits à envoyer) et vérifie que tests et build passent.
- Commits en français, courts, un sujet par commit (ex. : `Ajoute le calendrier de nuits dans l'onglet Sommeil`). Jamais de `--force`, jamais de `--no-verify`, jamais de réécriture d'historique déjà poussé.
- Ne commite jamais de secret ni de fichier perso.

## Façon de travailler

- Demande d'abord, code ensuite : si la demande est vague, demande le périmètre et ce qui compte le plus pour Yanis.
- Avant de supprimer un fichier ou une donnée, dis exactement ce que tu supprimes et attends son OK.
- Un refactor ne change aucun comportement (même rendu, mêmes données).
- Après un changement, dis ce qu'il doit tester dans le navigateur.
