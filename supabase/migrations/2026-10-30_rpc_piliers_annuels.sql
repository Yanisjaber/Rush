-- ============================================================
-- Les mesures par année du niveau global de l'athlète (Bilan › Progrès › Cyclisme) : une ligne par année avec
--  - les meilleures puissances sur 5 s (sprint), 5 min, 20 min et 60 min (la puissance de pointe) ;
--  - la durabilité : la meilleure puissance sur 5 et 20 min APRÈS 2 h 30 de sortie (clés late_300 et late_1200 de power_curve) et le nombre de sorties longues ;
--  - la répétabilité : la médiane, sur les sorties de l'année qui ont trois vrais efforts durs, du rapport rep_3 / rep_1 (le 3e effort de 5 min contre le 1er, clés rep_1..3 de power_curve).
--    Un effort « dur » : le 3e effort fait au moins 75 % du meilleur 5 min de l'année (sinon la sortie n'a pas trois efforts, juste une sortie facile) ;
--  - la capacité de charge : la charge chronique (CTL) maximale de l'année, lue dans daily_metrics.
-- Le calcul de chaque note (0 à 100) se fait côté application : voir native/src/data/bilan/piliers-niveau.ts.
--
-- Qui peut lire : seulement le compte connecté, et seulement ses séances (`security invoker` : la RLS s'applique, et `user_id = auth.uid()` est écrit en plus).
-- Aucun accès `anon`. Mêmes sports que rpc_courbe_puissance (ni vélo électrique, ni étapes fusionnées). Relançable sans risque.
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
  ctl_max numeric
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
           count(*) filter (where s.pc ? 'late_300' or s.pc ? 'late_1200') as n_longues
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
  select m.an,
         round(m.w5)::integer, round(m.w300)::integer, round(m.w1200)::integer, round(m.w3600)::integer,
         round(m.late300)::integer, round(m.late1200)::integer, m.n_longues::integer,
         round(r.rep_ratio::numeric, 3), coalesce(r.rep_n, 0)::integer,
         round(c.ctl_max, 1)
  from meilleurs m
  left join repet r on r.an = m.an
  left join charge c on c.an = m.an
  order by m.an;
$$;

revoke all on function public.rpc_piliers_annuels() from public, anon;
grant execute on function public.rpc_piliers_annuels() to authenticated;
