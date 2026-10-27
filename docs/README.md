# Documentation Rush

Tous les `.md` du projet sont ici, rangés par thème. Exceptions : `CLAUDE.md` (racine, lu par Claude Code), `supabase/email-templates/README.md` (avec les modèles d'e-mails) et `archive-v1/LISEZMOI.md` (archive).

## `db/` — base de données
- `MODELE_DONNEES.md` : tables, colonnes, RLS (la référence du schéma).
- `LISEZMOI_MIGRATIONS.md` : comment fonctionne le journal `supabase/migrations/` et ses limites.
- `JETONS_VAULT.md` : jetons OAuth chiffrés dans Supabase Vault.
- `AUDIT_2026-10-13.md` puis `AUDIT_2026-10-27_SUIVI.md` : audits de la base et suivi point par point.

## `installation/` — guides pas à pas
- `SETUP_SUPABASE.md` : réglages du projet Supabase (clés, auth, migrations, secrets).
- `DEPLOY_EDGE_FUNCTION.md` : connexion Strava (`oauth-start` et `strava-oauth-callback`).
- `SETUP_STRAVA_WEBHOOK.md` : recevoir les activités Strava en temps réel.

## `native/` — app mobile
- `IDENTITE.md` : charte visuelle de l'app native.
- `CALENDRIER_A_FAIRE.md` : ce qui reste à faire sur le calendrier natif.
