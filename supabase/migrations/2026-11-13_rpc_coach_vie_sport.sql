-- ============================================================
-- rpc_coach_vie_sport : toute la vie d'un athlète dans UN sport (vélo ou natation), pas seulement les 28 derniers jours.
-- Même principe que rpc_coach_vie_course (décision de Yanis, 11 nov.) : le coach connaît la personne à fond, même sans séance depuis un an.
--   - lecture seule, security invoker (la RLS s'applique), uniquement des nombres et des dates : AUCUN texte libre ne sort ;
--   - vélo : meilleures puissances 5 s / 5 min / 20 min / 1 h par année et sur les 24 derniers mois (courbes de puissance, séances à capteur non écartées) ;
--   - natation : meilleure allure au 100 m des séances courtes (0,4 à 0,9 km) et longues (1,5 km et plus), par année et sur 24 mois (allure de SÉANCE, repos compris) ;
--   - un sport hors liste ne donne rien (liste vide, jamais d'erreur qui révèle quelque chose).
-- Relançable sans risque. Test local : bash supabase/tests/sql/coach_vie_sport.sh
-- ============================================================
create or replace function public.rpc_coach_vie_sport(p_sport text, p_date date default current_date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
  v_records jsonb := '{}'::jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  if p_sport is null or p_sport not in ('velo', 'natation') then
    return '{}'::jsonb;
  end if;

  with c as (
    select start_date_local::date as d, distance_km::numeric as km, moving_time::numeric as t
    from activities
    where user_id = v_uid and merged_into is null and public.coach_famille_sport(sport) = p_sport
      and moving_time >= 300 and start_date_local::date <= p_date
  ),
  an as (
    select extract(year from d)::int as annee, count(*) as sorties, round(sum(t) / 3600.0, 1) as heures, coalesce(round(sum(km), 0), 0) as km,
           count(distinct date_trunc('week', d)) as semaines_actives
    from c group by 1
  ),
  sem as (
    select date_trunc('week', d)::date as du, count(*) as sorties, round(sum(t) / 60.0) as minutes
    from c group by 1
  ),
  jours as (select distinct d from c),
  trous as (
    select prev + 1 as du, d - 1 as au, d - prev - 1 as jours
    from (select d, lag(d) over (order by d) as prev from jours) x
    where prev is not null and d - prev > 42
  ),
  rec as (select * from c where d > p_date - 90)
  select jsonb_build_object(
    'sport', p_sport,
    'premiere_sortie', (select min(d) from c),
    'derniere_sortie', (select max(d) from c),
    'jours_depuis_derniere', (select p_date - max(d) from c),
    'sorties', (select count(*) from c),
    'heures_total', (select coalesce(round(sum(t) / 3600.0, 0), 0) from c),
    'annees', (select coalesce(jsonb_agg(jsonb_build_object('annee', annee, 'sorties', sorties, 'heures', heures, 'km', km, 'semaines_actives', semaines_actives) order by annee), '[]'::jsonb) from an),
    'plus_grosse_semaine', (select jsonb_build_object('du', du, 'sorties', sorties, 'minutes', minutes) from sem order by minutes desc, du desc limit 1),
    'plus_longue_sortie', (select jsonb_build_object('date', d, 'minutes', round(t / 60.0), 'km', round(km, 1)) from c order by t desc limit 1),
    'arrets', (select coalesce(jsonb_agg(jsonb_build_object('du', du, 'au', au, 'jours', jours) order by du), '[]'::jsonb) from (select * from trous order by du desc limit 12) z),
    'recent_90_jours', (select jsonb_build_object('sorties', count(*), 'minutes', coalesce(round(sum(t) / 60.0), 0), 'plus_longue_minutes', coalesce(round(max(t) / 60.0), 0)) from rec)
  ) into v_res;

  if p_sport = 'velo' then
    -- Puissances des courbes (clés '5', '300', '1200', '3600' en secondes), séances dont la puissance n'est pas écartée
    select jsonb_build_object(
      'par_annee', coalesce((select jsonb_agg(jsonb_build_object('annee', an, 'w5', w5, 'w300', w300, 'w1200', w1200, 'w3600', w3600, 'courbes', n) order by an)
                              from (select extract(year from start_date_local)::int as an, max((power_curve ->> '5')::numeric) as w5, max((power_curve ->> '300')::numeric) as w300,
                                           max((power_curve ->> '1200')::numeric) as w1200, max((power_curve ->> '3600')::numeric) as w3600, count(*) as n
                                    from activities
                                    where user_id = v_uid and merged_into is null and power_curve is not null and not coalesce(excl_power, false)
                                      and public.coach_famille_sport(sport) = 'velo' and start_date_local::date <= p_date
                                    group by 1) y), '[]'::jsonb),
      'recent_24_mois', (select jsonb_build_object('w5', max((power_curve ->> '5')::numeric), 'w300', max((power_curve ->> '300')::numeric),
                                                   'w1200', max((power_curve ->> '1200')::numeric), 'w3600', max((power_curve ->> '3600')::numeric), 'courbes', count(*))
                         from activities
                         where user_id = v_uid and merged_into is null and power_curve is not null and not coalesce(excl_power, false)
                           and public.coach_famille_sport(sport) = 'velo' and start_date_local::date <= p_date and start_date_local::date > p_date - 730)
    ) into v_records;
  else
    -- Allure de séance au 100 m (secondes), séances courtes (0,4 à 0,9 km) et longues (1,5 km et plus)
    select jsonb_build_object(
      'par_annee', coalesce((select jsonb_agg(jsonb_build_object('annee', an, 'court_s100', court, 'long_s100', lg) order by an)
                              from (select extract(year from start_date_local)::int as an,
                                           round(min(case when distance_km >= 0.4 and distance_km < 0.9 then moving_time / (distance_km * 10) end)::numeric, 1) as court,
                                           round(min(case when distance_km >= 1.5 then moving_time / (distance_km * 10) end)::numeric, 1) as lg
                                    from activities
                                    where user_id = v_uid and merged_into is null and public.coach_famille_sport(sport) = 'natation'
                                      and moving_time >= 300 and distance_km > 0 and start_date_local::date <= p_date
                                    group by 1) y), '[]'::jsonb),
      'recent_24_mois', (select jsonb_build_object(
                           'court_s100', round(min(case when distance_km >= 0.4 and distance_km < 0.9 then moving_time / (distance_km * 10) end)::numeric, 1),
                           'long_s100', round(min(case when distance_km >= 1.5 then moving_time / (distance_km * 10) end)::numeric, 1),
                           'date_court', (array_agg(start_date_local::date order by moving_time / (distance_km * 10)) filter (where distance_km >= 0.4 and distance_km < 0.9))[1],
                           'date_long', (array_agg(start_date_local::date order by moving_time / (distance_km * 10)) filter (where distance_km >= 1.5))[1])
                         from activities
                         where user_id = v_uid and merged_into is null and public.coach_famille_sport(sport) = 'natation'
                           and moving_time >= 300 and distance_km > 0 and start_date_local::date <= p_date and start_date_local::date > p_date - 730)
    ) into v_records;
  end if;

  return v_res || jsonb_build_object('records', v_records);
end;
$$;

revoke all on function public.rpc_coach_vie_sport(text, date) from public, anon;
grant execute on function public.rpc_coach_vie_sport(text, date) to authenticated;
