-- ============================================================
-- Les sorties à vélo avec les colonnes des records basiques (Bilan › Records) : durée, distance, dénivelé, énergie, charge (TSS), puissance moyenne (seulement si elle est mesurée par un capteur : celle que Strava estime n'est pas renvoyée) et fréquence cardiaque moyenne.
-- La puissance par durée vient de rpc_courbe_puissance. Pas de vitesse max : elle contient des pointes GPS impossibles et n'est pas affichée.
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
  tss integer,
  avg_watts integer,
  avg_heartrate integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.name, a.sport, a.start_date_local, a.distance_km, a.moving_time, a.total_elevation_gain, a.kj, a.tss,
         case when a.device_watts then a.avg_watts end, a.avg_heartrate
  from public.activities a
  where a.user_id = auth.uid()
    and a.merged_into is null
    and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
  order by a.start_date_local, a.id;
$$;

revoke all on function public.rpc_sorties_velo() from public, anon;
grant execute on function public.rpc_sorties_velo() to authenticated;
