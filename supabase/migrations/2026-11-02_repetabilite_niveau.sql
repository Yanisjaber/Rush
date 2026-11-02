-- ============================================================
-- Répétabilité : un « vrai effort » se compare à ton meilleur 5 minutes de TOUS LES TEMPS, plus à celui de l'année.
--
-- Avant : une sortie comptait si son 3e effort de 5 min valait au moins 75 % du meilleur 5 min de l'année. Une année où tu roulais très doucement
-- (84 W au mieux en 2017) validait donc des efforts à 80 W, et leur régularité donnait 83/100 : la note récompensait la facilité.
-- Maintenant : le 3e effort doit valoir au moins 75 % de ton meilleur 5 min de toujours (parmi les années où la puissance est fiable : 3 sorties
-- à capteur au moins, la même règle que la note de puissance, pour qu'un capteur qui a menti en une sortie ne fixe pas la barre).
-- Une année sans assez de vrais efforts n'a plus de note de répétabilité (« — »), au lieu d'une note flatteuse.
--
-- Même fonction que 2026-11-02_duree_ecartable.sql ; seul le bloc `repet` change (et le bloc `meilleur_5min` qui l'alimente).
-- Même sécurité : `security invoker`, `user_id = auth.uid()`, aucun accès `anon`. Relançable sans risque.
-- ============================================================

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
    select extract(year from a.start_date_local)::integer as an,
           case when coalesce(a.excl_hr, false) then a.power_curve - 'derive' else a.power_curve end as pc
    from public.activities a
    where a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and a.power_curve is not null
      and not coalesce(a.excl_power, false)
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
  meilleur_5min as (
    -- le meilleur 5 min de tous les temps, sur les années où la puissance est fiable (au moins 3 sorties à capteur)
    select max(m.w300) as w300 from meilleurs m where m.n_courbes >= 3
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
    cross join meilleur_5min b
    where r.ratio is not null and r.rep_3 >= 0.75 * b.w300
    group by r.an
  ),
  longues as (
    -- les heures en sorties de 2 h et plus, avec ou sans capteur de puissance (le volume ne demande que la durée) ; une durée écartée ne compte pas
    select extract(year from a.start_date_local)::integer as an, sum(a.moving_time) / 3600.0 as heures
    from public.activities a
    where a.user_id = auth.uid()
      and a.merged_into is null
      and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
      and a.moving_time >= 7200
      and not coalesce(a.excl_duration, false)
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
