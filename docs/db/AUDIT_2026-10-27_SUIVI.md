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

## Fait le 28 octobre (par points de l'audit)

- **4. Export et Confidentialité** : l'export ajoute `health_metrics`, `training_cycles`, `hyrox_efforts`, `power_profile*` et les colonnes récentes d'`activities` ; la page Confidentialité (mise à jour le 28 octobre) parle de la santé détaillée, de l'app mobile, de Brevo. Reste : export et suppression de compte **dans l'app mobile** (suppression en cours dans `native/`, pas d'export).
- **5. Migrations** : `jetons_colonnes_mortes` renommée `jetons_vault_3_colonnes_mortes` (ordre correct), `schema.sql` et `schema_v2.sql` marqués périmés, `docs/db/LISEZMOI_MIGRATIONS.md` explique la limite (la table `activities` n'a pas de migration de création). Reste : un instantané de la base (`supabase db dump`, Docker requis) pour pouvoir rejouer le journal.
- **6. Droits** : déjà corrects en production (vérifié : aucun `TRUNCATE`/`TRIGGER`/`REFERENCES` pour `authenticated`, rien pour `anon`). Migration `2026-10-28_liens_activite_et_droits.sql` : policies de `strength_sets` et `hyrox_tests` qui vérifient que la séance liée est à l'utilisateur (SEC-4), plus rien par défaut pour `anon`, `search_path` de `health_metrics_garde_fous`. **Appliquée.** Test : `supabase/tests/liens_et_plafonds.sh`.
- **7. Plafonds** : migration `2026-10-28_plafonds_stockage.sql` (14 tables avec un nombre de lignes maximal par compte, `streams_gz` ≤ 1 Mo, `extras` ≤ 100 Ko). **Appliquée.** `opendossard` : 30 appels par minute et par compte, filtres bornés.
- **8. `strava-oauth-callback`** : plus de connexion « fantôme » si l'écriture des jetons échoue, `first_connected_at` non réécrit, FTP/poids seulement si vides, scope lu dans l'URL de retour, paramètre `error` filtré, droit `profile:read_all` retiré.
- **9. Webhook** : le filtre `STRAVA_WEBHOOK_SUBSCRIPTION_ID` est obligatoire (le secret existe en production), le journal ne garde plus que le type et l'identifiant de l'event.
- **10 et 11.** `corsHeaders` n'est plus une variable partagée dans 5 fonctions, et plus aucun `e.message` ni `detail` renvoyé au client.
- **14.** `classifyType` (×2) et `wattsFromStreamArray` retirées ; commentaires périmés corrigés.
- **15. CI** : actions épinglées par empreinte, nouveau `native-verif.yml` (types + tests de `native/`). Reste : 7 alertes `npm audit` dans l'outillage Expo (`native/`), à traiter avec une mise à jour d'Expo.
- **16. Docs** : `CLAUDE.md` (section `native/`), `MODELE_DONNEES.md`, guides Strava, `JETONS_VAULT.md`, `CALENDRIER_A_FAIRE.md`, `.gitignore`.

## Edge Functions à redéployer (le code est corrigé, la version en ligne est l'ancienne)

`disconnect-integration`, `opendossard`, `delete-account`, `strava-ingest`, `strava-streams`, `strava-webhook`, `strava-oauth-callback` (avec `--no-verify-jwt` pour les deux Strava sans JWT).

## Reste

- **12. `strava-streams`** (calcul des données, en attente avec le n°3).
- **13. Modules en double `app/` ↔ `native/`** : décision du 28 octobre = on documente (voir `CLAUDE.md`), pas de paquet partagé pour l'instant. Piste : des tests de parité sur les calculs les plus sensibles (sommeil, structure, synthèse).
- **14 (suite).** `SPORT_TO_CAT` / `hours_only` / `mainId` dans `strava-ingest`, et vocabulaires de sports différents : à traiter avec le calcul.
- **17. Mobile** : identifiant `TODO.rush` (à choisir par Yanis), bouton « Connecter Strava » qui renvoie vers le site (travail en cours dans `native/`).
