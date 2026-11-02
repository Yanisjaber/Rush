-- ============================================================
-- rpc_piliers_annuels rend en plus `n_courbes` : le nombre de sorties de l'année qui ont une courbe de puissance (un capteur).
-- Une courbe qui n'a qu'un marqueur de version ({"v": 6}, posé sur une sortie calculée sans capteur) ne compte pas.
-- Pourquoi : une année avec une seule sortie à capteur (souvent un capteur en panne : 1 W sur une heure) recevait une note de puissance,
-- et pouvait afficher un niveau global de 0. L'application ne note plus la puissance d'une année sous 3 sorties (native/src/data/bilan/piliers-niveau.ts).
-- Le reste est identique à 2026-10-30_rpc_piliers_annuels.sql (même sécurité : `security invoker`, `user_id = auth.uid()`, aucun accès `anon`).
-- La colonne est ajoutée à la fin : une ancienne version de l'app l'ignore. Relançable sans risque.
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
  n_courbes integer
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
           count(*) filter (where s.pc ?| array['5', '300', '1200', '3600']) as n_courbes
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
  charge as (
    select extract(year from d.iso_date)::integer as an, max(d.ctl) as ctl_max
    from public.daily_metrics d
    where d.user_id = auth.uid()
    group by 1
  )
  -- toutes les années qui ont des courbes OU de la charge (un compte sans capteur de puissance a quand même sa capacité de charge)
  select a.an,
         round(m.w5)::integer, round(m.w300)::integer, round(m.w1200)::integer, round(m.w3600)::integer,
         round(m.late300)::integer, round(m.late1200)::integer, coalesce(m.n_longues, 0)::integer,
         round(r.rep_ratio::numeric, 3), coalesce(r.rep_n, 0)::integer,
         round(c.ctl_max, 1),
         coalesce(m.n_courbes, 0)::integer
  from (select an from meilleurs union select an from charge) a
  left join meilleurs m on m.an = a.an
  left join repet r on r.an = a.an
  left join charge c on c.an = a.an
  order by a.an;
$$;

revoke all on function public.rpc_piliers_annuels() from public, anon;
grant execute on function public.rpc_piliers_annuels() to authenticated;
