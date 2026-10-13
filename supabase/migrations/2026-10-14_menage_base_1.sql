-- ============================================================
-- Grand ménage de la base, étape 1 (13/10/2026). Sans effet sur l'app en ligne. Idempotente.
--
--  1. Recopie les noms dans `user_profiles.extras` (first_name / last_name) pour les anciens profils qui n'avaient leur nom
--     que dans `display_name` ou `extras.full_name` (étape 2 : ces deux champs disparaissent, voir 2026-10-14_menage_base_2.sql).
--     On ne remplace jamais un first_name / last_name déjà présent.
--  2. Supprime `user_profiles.strava_athlete_id` : doublon exact de `connexions_app.external_id` (vérifié : 2 comptes sur 2 identiques),
--     plus lu ni écrit par aucune Edge Function.
--  3. Supprime les tables que plus aucun code ne lit : `preferences` (vide), `od_prefs` (1 ligne, sauvegardée hors dépôt),
--     `garmin_sync_requests` (vide, l'ancien pont vers le Raspberry Pi).
-- ============================================================

-- 1. Noms : first_name / last_name à partir de full_name, sinon de display_name
update public.user_profiles u
set extras = u.extras || jsonb_strip_nulls(jsonb_build_object(
      'first_name', case when u.extras ? 'first_name' then null else nullif(split_part(n.nom, ' ', 1), '') end,
      'last_name',  case when u.extras ? 'last_name'  then null else nullif(btrim(substr(n.nom, length(split_part(n.nom, ' ', 1)) + 1)), '') end))
from (
  select user_id, btrim(coalesce(nullif(btrim(extras->>'full_name'), ''), nullif(btrim(display_name), ''), '')) as nom
  from public.user_profiles
) n
where n.user_id = u.user_id
  and n.nom <> ''
  and (not (u.extras ? 'first_name') or not (u.extras ? 'last_name'));

-- 2. Doublon de l'identifiant d'athlète Strava
alter table public.user_profiles drop column if exists strava_athlete_id;

-- 3. Anciennes tables sans lecteur
drop table if exists public.preferences;
drop table if exists public.od_prefs;
drop table if exists public.garmin_sync_requests;
