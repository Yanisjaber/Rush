-- ============================================================
-- Endurance : nouvelle formule du pilier (Yanis, 3 nov. 2026) : trois mesures par année au lieu de « 2 h / 3 h + dérive + volume ».
--   D (poids 20 %) : durabilité = meilleur 20 min APRÈS fatigue (30 kJ/kg de travail cumulé, clé `fat20`) ÷ meilleur 20 min frais (clé `1200`) ;
--   R (poids 35 %) : longue durée = meilleur 2 h 30 (clé `9000`) ÷ FTP de l'année (95 % du meilleur 20 min de l'année) ;
--   C (poids 45 %) : découplage cardiaque (clé `drift`, puissance normalisée / FC, 1re contre 2e moitié) sur les sorties de plus de 2 h.
-- Le calcul des notes est dans l'app (native/src/data/bilan/piliers-niveau.ts) ; la base rend les mesures :
--   w9000, fat20 (meilleur de l'année), n_fat (sorties qui ont un `fat20`), drift_med (médiane du découplage des 10 sorties de plus de 2 h à la plus haute
--   puissance normalisée de l'année), n_drift (combien de sorties ont compté). Pas de filtre Z2 (Yanis, 3 nov. 2026).
-- Le volume des sorties longues et les meilleurs 2 h / 3 h (w7200, w10800, heures_longues, derive_med) ne sont plus rendus.
-- Les clés `fat20` et `drift` sont écrites par la fonction strava-streams (version des courbes 8) : tant qu'une sortie n'est pas recalculée, elle n'en a pas.
--
-- Même fonction que 2026-11-02_repetabilite_hauteur.sql pour tout le reste (sorties valides, répétabilité, durabilité, charge) ; le type rendu change : l'ancienne fonction
-- est supprimée puis recréée. Même sécurité : `security invoker`, `user_id = auth.uid()`, aucun accès `anon`. Relançable sans risque.
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
  w9000 integer,
  fat20 integer,
  n_fat integer,
  drift_med numeric,
  n_drift integer
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
           max((s.pc ->> '9000')::numeric) as w9000,
           max((s.pc ->> 'fat20')::numeric) as fat20,
           count(*) filter (where s.pc ? 'fat20') as n_fat
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
           percentile_cont(0.5) within group (order by r.rep_3) as rep_w3,
           count(*) as rep_n
    from (
      select s.an, (s.pc ->> 'rep_3')::numeric / nullif((s.pc ->> 'rep_1')::numeric, 0) as ratio, (s.pc ->> 'rep_3')::numeric as rep_3
      from sorties s
      where s.pc ? 'rep_3' and s.pc ? 'rep_1'
    ) r
    cross join meilleur_5min b
    where r.ratio is not null and r.rep_3 >= 0.5 * b.w300
    group by r.an
  ),
  decouplage as (
    -- le découplage des sorties de plus de 2 h : on garde, pour chaque année, les 10 sorties à la plus haute puissance normalisée (les plus appuyées), puis la médiane
    select z.an,
           percentile_cont(0.5) within group (order by z.drift) as drift_med,
           count(*) as n_drift
    from (
      select s.an,
             (s.pc ->> 'drift')::numeric as drift,
             row_number() over (partition by s.an order by s.watts_sortie desc, s.jour desc) as rang
      from sorties s
      where s.pc ? 'drift'
        and s.duree >= 7200
        and s.watts_sortie > 0
    ) z
    where z.rang <= 10
    group by z.an
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
         coalesce(m.n_courbes, 0)::integer,
         round(r.rep_w3::numeric)::integer,
         round(m.w9000)::integer,
         round(m.fat20)::integer, coalesce(m.n_fat, 0)::integer,
         round(d.drift_med::numeric, 1), coalesce(d.n_drift, 0)::integer
  from (select an from meilleurs union select an from charge) a
  left join meilleurs m on m.an = a.an
  left join repet r on r.an = a.an
  left join decouplage d on d.an = a.an
  left join charge c on c.an = a.an
  order by a.an;
$$;

revoke all on function public.rpc_piliers_annuels() from public, anon;
grant execute on function public.rpc_piliers_annuels() to authenticated;
