-- ============================================================
-- Température moyenne et type de séance Strava (11/11/2026).
-- avg_temp : °C moyens mesurés par l'appareil (Garmin…), vide sans capteur.
-- workout_type : le type choisi dans Strava (course : 1 = compétition, 2 = sortie longue, 3 = entraînement ; vélo : 11 = compétition, 12 = entraînement),
-- vide quand il n'a pas été choisi. Permet de retrouver les anciennes compétitions.
-- Codes vus sur le vrai compte : 0, 1, 2, 3 (course), 10, 11, 12 (vélo), 30 (muscu).
-- Aucune nouvelle table : la RLS de `activities` (user_id = auth.uid()) couvre déjà ces colonnes. Relançable sans risque.
-- ============================================================
alter table public.activities add column if not exists avg_temp smallint;
alter table public.activities add column if not exists workout_type smallint;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'activities_avg_temp_plausible') then
    alter table public.activities add constraint activities_avg_temp_plausible check (avg_temp is null or avg_temp between -60 and 70);
  end if;
  -- Strava utilise aussi des codes plus grands (30 pour une séance de muscu, par exemple) : on borne large
  alter table public.activities drop constraint if exists activities_workout_type_plausible;
  alter table public.activities add constraint activities_workout_type_plausible check (workout_type is null or workout_type between 0 and 100);
end $$;
