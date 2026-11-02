-- ============================================================
-- Données écartées d'une activité (écran d'une activité › « Compte dans mes calculs »).
-- Une donnée écartée n'entre plus dans AUCUN calcul : forme, niveau global, records, charge d'entraînement, totaux.
-- Les chiffres restent en base et sur l'écran de l'activité (barrés) : on peut les remettre à tout moment.
--
-- Six drapeaux sur `activities` (vrai = écartée) :
--   excl_power     puissance : watts, NP, énergie, courbe de puissance, et la charge qui vient de la puissance        (existait)
--   excl_hr        cardio : cardio moyen, courbe de cardio, dérive, et la charge qui vient du cardio                  (existait)
--   excl_distance  distance : distance, vitesse, courbe de vitesse                                                    (existait)
--   excl_elevation dénivelé : D+, courbes de montée et de descente                                                    (nouveau)
--   excl_cadence   cadence : cadence moyenne, courbe de cadence et de couple                                          (nouveau)
--   excl_load      charge : la charge (TSS) de l'activité ne compte plus dans la forme/fatigue, quelle que soit son origine (nouveau)
--
-- Ce que cette migration change :
--  1. les deux colonnes nouvelles ;
--  2. `tss_retenu` : la charge qui compte vraiment pour une activité (0 si elle vient d'une donnée écartée) ;
--  3. `recalc_daily_metrics` : la charge, la forme et la fatigue utilisent `tss_retenu` ;
--  4. `rpc_piliers_annuels`, `rpc_courbe_puissance`, `rpc_courbe_signal`, `rpc_sorties_velo` : ignorent ce qui est écarté.
-- Même sécurité qu'avant : seules les activités du compte connecté (`security invoker`, `user_id = auth.uid()`), aucun accès `anon`.
-- Relançable sans risque.
-- ============================================================

alter table public.activities add column if not exists excl_elevation boolean;
alter table public.activities add column if not exists excl_cadence boolean;
alter table public.activities add column if not exists excl_load boolean;

-- ---------- 1) La charge qui compte ----------
-- La charge (tss) d'une activité vient de la puissance si elle en a, sinon du cardio (TRIMP), sinon de l'effort ressenti × la durée.
-- Écarter la puissance retire donc la charge d'une activité qui en a ; écarter le cardio retire celle d'une activité sans puissance qui a du cardio.
-- (On ne peut pas la recalculer avec une autre source sans refaire tout le calcul : elle ne compte plus, c'est tout.)
create or replace function public.tss_retenu(
  p_tss numeric, p_np numeric, p_watts numeric, p_fc numeric,
  p_excl_power boolean, p_excl_hr boolean, p_excl_load boolean
)
returns numeric
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when coalesce(p_excl_load, false) then 0
    when coalesce(p_excl_power, false) and (coalesce(p_np, 0) > 0 or coalesce(p_watts, 0) > 0) then 0
    when coalesce(p_excl_hr, false) and not (coalesce(p_np, 0) > 0 or coalesce(p_watts, 0) > 0) and coalesce(p_fc, 0) > 0 then 0
    else coalesce(p_tss, 0)
  end;
$$;

revoke all on function public.tss_retenu(numeric, numeric, numeric, numeric, boolean, boolean, boolean) from public, anon;
grant execute on function public.tss_retenu(numeric, numeric, numeric, numeric, boolean, boolean, boolean) to authenticated;

-- ---------- 2) daily_metrics : la charge retenue ----------
-- Même fonction que 2026-10-27_daily_metrics_sans_etapes_fusionnees.sql ; seule la somme de la charge change.
create or replace function public.recalc_daily_metrics(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d_first date;
  d_last  date;
  r record;
  v_ctl numeric := 0;
  v_atl numeric := 0;
begin
  select min(start_date_local::date), max(start_date_local::date)
    into d_first, d_last
  from activities
  where user_id = p_user
    and merged_into is null  -- étapes fusionnées (triathlon) : déjà comptées via leur parent
    and start_date_local is not null
    and start_date_local::date >= date '2000-01-01';  -- ignore dates aberrantes (epoch 1970)

  -- Plus aucune activité : on vide les métriques de l'utilisateur.
  if d_first is null then
    delete from daily_metrics where user_id = p_user;
    return;
  end if;

  -- Purge des lignes hors plage (avant la 1re activité / après la dernière).
  delete from daily_metrics
  where user_id = p_user
    and (iso_date < d_first or iso_date > d_last);

  -- Série continue jour par jour + EWMA (même formule que strava-ingest).
  for r in
    with agg as (
      select start_date_local::date as iso,
             sum(public.tss_retenu(tss, np, avg_watts, avg_heartrate, excl_power, excl_hr, excl_load)) as tss,
             sum(round(coalesce(moving_time, elapsed_time, 0) / 60.0)) as dur,
             count(*) as cnt
      from activities
      where user_id = p_user
        and merged_into is null  -- idem : on ne compte pas deux fois un triathlon fusionné
        and start_date_local is not null
        and start_date_local::date >= date '2000-01-01'
      group by 1
    )
    select gs::date as iso,
           coalesce(a.tss, 0) as tss,
           coalesce(a.dur, 0) as dur,
           coalesce(a.cnt, 0) as cnt
    from generate_series(d_first, d_last, interval '1 day') gs
    left join agg a on a.iso = gs::date
    order by gs::date
  loop
    v_ctl := v_ctl + (r.tss - v_ctl) * 2 / 43.0;
    v_atl := v_atl + (r.tss - v_atl) * 2 / 8.0;
    insert into daily_metrics (user_id, iso_date, tss, ctl, atl, tsb, duration_min, activity_count)
    values (p_user, r.iso, round(r.tss), round(v_ctl, 1), round(v_atl, 1),
            round(v_ctl - v_atl, 1), r.dur, r.cnt)
    on conflict (user_id, iso_date) do update
      set tss            = excluded.tss,
          ctl            = excluded.ctl,
          atl            = excluded.atl,
          tsb            = excluded.tsb,
          duration_min   = excluded.duration_min,
          activity_count = excluded.activity_count;
  end loop;
end;
$$;

-- ---------- 3) Niveau global : les mesures annuelles sans les données écartées ----------
-- Même fonction que 2026-11-02_rpc_piliers_endurance.sql. Une sortie dont la puissance est écartée sort de toutes les mesures de puissance
-- (pointes, durabilité, répétabilité, 2 h / 3 h, dérive, nombre de sorties avec capteur) ; une sortie dont le cardio est écarté perd sa dérive.
-- Les heures de sorties longues ne dépendent que de la durée : elles restent. La capacité de charge suit `recalc_daily_metrics`.
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

