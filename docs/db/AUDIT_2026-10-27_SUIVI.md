# Audit du 27 octobre 2026 : suivi

Audit complet (fichiers + base) fait le 27 octobre 2026, traité point par point avec Yanis.

## Fait

- **1. « Tout effacer » Strava** : `disconnect-integration` ne supprime plus que les `activities` qui ont un `strava_id` (les séances manuelles et importées restent). **Code corrigé, fonction pas encore redéployée** (`supabase functions deploy disconnect-integration`).
- **2. `daily_metrics`** : `recalc_daily_metrics` ignore les étapes fusionnées (`merged_into`) et la série va jusqu'à aujourd'hui. Migrations `2026-10-27_daily_metrics_sans_etapes_fusionnees.sql` et `2026-10-27_daily_metrics_jusqua_aujourdhui.sql`, **appliquées** sur la vraie base. Test local : `supabase/tests/daily_metrics_fusion.sh`.

## En attente (décidé avec Yanis : « on fera le calcul des données plus tard »)

- **Un seul calcul de la charge** : aujourd'hui trois versions (trigger SQL, `strava-ingest`, `strava-webhook`). Retirer le calcul de forme des Edge Functions et ne garder que le trigger.
- **TSS identique selon le chemin d'arrivée** : le webhook utilise `weighted_average_watts || 0`, l'ingest `weighted_average_watts || average_watts` et estime la FTP. Mettre le calcul dans `_shared/`.
- **`strava-streams`** : FC de repos fixée à 50, FTP 250 W et FC max 190 par défaut, courbes de puissance qui supposent 1 point = 1 s, `power_profile_sport` supprimé puis réécrit sans transaction, flux en base64, charge CPU à mesurer.
- La série `daily_metrics` ne s'allonge que quand `activities` change (idée : `pg_cron` pour la prolonger chaque jour).

## Reste de la liste (pas encore pris)

4. Export de données incomplet (`health_metrics`, `training_cycles`, `hyrox_efforts`, `power_profile*`) et page Confidentialité en retard ; mobile sans export ni suppression de compte.
5. Journal de migrations non rejouable (`activities` jamais créée, ordre `jetons_colonnes_mortes` / `jetons_vault_1`), `schema.sql` et `schema_v2.sql` périmés.
6. Droits `TRUNCATE`/`TRIGGER`/`REFERENCES` des tables créées après le 11 octobre ; SEC-4 sur `strength_sets` et `hyrox_tests`.
7. Pas de plafond de stockage avec l'inscription ouverte ; `opendossard` sans limite de débit.
8. `strava-oauth-callback` : connexion créée avant les jetons, `first_connected_at` réécrit, commentaire FTP faux, scope `profile:read_all` inutile.
9. `strava-webhook` : `subscription_id` à rendre obligatoire.
10. `let corsHeaders` global dans 5 fonctions.
11. Messages d'erreur internes renvoyés au client.
13. 21 modules dupliqués entre `app/` et `native/`.
14. Code mort et vocabulaires de sports différents dans les Edge Functions.
15. CI : `native/` non couvert, actions GitHub non épinglées, `npm audit` de `native/`.
16. Documents périmés (`CLAUDE.md` sans `native/`, `MODELE_DONNEES.md`, `JETONS_VAULT.md`, guides Strava, `.gitignore`).
17. Mobile : bouton « Connecter Strava », `TODO.rush`.
