# Audit du 27 octobre 2026 : suivi

Audit complet (fichiers + base) fait le 27 octobre 2026, traité point par point avec Yanis.

## Fait

- **1. « Tout effacer » Strava** : `disconnect-integration` ne supprime plus que les `activities` qui ont un `strava_id` (les séances manuelles et importées restent). **Code corrigé, fonction pas encore redéployée** (`supabase functions deploy disconnect-integration`).
- **2. `daily_metrics`** : `recalc_daily_metrics` ignore les étapes fusionnées (`merged_into`) et la série va jusqu'à aujourd'hui. Migrations `2026-10-27_daily_metrics_sans_etapes_fusionnees.sql` et `2026-10-27_daily_metrics_jusqua_aujourdhui.sql`, **appliquées** sur la vraie base. Test local : `supabase/tests/daily_metrics_fusion.sh`.

## Calcul de la charge (fait le 28 octobre, après l'avoir mis en attente)

- **Un seul TSS** : `supabase/functions/_shared/charge.ts` (`computeTss`, `stravaToRow`, `ftpEffective`, `lthrEffectif`) est utilisé par `strava-ingest` et `strava-webhook`. Puissance normalisée sinon moyenne, FTP du profil sinon estimée, sinon cardio. Test : `node --experimental-strip-types --test supabase/tests/charge.test.mts`. **Déployé.**
- **Un seul calcul de forme** : le trigger SQL (`recalc_daily_metrics`) ; le calcul des deux fonctions est retiré. `pg_cron` (`daily_metrics_nuit`, 00 h 05 UTC) la prolonge chaque nuit. **Appliqué.**
- **`strava-streams`** : plus de FTP 250 W ni de FC max 190 inventées (estimées sur la séance, sinon mesures omises). La FC de repos reste 50 (le profil n'en a pas). **Déployé.**
- **Précision 1 point par seconde** : `_shared/flux.ts` (`reechantillonner1Hz`) remet les flux de puissance à 1 Hz avant le calcul des courbes (trou de 10 s ou moins = valeur tenue, plus long = 0). Test : `supabase/tests/flux.test.mts`. `POWER_CURVE_VERSION` passe à 6 : les anciennes courbes sont recalculées petit à petit par le rattrapage de `strava-streams`.
- **Records de puissance en une transaction** : migration `2026-10-28_remplacer_power_profile.sql` (`rpc_remplacer_power_profile` et `_sport`, service_role seulement), **appliquée** ; test `supabase/tests/remplacer_power_profile.sh`. Un record d'une séance supprimée disparaît maintenant.
- **Base64 (décision : on ne convertit pas en bytea)** : gain de 21 Mo seulement (84 → 63 Mo) pour toucher le site, le mobile et 1 319 flux. À la place, **`VACUUM FULL` de `activities` fait le 28 octobre** : la table était à 289 Mo dont ~190 Mo d'espace mort (TOAST), elle est passée à **95 Mo** (base : 313 → 119 Mo), sans perte (4 358 séances, 1 319 flux). Si ça regonfle (réécritures de `streams_gz` par le rattrapage), refaire un `VACUUM FULL` ; `autovacuum` ne rend pas l'espace au disque.
- **Correction au passage** : l'estimation de FTP lisait une colonne `best_watts` qui n'existe pas dans `power_profile` (elle s'appelle `watts_90d` / `watts_alltime`) : l'étape « 95 % du 20 min » n'avait jamais marché.
- **Test dans le simulateur (compte de Yanis)** : ajout d'une séance manuelle puis suppression par l'app, vérifiés dans la base (plafonds et policies laissent passer, `daily_metrics` recalculé dans les deux sens).
- **Pas fait** : charge CPU de `strava-streams` à mesurer, et les mesures déjà calculées avec les anciennes valeurs par défaut (FTP 250 W, FC max 190) dans `metrics` (il faudrait augmenter `METRICS_VERSION` et relancer un rattrapage).

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

Toutes redéployées le 28 octobre (y compris après le calcul de charge).

## Reste

- **12. `strava-streams`** : reste la précision 1 Hz, la transaction du power profile, le base64 et le CPU (voir plus haut).
- **13. Modules en double `app/` ↔ `native/`** : décision du 28 octobre = on documente (voir `CLAUDE.md`), pas de paquet partagé pour l'instant. Piste : des tests de parité sur les calculs les plus sensibles (sommeil, structure, synthèse).
- **14 (suite).** `hours_only` dans `strava-ingest` ; `SPORT_TO_CAT` et `mainId` sont retirés avec le calcul. Les vocabulaires de sports (serveur / mobile) ne sont plus comparés côté serveur.
- **17. Mobile** : identifiant `TODO.rush` (à choisir par Yanis), bouton « Connecter Strava » qui renvoie vers le site (travail en cours dans `native/`).
