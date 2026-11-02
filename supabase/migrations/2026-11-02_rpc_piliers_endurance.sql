-- ============================================================
-- rpc_piliers_annuels rend en plus de quoi noter l'ENDURANCE (le pilier change de sens : voir docs/native/PROGRESSION_NIVEAU.md) :
--  - w7200, w10800 : les meilleures puissances sur 2 h et 3 h de l'année (clés 7200 et 10800 de power_curve, déjà calculées) ;
--  - derive_med, n_derive : la médiane de la dérive cardiaque des sorties de 2 h et plus (clé `derive` de power_curve, en %, calculée par
--    strava-streams : voir supabase/functions/_shared/derive.ts) et le nombre de sorties qui en ont une ;
--  - heures_longues : les heures passées dans des sorties de 2 h et plus (toutes les sorties vélo, capteur de puissance ou non).
-- L'ancien pilier « Endurance » (watts à cardio égal) devient la « Forme » : il est calculé côté application, rien ne change ici pour lui.
-- Le reste est identique à 2026-11-02_rpc_piliers_n_courbes.sql (même sécurité : `security invoker`, `user_id = auth.uid()`, aucun accès `anon`).
-- Colonnes ajoutées à la fin : une ancienne version de l'app les ignore. Relançable sans risque.
-- ============================================================

drop function if exists public.rpc_piliers_annuels();

create or replace function public.rpc_piliers_annuels()
returns table (
  an integer,
  w5 integer,
  w300 integer,
  w1200 integer,
  w3600 integer,
  late300 integer,
  late1200 integer,
  n_longues integer,
  rep_ratio numeric,
  rep_n integer,
  ctl_max numeric,
  n_courbes integer,
  w7200 integer,
  w10800 integer,
  derive_med numeric,
  n_derive integer,
  heures_longues numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with sorties as (
    select extract(year from a.start_date_local)::integer as an, a.power_curve as pc
    from public.activities a
    where a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and a.power_curve is not null
  ),
  meilleurs as (
    select s.an,
           max((s.pc ->> '5')::numeric) as w5,
           max((s.pc ->> '300')::numeric) as w300,
           max((s.pc ->> '1200')::numeric) as w1200,
           max((s.pc ->> '3600')::numeric) as w3600,
           max((s.pc ->> 'late_300')::numeric) as late300,
           max((s.pc ->> 'late_1200')::numeric) as late1200,
           count(*) filter (where s.pc ? 'late_300' or s.pc ? 'late_1200') as n_longues,
           count(*) filter (where s.pc ?| array['5', '300', '1200', '3600']) as n_courbes,
           max((s.pc ->> '7200')::numeric) as w7200,
           max((s.pc ->> '10800')::numeric) as w10800,
           percentile_cont(0.5) within group (order by (s.pc ->> 'derive')::numeric) filter (where s.pc ? 'derive') as derive_med,
           count(*) filter (where s.pc ? 'derive') as n_derive
    from sorties s
    group by s.an
  ),
  repet as (
    select r.an,
           percentile_cont(0.5) within group (order by r.ratio) as rep_ratio,
           count(*) as rep_n
    from (
      select s.an, (s.pc ->> 'rep_3')::numeric / nullif((s.pc ->> 'rep_1')::numeric, 0) as ratio, (s.pc ->> 'rep_3')::numeric as rep_3
      from sorties s
      where s.pc ? 'rep_3' and s.pc ? 'rep_1'
    ) r
    join meilleurs m on m.an = r.an
    where r.ratio is not null and r.rep_3 >= 0.75 * m.w300
    group by r.an
  ),
  longues as (
    -- les heures en sorties de 2 h et plus, avec ou sans capteur de puissance (le volume ne demande que la durée)
    select extract(year from a.start_date_local)::integer as an, sum(a.moving_time) / 3600.0 as heures
    from public.activities a
    where a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and a.moving_time >= 7200
    group by 1
  ),
  charge as (
    select extract(year from d.iso_date)::integer as an, max(d.ctl) as ctl_max
    from public.daily_metrics d
    where d.user_id = auth.uid()
    group by 1
  )
  -- toutes les années qui ont des courbes, de la charge OU des sorties longues (un compte sans capteur de puissance a quand même sa capacité de charge et son volume)
  select a.an,
         round(m.w5)::integer, round(m.w300)::integer, round(m.w1200)::integer, round(m.w3600)::integer,
         round(m.late300)::integer, round(m.late1200)::integer, coalesce(m.n_longues, 0)::integer,
         round(r.rep_ratio::numeric, 3), coalesce(r.rep_n, 0)::integer,
         round(c.ctl_max, 1),
         coalesce(m.n_courbes, 0)::integer,
         round(m.w7200)::integer, round(m.w10800)::integer,
         round(m.derive_med::numeric, 1), coalesce(m.n_derive, 0)::integer,
         round(coalesce(l.heures, 0)::numeric, 1)
  from (select an from meilleurs union select an from charge union select an from longues) a
  left join meilleurs m on m.an = a.an
  left join repet r on r.an = a.an
  left join charge c on c.an = a.an
  left join longues l on l.an = a.an
  order by a.an;
$$;

revoke all on function public.rpc_piliers_annuels() from public, anon;
grant execute on function public.rpc_piliers_annuels() to authenticated;
