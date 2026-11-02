-- ============================================================
-- Capacité de charge : la fonction rend aussi le VOLUME de l'année : les heures, les jours actifs et le nombre de jours couverts (Yanis, 3 nov. 2026).
--
-- Pourquoi : la charge ne regardait que le CTL moyen. À CTL égal, 220 jours actifs et 180 jours actifs avaient la même note, et ni les heures ni le nombre de sorties ne comptaient.
-- Maintenant l'app note la charge à 60 % sur le CTL moyen, 25 % sur les heures et 15 % sur les jours actifs (voir native/src/data/bilan/piliers-niveau.ts).
--   heures         : somme de `duration_min` de l'année, en heures (les durées écartées par l'utilisateur n'y sont déjà pas : voir recalc_daily_metrics) ;
--   jours_actifs   : les jours de l'année avec au moins une activité ;
--   jours_couverts : les jours de l'année qui ont une ligne dans daily_metrics (365 pour une année complète ; moins pour l'année en cours et la première année :
--                    la série va de la première sortie à aujourd'hui). L'app s'en sert pour ramener heures et jours actifs à une année complète.
--
-- Même fonction que 2026-11-03_charge_moyenne.sql pour tout le reste ; trois colonnes de plus à la fin (une ancienne version de l'app les ignore) : la fonction est supprimée
-- puis recréée. Même sécurité : `security invoker`, `user_id = auth.uid()`, aucun accès `anon`. Relançable sans risque.
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
  rep_w3 integer,
  fat20 integer,
  n_fat integer,
  drift_med numeric,
  n_drift integer,
  p_ref integer,
  fc_ref integer,
  n_fc integer,
  ctl_moy numeric,
  heures numeric,
  jours_actifs integer,
  jours_couverts integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with sorties as (
    select extract(year from a.start_date_local)::integer as an,
           a.start_date_local as jour,
           coalesce(a.np, a.avg_watts) as watts_sortie,
           -- la durée de la sortie (0 si l'utilisateur l'a écartée)
           case when coalesce(a.excl_duration, false) then 0 else coalesce(a.moving_time, 0) end as duree,
           -- la FC moyenne (rien si l'utilisateur a écarté le cardio)
           case when coalesce(a.excl_hr, false) then null else nullif(a.avg_heartrate, 0) end as fc,
           case when coalesce(a.excl_hr, false) then a.power_curve - 'drift' else a.power_curve end as pc
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
           max((s.pc ->> 'fat20')::numeric) as fat20,
           count(*) filter (where s.pc ? 'fat20') as n_fat
    from sorties s
    group by s.an
  ),
  meilleur_5min as (
    -- le meilleur 5 min de tous les temps, sur les années où la puissance est fiable (au moins 3 sorties à capteur)
    select max(m.w300) as w300 from meilleurs m where m.n_courbes >= 3
  ),
  reference as (
    -- la puissance de référence : 70 % de la FTP de toujours (95 % du meilleur 20 min de toujours)
    select 0.7 * 0.95 * coalesce(
             (select max(m.w1200) from meilleurs m where m.n_courbes >= 3),
             (select max(m.w1200) from meilleurs m where m.n_courbes > 0)
           ) as p_ref
  ),
  sorties_ref as (
    -- les sorties de plus de 2 h dont la puissance est à ±10 % de la référence
    select s.an, s.jour, s.fc, (s.pc ->> 'drift')::numeric as drift
    from sorties s
    cross join reference r
    where s.duree >= 7200
      and r.p_ref > 0
      and s.watts_sortie between 0.9 * r.p_ref and 1.1 * r.p_ref
  ),
  coeur as (
    select z.an, percentile_cont(0.5) within group (order by z.fc) as fc_ref, count(*) as n_fc
    from (
      select r.an, r.fc, row_number() over (partition by r.an order by r.jour desc) as rang
      from sorties_ref r where r.fc is not null
    ) z
    where z.rang <= 10
    group by z.an
  ),
  decouplage as (
    select z.an, percentile_cont(0.5) within group (order by z.drift) as drift_med, count(*) as n_drift
    from (
      select r.an, r.drift, row_number() over (partition by r.an order by r.jour desc) as rang
      from sorties_ref r where r.drift is not null
    ) z
    where z.rang <= 10
    group by z.an
  ),
  repet as (
    -- les sorties valides, classées par 3e effort (le plus fort d'abord) ; on garde les 10 premières de chaque année
    select r.an,
           percentile_cont(0.5) within group (order by r.ratio) as rep_ratio,
           percentile_cont(0.5) within group (order by r.rep_3) as rep_w3,
           count(*) as rep_n
    from (
      select v.an, v.ratio, v.rep_3, row_number() over (partition by v.an order by v.rep_3 desc, v.jour desc) as rang
      from (
        select s.an, s.jour, (s.pc ->> 'rep_3')::numeric / nullif((s.pc ->> 'rep_1')::numeric, 0) as ratio, (s.pc ->> 'rep_3')::numeric as rep_3
        from sorties s
        where s.pc ? 'rep_3' and s.pc ? 'rep_1'
      ) v
      cross join meilleur_5min b
      where v.ratio is not null and v.rep_3 >= 0.5 * b.w300
    ) r
    where r.rang <= 10
    group by r.an
  ),
  charge as (
    select extract(year from d.iso_date)::integer as an, max(d.ctl) as ctl_max, avg(d.ctl) as ctl_moy,
           sum(d.duration_min) / 60.0 as heures,
           count(*) filter (where d.activity_count > 0) as jours_actifs,
           count(*) as jours_couverts
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
         coalesce(m.n_courbes, 0)::integer,
         round(r.rep_w3::numeric)::integer,
         round(m.fat20)::integer, coalesce(m.n_fat, 0)::integer,
         round(d.drift_med::numeric, 1), coalesce(d.n_drift, 0)::integer,
         round(ref.p_ref)::integer,
         round(co.fc_ref::numeric)::integer, coalesce(co.n_fc, 0)::integer,
         round(c.ctl_moy, 1),
         round(c.heures, 1), coalesce(c.jours_actifs, 0)::integer, coalesce(c.jours_couverts, 0)::integer
  from (select an from meilleurs union select an from charge) a
  cross join reference ref
  left join meilleurs m on m.an = a.an
  left join repet r on r.an = a.an
  left join decouplage d on d.an = a.an
  left join coeur co on co.an = a.an
  left join charge c on c.an = a.an
  order by a.an;
$$;

revoke all on function public.rpc_piliers_annuels() from public, anon;
grant execute on function public.rpc_piliers_annuels() to authenticated;
