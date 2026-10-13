# Nettoyage de la base

**FAIT le 2026-10-13** (migrations `2026-10-14_menage_base_1.sql`, `_2_inscription.sql`, `_3_fin.sql`, testées en local par `supabase/tests/menage_base.sh`) :

- `user_profiles.display_name` et `extras.full_name` supprimés : le prénom et le nom sont uniquement dans `extras.first_name` / `extras.last_name` (créés à l'inscription par le déclencheur `handle_new_user`).
- `user_profiles.strava_athlete_id` supprimé (doublon de `connexions_app.external_id`) ; `strava-oauth-callback` et `disconnect-integration` ne l'utilisent plus (et ne remplacent plus le prénom ni le FTP par `null`).
- Tables `preferences`, `od_prefs` et `garmin_sync_requests` supprimées (sauvegarde locale hors dépôt).
- Avant : `profiles` fusionnée dans `user_profiles`, colonnes de jetons en clair retirées de `connexions_app`, `user_dashboard` devenu `user_preferences`, clés `null` de `extras` retirées.

Reste à décider plus tard : `garmin_sleep` (18 nuits importées) à garder tant que l'accès officiel Garmin n'est pas là.

## 5. Ce qui ne bouge pas
`ftp`, `hr_max`, `lthr`, `weight` restent des colonnes de `user_profiles` (utilisées partout). La grande séparation « identité / physiologie / connexions »
décrite dans `PROPOSITION_V2.md` (proposition d'une base remaniée) est un chantier à part, à décider plus tard.