-- ---------- 4) Records : la courbe de puissance et les autres courbes sans les données écartées ----------
-- Mêmes fonctions que 2026-10-29_podium_duree.sql.
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
      and not coalesce(a.excl_power, false)
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

-- Chaque courbe dépend de la donnée dont elle vient : cardio (fc), cadence (cad), couple (cou : puissance et cadence),
-- vitesse (vit : distance), montée et descente (vam, des : dénivelé).
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
      and not (p_signal = 'fc' and coalesce(a.excl_hr, false))
      and not (p_signal = 'cad' and coalesce(a.excl_cadence, false))
      and not (p_signal = 'cou' and (coalesce(a.excl_power, false) or coalesce(a.excl_cadence, false)))
      and not (p_signal = 'vit' and coalesce(a.excl_distance, false))
      and not (p_signal in ('vam', 'des') and coalesce(a.excl_elevation, false))
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

-- ---------- 5) Records basiques : les sorties à vélo, avec ce qui est écarté remplacé par « rien » ----------
-- Même fonction que 2026-10-28_rpc_sorties_velo.sql (mêmes colonnes) : une donnée écartée est renvoyée vide, elle ne peut donc plus faire de record.
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
  select a.id, a.name, a.sport, a.start_date_local,
         case when not coalesce(a.excl_distance, false) then a.distance_km end,
         a.moving_time,
         case when not coalesce(a.excl_elevation, false) then a.total_elevation_gain end,
         case when not coalesce(a.excl_power, false) then a.kj end,
         case when a.tss is null or public.tss_retenu(a.tss, a.np, a.avg_watts, a.avg_heartrate, a.excl_power, a.excl_hr, a.excl_load) = 0 then null
              else a.tss end,
         case when a.device_watts and not coalesce(a.excl_power, false) then a.avg_watts end,
         case when not coalesce(a.excl_hr, false) then a.avg_heartrate end
  from public.activities a
  where a.user_id = auth.uid()
    and a.merged_into is null
    and a.sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide')
  order by a.start_date_local, a.id;
$$;

revoke all on function public.rpc_sorties_velo() from public, anon;
grant execute on function public.rpc_sorties_velo() to authenticated;

-- ---------- 6) Recalcul de la charge des comptes qui ont déjà écarté quelque chose ----------
do $$
declare
  u uuid;
begin
  for u in
    select distinct user_id from public.activities
    where excl_power is true or excl_hr is true or excl_load is true
  loop
    perform public.recalc_daily_metrics(u);
  end loop;
end;
$$;
