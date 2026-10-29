-- ============================================================
-- Le podium d'une durée (Bilan › Records › Cyclisme) : jusqu'à 30 séances au lieu de 3.
-- Les deux fonctions de courbe (puissance et autres signaux) prennent deux paramètres de plus :
--   p_duree : une seule durée en secondes (le podium de la durée touchée) ; sans lui, toutes les durées comme avant ;
--   p_n     : le nombre de séances par durée (3 par défaut, de 1 à 100).
-- Pourquoi : la courbe n'a besoin que des meilleures séances (3 lignes par durée suffisent, 44 durées) ; les 30 séances d'une durée ne se demandent
-- qu'une fois la durée touchée, pour ne pas envoyer 1 300 lignes à chaque ouverture de l'écran.
--
-- Même droits qu'avant : seulement le compte connecté et ses séances (`security invoker` + `user_id = auth.uid()`), aucun accès `anon`.
-- Les anciennes signatures sont supprimées (aucune dépendance : seule l'app les appelle). Relançable sans risque.
-- ============================================================

drop function if exists public.rpc_courbe_puissance(date, date);
drop function if exists public.rpc_courbe_signal(text, date, date);

create or replace function public.rpc_courbe_puissance(p_debut date default null, p_fin date default null, p_duree integer default null, p_n integer default 3)
returns table (
  duree_s integer,
  rang integer,
  watts integer,
  activity_id uuid,
  name text,
  start_date_local timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with durees(d) as (
    select unnest(case when p_duree is not null then array[p_duree]
      else array[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 120, 150, 180, 240, 300, 360, 420, 480, 600, 720, 900,
                 1080, 1200, 1500, 1800, 2400, 3000, 3600, 4500, 5400, 7200, 9000, 10800, 14400, 18000] end)
  ),
  valeurs as (
    select d.d as duree_s, a.id, a.name, a.start_date_local,
           round((a.power_curve ->> d.d::text)::numeric)::integer as watts
    from durees d
    cross join public.activities a
    where a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and a.power_curve is not null
      and (p_debut is null or a.start_date_local >= p_debut::timestamptz)
      and (p_fin is null or a.start_date_local < (p_fin + 1)::timestamptz)
  ),
  classees as (
    select v.*, row_number() over (partition by v.duree_s order by v.watts desc, v.start_date_local, v.id) as rang
    from valeurs v
    where v.watts is not null and v.watts > 0
  )
  select c.duree_s, c.rang::integer, c.watts, c.id, c.name, c.start_date_local
  from classees c
  where c.rang <= least(greatest(coalesce(p_n, 3), 1), 100)
  order by c.duree_s, c.rang;
$$;

create or replace function public.rpc_courbe_signal(p_signal text, p_debut date default null, p_fin date default null, p_duree integer default null, p_n integer default 3)
returns table (
  duree_s integer,
  rang integer,
  valeur numeric,
  activity_id uuid,
  name text,
  start_date_local timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with valeurs as (
    select e.key::integer as duree_s, a.id, a.name, a.start_date_local, e.value::numeric as valeur
    from public.activities a
    cross join lateral jsonb_each_text(a.signal_curves -> p_signal) e
    where p_signal in ('fc', 'cad', 'cou', 'vit', 'vam', 'des')
      and a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and (p_signal in ('fc', 'cad', 'cou') or a.sport <> 'VirtualRide')
      and a.signal_curves is not null
      and jsonb_typeof(a.signal_curves -> p_signal) = 'object'
      and e.key ~ '^[0-9]+$'
      and (p_duree is null or e.key::integer = p_duree)
      and (p_debut is null or a.start_date_local >= p_debut::timestamptz)
      and (p_fin is null or a.start_date_local < (p_fin + 1)::timestamptz)
  ),
  classees as (
    select v.*, row_number() over (partition by v.duree_s order by v.valeur desc, v.start_date_local, v.id) as rang
    from valeurs v
    where v.valeur > 0
  )
  select c.duree_s, c.rang::integer, c.valeur, c.id, c.name, c.start_date_local
  from classees c
  where c.rang <= least(greatest(coalesce(p_n, 3), 1), 100)
  order by c.duree_s, c.rang;
$$;

revoke all on function public.rpc_courbe_puissance(date, date, integer, integer) from public, anon;
grant execute on function public.rpc_courbe_puissance(date, date, integer, integer) to authenticated;
revoke all on function public.rpc_courbe_signal(text, date, date, integer, integer) from public, anon;
grant execute on function public.rpc_courbe_signal(text, date, date, integer, integer) to authenticated;
