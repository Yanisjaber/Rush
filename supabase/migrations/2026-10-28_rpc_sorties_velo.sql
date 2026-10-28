-- ============================================================
-- Les sorties à vélo avec les colonnes des records (Bilan › Records) : la meilleure puissance moyenne sur 5 s, 1 min, 5 min,
-- 20 min et 1 h (lue dans `power_curve`), l'énergie et le dénivelé. (Pas de vitesse max : elle contient des pointes GPS impossibles et n'est pas affichée.)
--
-- Pourquoi une fonction : `power_curve` est un objet JSON avec une clé par durée (des milliers par séance). L'envoyer en entier pour
-- toutes les séances serait énorme ; la fonction n'en renvoie que cinq valeurs par séance.
--
-- Qui peut lire : seulement le compte connecté, et seulement ses séances (`security invoker` : la RLS de `activities` s'applique,
-- et le filtre `user_id = auth.uid()` est écrit en plus). Aucun accès `anon`. Les étapes fusionnées d'un triathlon (`merged_into`) sont écartées,
-- les vélos électriques aussi (leur puissance n'est pas celle du cycliste).
-- Relançable sans risque.
-- ============================================================

-- Le type de retour change (colonne en moins) : on supprime l'ancienne version d'abord (aucune dépendance, elle n'est appelée que par l'app)
drop function if exists public.rpc_sorties_velo();

create or replace function public.rpc_sorties_velo()
returns table (
  id uuid,
  name text,
  sport text,
  start_date_local timestamptz,
  distance_km numeric,
  moving_time integer,
  total_elevation_gain integer,
  kj integer,
  p5 integer,
  p60 integer,
  p300 integer,
  p1200 integer,
  p3600 integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.name, a.sport, a.start_date_local, a.distance_km, a.moving_time, a.total_elevation_gain, a.kj,
    round((a.power_curve ->> '5')::numeric)::integer,
    round((a.power_curve ->> '60')::numeric)::integer,
    round((a.power_curve ->> '300')::numeric)::integer,
    round((a.power_curve ->> '1200')::numeric)::integer,
    round((a.power_curve ->> '3600')::numeric)::integer
  from public.activities a
  where a.user_id = auth.uid()
    and a.merged_into is null
    and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
  order by a.start_date_local, a.id;
$$;

revoke all on function public.rpc_sorties_velo() from public, anon;
grant execute on function public.rpc_sorties_velo() to authenticated;
