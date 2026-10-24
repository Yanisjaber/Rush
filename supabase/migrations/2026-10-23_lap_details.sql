-- Les tours d'une activité importée depuis un fichier (FIT) : liste JSON [{index, name, elapsed_time, moving_time, distance}], distance en mètres, temps en secondes.
-- Les tours de Strava ne passent pas par là (la fonction strava-laps les lit chez Strava) ; la colonne `laps` (entier) reste le nombre de tours d'une compétition.
-- Idempotente. Aucune nouvelle table : la RLS existante de `activities` (auth.uid() = user_id) couvre la colonne.

alter table public.activities
  add column if not exists lap_details jsonb
    check (lap_details is null or (jsonb_typeof(lap_details) = 'array' and jsonb_array_length(lap_details) <= 5000));

comment on column public.activities.lap_details is
  'Tours importés d''un fichier FIT : [{index, name, elapsed_time, moving_time, distance}] (distance en m, temps en s). Null pour les activités Strava.';
