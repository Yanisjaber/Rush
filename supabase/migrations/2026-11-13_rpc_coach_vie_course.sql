-- ============================================================
-- rpc_coach_vie_course : toute la vie de coureur du compte, pas seulement les 8 dernières semaines (décision de Yanis, 11 nov.).
-- Le coach doit connaître l'athlète « sur le bout des doigts », même sans sortie depuis un an : années, pic, plus longue sortie, arrêts,
-- meilleur effort de chaque année, charge maximale, et (selon les accords de partage) poids et sommeil par année.
--   - lecture seule, security invoker (la RLS s'applique), uniquement des nombres et des dates : AUCUN texte libre ne sort ;
--   - poids : catégorie « corps » ; sommeil : catégorie « appareil » (sinon absents) ;
--   - VO2max : seulement la valeur actuelle saisie dans le profil (aucun historique n'existe en base).
-- Relançable sans risque. Test local : bash supabase/tests/sql/coach_vie_course.sh
-- ============================================================
create or replace function public.rpc_coach_vie_course(p_date date default current_date, p_sante text[] default '{}')
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok text[] := coalesce(p_sante, '{}');
  v_res jsonb;
  v_corps jsonb := null;
  v_sommeil jsonb := null;
begin
  if v_uid is null then
    return null;
  end if;

  with c as (
    select start_date_local::date as d, distance_km::numeric as km, moving_time::numeric as t
    from activities
    where user_id = v_uid and merged_into is null and public.coach_famille_sport(sport) = 'course'
      and distance_km >= 1 and moving_time >= 300 and start_date_local::date <= p_date
  ),
  an as (
    select extract(year from d)::int as annee, count(*) as sorties, round(sum(km), 0) as km, round(sum(t) / 3600.0, 1) as heures,
           count(distinct date_trunc('week', d)) as semaines_actives
    from c group by 1
  ),
  sem as (
    select date_trunc('week', d)::date as du, count(*) as sorties, round(sum(km), 1) as km, round(sum(t) / 60.0) as minutes
    from c group by 1
  ),
  jours as (select distinct d from c),
  trous as (
    select prev + 1 as du, d - 1 as au, d - prev - 1 as jours
    from (select d, lag(d) over (order by d) as prev from jours) x
    where prev is not null and d - prev > 42
  ),
  effort as (
    select d, km, t, t * power(10 / km, 1.06) as equiv10 from c where km >= 4.8
  ),
  -- Meilleur temps réel sur 5 km (4,8 à 6), 10 km (9,5 à 11) et semi (20 à 22,5), sur les 24 derniers mois : de quoi lire si c'est la vitesse ou l'endurance qui limite
  par_dist as (
    select distinct on (cat) cat, d, km, t from (
      select case when km >= 4.8 and km < 6 then 5 when km >= 9.5 and km < 11 then 10 when km >= 20 and km < 22.5 then 21 end as cat, d, km, t
      from c where d > p_date - 730
    ) x where cat is not null order by cat, t * (case when cat = 5 then 5 / km when cat = 10 then 10 / km else 21.0975 / km end)
  ),
  meilleur_an as (
    select distinct on (extract(year from d)) extract(year from d)::int as annee, d, km, t, equiv10
    from effort order by extract(year from d), equiv10
  )
  select jsonb_build_object(
    'premiere_sortie', (select min(d) from c),
    'derniere_sortie', (select max(d) from c),
    'jours_depuis_derniere', (select p_date - max(d) from c),
    'sorties', (select count(*) from c),
    'km_total', (select coalesce(round(sum(km), 0), 0) from c),
    'heures_total', (select coalesce(round(sum(t) / 3600.0, 0), 0) from c),
    'annees', (select coalesce(jsonb_agg(jsonb_build_object('annee', annee, 'sorties', sorties, 'km', km, 'heures', heures, 'semaines_actives', semaines_actives) order by annee), '[]'::jsonb) from an),
    'plus_grosse_semaine', (select jsonb_build_object('du', du, 'sorties', sorties, 'km', km, 'minutes', minutes) from sem order by minutes desc, du desc limit 1),
    'plus_longue_sortie', (select jsonb_build_object('date', d, 'km', round(km, 1), 'minutes', round(t / 60.0)) from c order by t desc limit 1),
    'arrets', (select coalesce(jsonb_agg(jsonb_build_object('du', du, 'au', au, 'jours', jours) order by du), '[]'::jsonb) from (select * from trous order by du desc limit 12) z),
    'meilleur_effort_vie', (select jsonb_build_object('date', d, 'km', round(km, 2), 'secondes', round(t), 'equiv_10km_secondes', round(equiv10)) from effort order by equiv10 limit 1),
    'meilleurs_par_distance', (select coalesce(jsonb_agg(jsonb_build_object('distance_km', case when cat = 21 then 21.1 else cat end, 'date', d, 'km', round(km, 2), 'secondes', round(t)) order by cat), '[]'::jsonb) from par_dist),
    'meilleur_effort_par_annee', (select coalesce(jsonb_agg(jsonb_build_object('annee', annee, 'date', d, 'km', round(km, 2), 'secondes', round(t), 'equiv_10km_secondes', round(equiv10)) order by annee), '[]'::jsonb) from meilleur_an)
  ) into v_res;

  -- Charge chronique maximale de toute la vie (tous sports) et sa date
  v_res := v_res || jsonb_build_object('ctl_max', (
    select jsonb_build_object('date', iso_date, 'ctl', round(ctl::numeric, 1)) from daily_metrics
    where user_id = v_uid and iso_date <= p_date and ctl is not null order by ctl desc limit 1));

  -- VO2max : seulement la valeur actuelle du profil (pas d'historique en base)
  v_res := v_res || jsonb_build_object('vo2max_course_profil', (
    select case when (extras ->> 'vo2max_run') ~ '^[0-9]{2}(\.[0-9]+)?$' then (extras ->> 'vo2max_run')::numeric end from user_profiles where user_id = v_uid));

  -- Poids par année (catégorie « corps » autorisée)
  if 'corps' = any (v_ok) then
    select coalesce(jsonb_agg(jsonb_build_object('annee', annee, 'mesures', n, 'moyenne_kg', moy, 'min_kg', mini, 'max_kg', maxi) order by annee), '[]'::jsonb) into v_corps
    from (select extract(year from date)::int as annee, count(*) as n, round(avg(value)::numeric, 1) as moy, round(min(value)::numeric, 1) as mini, round(max(value)::numeric, 1) as maxi
          from health_metrics where user_id = v_uid and metric = 'poids_kg' and date <= p_date group by 1) p;
  end if;
  v_res := v_res || jsonb_build_object('poids_par_annee', v_corps);

  -- Sommeil par année (catégorie « appareil » autorisée)
  if 'appareil' = any (v_ok) then
    select coalesce(jsonb_agg(jsonb_build_object('annee', annee, 'nuits', n, 'duree_moyenne_h', h, 'score_moyen', sc, 'fc_repos_moyenne', fc, 'hrv_moyenne', hrv) order by annee), '[]'::jsonb) into v_sommeil
    from (select extract(year from date)::int as annee, count(*) as n, round((avg(total_sec) / 3600.0)::numeric, 1) as h, round(avg(score)::numeric) as sc,
                 round(avg(resting_heart_rate)::numeric) as fc, round(avg(hrv_avg)::numeric) as hrv
          from garmin_sleep where user_id = v_uid and date <= p_date and total_sec > 0 group by 1) s;
  end if;
  v_res := v_res || jsonb_build_object('sommeil_par_annee', v_sommeil);

  return v_res;
end;
$$;

revoke all on function public.rpc_coach_vie_course(date, text[]) from public, anon;
grant execute on function public.rpc_coach_vie_course(date, text[]) to authenticated;
