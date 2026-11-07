-- ============================================================
-- IA de Rush, étape 1 : le résumé JSON que lira le coach (6/11/2026).
--
-- Principe (docs/ia/CADRAGE_IA.md) : le modèle ne calcule pas, il lit des chiffres déjà calculés.
-- Cette fonction rassemble ces chiffres pour le compte connecté : forme (CTL/ATL/TSB), charge des 7 derniers jours
-- comparée à la semaine d'avant, volume par sport, les 14 derniers jours, les dernières séances, ce qui est prévu,
-- les périodes indisponibles (maladie, blessure), les jours de repos, les cycles, les objectifs, le ressenti, et un bloc
-- « qualite » qui dit honnêtement quand il y a peu de données.
--
-- Sécurité :
--   - security invoker : la RLS s'applique, et la fonction ne lit que auth.uid() (aucun identifiant en paramètre).
--     Sans connexion, elle renvoie null. Réservée aux comptes connectés (pas anon). Jamais de clé service_role.
--   - AUCUN texte venant de l'extérieur n'en sort : ni nom d'activité, ni description Strava, ni note libre, ni nom de cycle.
--     Le résumé ne contient que des nombres, des dates et des mots d'une liste fermée (le texte externe est le chemin
--     classique pour piéger un modèle).
--   - Les données de santé ne sortent que par catégorie autorisée : p_sante (liste vide par défaut = rien).
--     Catégories : ressenti, evenement, corps, nutrition, cycle, appareil (voir native/src/data/sante/sante-catalogue.ts).
--     L'Edge Function y mettra les catégories pour lesquelles l'utilisateur a donné son accord. Une mesure inconnue
--     du catalogue ne sort jamais.
--   - Le garde-fou « repos / voir un pro » (malade, blessé, charge qui explose) est une autre étape : il se calcule
--     dans le code, indépendamment de ces accords.
--
-- Relançable sans risque. À tester en local d'abord : bash supabase/tests/sql/coach_resume.sh
-- ============================================================

-- La famille de sport d'un type Strava brut (même regroupement que native/src/data/sports/familles.ts, pour l'endurance + muscu)
create or replace function public.coach_famille_sport(p_sport text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_sport in ('Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide') then 'velo'
    when p_sport in ('Run', 'TrailRun', 'VirtualRun') then 'course'
    when p_sport = 'Swim' then 'natation'
    when p_sport = 'WeightTraining' then 'muscu'
    else 'autre'
  end
$$;

-- La catégorie de santé d'une mesure (null = mesure inconnue : elle ne sort jamais)
create or replace function public.coach_categorie_sante(p_metric text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_metric like 'ressenti\_%' then 'ressenti'
    when p_metric like 'evt\_%' or p_metric = 'alcool_verres' then 'evenement'
    when p_metric in ('poids_kg', 'masse_grasse_pct', 'masse_musculaire_kg', 'tension_sys', 'tension_dia') then 'corps'
    when p_metric in ('calories_kcal', 'proteines_g', 'eau_l') then 'nutrition'
    when p_metric like 'cycle\_%' then 'cycle'
    when p_metric in ('resp_nuit', 'temp_cutanee_ecart', 'spo2_nuit') then 'appareil'
    else null
  end
$$;

create or replace function public.rpc_coach_resume(p_date date default current_date, p_sante text[] default '{}')
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_forme jsonb;
  v_ctl_avant numeric;
  v_tss7 numeric;
  v_tss7_prec numeric;
  v_tss28 numeric;
  v_actifs7 integer;
  v_actifs28 integer;
  v_seances28 integer;
  v_premier date;
  v_volume jsonb;
  v_jours jsonb;
  v_dernieres jsonb;
  v_prevues jsonb;
  v_competitions jsonb;
  v_indispo jsonb;
  v_repos jsonb;
  v_cycles jsonb;
  v_objectifs jsonb;
  v_sante jsonb;
  v_ressenti_jours integer;
  v_sante_ok text[] := coalesce(p_sante, '{}');
begin
  if v_uid is null then
    return null;
  end if;

  -- Forme du jour : la dernière ligne connue jusqu'à p_date, et le CTL 28 jours avant (pour la tendance)
  select jsonb_build_object('ctl', ctl, 'atl', atl, 'tsb', tsb, 'date', iso_date)
    into v_forme
  from daily_metrics
  where user_id = v_uid and iso_date <= p_date
  order by iso_date desc limit 1;

  select ctl into v_ctl_avant
  from daily_metrics
  where user_id = v_uid and iso_date <= p_date - 28
  order by iso_date desc limit 1;

  -- Charge : 7 jours (aujourd'hui compris), les 7 jours d'avant, et les 28 derniers jours
  select coalesce(sum(tss) filter (where iso_date > p_date - 7), 0),
         coalesce(sum(tss) filter (where iso_date > p_date - 14 and iso_date <= p_date - 7), 0),
         coalesce(sum(tss), 0),
         count(*) filter (where iso_date > p_date - 7 and activity_count > 0),
         count(*) filter (where activity_count > 0),
         coalesce(sum(activity_count), 0)
    into v_tss7, v_tss7_prec, v_tss28, v_actifs7, v_actifs28, v_seances28
  from daily_metrics
  where user_id = v_uid and iso_date > p_date - 28 and iso_date <= p_date;

  select min(iso_date) into v_premier from daily_metrics where user_id = v_uid;

  -- Volume par famille de sport (7 et 28 jours). Les étapes fusionnées d'un triathlon sont exclues, comme dans daily_metrics.
  select coalesce(jsonb_object_agg(famille, stats), '{}'::jsonb)
    into v_volume
  from (
    select famille,
           jsonb_build_object(
             'seances_7_jours', count(*) filter (where jour > p_date - 7),
             'minutes_7_jours', coalesce(sum(minutes) filter (where jour > p_date - 7), 0),
             'km_7_jours', round(coalesce(sum(km) filter (where jour > p_date - 7), 0)::numeric, 1),
             'seances_28_jours', count(*),
             'minutes_28_jours', coalesce(sum(minutes), 0),
             'km_28_jours', round(coalesce(sum(km), 0)::numeric, 1),
             'plus_longue_minutes_28_jours', max(minutes)
           ) as stats
    from (
      select public.coach_famille_sport(sport) as famille,
             start_date_local::date as jour,
             case when coalesce(excl_duration, false) then 0
                  else round(coalesce(moving_time, elapsed_time, 0) / 60.0) end as minutes,
             coalesce(distance_km, 0) as km
      from activities
      where user_id = v_uid and merged_into is null and start_date_local is not null
        and start_date_local::date > p_date - 28 and start_date_local::date <= p_date
    ) s
    group by famille
  ) g;

  -- Les 14 derniers jours, jour par jour (charge, durée, familles de sport du jour)
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', j.jour,
           'tss', coalesce(m.tss, 0),
           'minutes', coalesce(m.duration_min, 0),
           'seances', coalesce(m.activity_count, 0),
           'sports', coalesce(sp.sports, '[]'::jsonb)
         ) order by j.jour), '[]'::jsonb)
    into v_jours
  from (select d::date as jour from generate_series(p_date - 13, p_date, interval '1 day') d) j
  left join daily_metrics m on m.user_id = v_uid and m.iso_date = j.jour
  left join lateral (
    select jsonb_agg(distinct public.coach_famille_sport(a.sport)) as sports
    from activities a
    where a.user_id = v_uid and a.merged_into is null and a.start_date_local::date = j.jour
  ) sp on true;

  -- Les 8 dernières séances (jamais leur nom)
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', jour, 'sport', famille, 'minutes', minutes, 'km', km, 'fc_moyenne', fc
         ) order by jour desc, ordre desc), '[]'::jsonb)
    into v_dernieres
  from (
    select start_date_local::date as jour, start_date_local as ordre,
           public.coach_famille_sport(sport) as famille,
           case when coalesce(excl_duration, false) then 0
                else round(coalesce(moving_time, elapsed_time, 0) / 60.0) end as minutes,
           round(coalesce(distance_km, 0)::numeric, 1) as km,
           avg_heartrate as fc
    from activities
    where user_id = v_uid and merged_into is null and start_date_local is not null
      and start_date_local::date <= p_date and start_date_local::date >= date '2000-01-01'
    order by start_date_local desc
    limit 8
  ) d;

  -- Séances prévues dans les 14 prochains jours (durée en minutes, sport d'une liste fermée)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'date', date,
           'categorie', category,
           'sport', case when sport in ('velo', 'course', 'natation', 'muscu', 'hyrox', 'triathlon', 'duathlon', 'autre') then sport
                         else public.coach_famille_sport(sport) end,
           'minutes', duration,
           'tss', tss,
           'creee_par_ia', created_by_ia
         ) order by date), '[]'::jsonb)
    into v_prevues
  from activity_planned
  where user_id = v_uid and category = 'entrainement' and date >= p_date and date <= p_date + 14;

  -- Compétitions dans les 6 prochains mois (5 au plus)
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', date,
           'sport', case when sport in ('velo', 'course', 'natation', 'muscu', 'hyrox', 'triathlon', 'duathlon', 'autre') then sport
                         else public.coach_famille_sport(sport) end,
           'priorite', case when priority in ('A', 'B', 'C') then priority end,
           'km', km,
           'd_plus', d_plus
         ) order by date), '[]'::jsonb)
    into v_competitions
  from (
    select * from activity_planned
    where user_id = v_uid and category = 'competition' and date >= p_date and date <= p_date + 180
    order by date limit 5
  ) c;

  -- Périodes indisponibles (maladie, blessure, indisponible) qui touchent les 7 jours passés ou les 14 jours à venir
  select coalesce(jsonb_agg(jsonb_build_object('type', type, 'du', debut, 'au', fin) order by debut), '[]'::jsonb)
    into v_indispo
  from (
    select type, coalesce(from_date, iso_date) as debut, coalesce(to_date, from_date, iso_date) as fin
    from day_notes
    where user_id = v_uid and type in ('maladie', 'blessure', 'indisponible')
  ) n
  where debut is not null and debut <= p_date + 14 and fin >= p_date - 7;

  -- Jours de repos déclarés (14 jours avant, 14 jours après)
  select coalesce(jsonb_agg(iso_date order by iso_date), '[]'::jsonb)
    into v_repos
  from rest_day
  where user_id = v_uid and iso_date >= p_date - 14 and iso_date <= p_date + 14;

  -- Cycles d'entraînement des 60 prochains jours : dates et sport seulement (le nom est un texte libre)
  select coalesce(jsonb_agg(jsonb_build_object('du', from_date, 'au', to_date, 'sport', sport) order by from_date), '[]'::jsonb)
    into v_cycles
  from training_cycles
  where user_id = v_uid and to_date >= p_date and from_date <= p_date + 60;

  -- Objectifs de l'année en cours
  select coalesce(jsonb_agg(jsonb_build_object(
           'sport', sport,
           'modele', case when template ~ '^[a-z0-9_]{1,40}$' then template end,
           'cible', target,
           'valeur_saisie', current_manual
         ) order by sport), '[]'::jsonb)
    into v_objectifs
  from yearly_goals
  where user_id = v_uid and year = extract(year from p_date)::integer;

  -- Santé : seulement les catégories autorisées, 7 derniers jours, une valeur par jour et par mesure (la saisie à la main d'abord)
  select coalesce(jsonb_agg(jsonb_build_object('date', date, 'mesure', metric, 'valeur', value) order by date, metric), '[]'::jsonb)
    into v_sante
  from (
    select distinct on (date, metric) date, metric, value
    from health_metrics
    where user_id = v_uid and date > p_date - 7 and date <= p_date
      and public.coach_categorie_sante(metric) = any (v_sante_ok)
    order by date, metric, (source = 'manual') desc, updated_at desc
  ) h;

  if 'ressenti' = any (v_sante_ok) then
    select count(distinct date) into v_ressenti_jours
    from health_metrics
    where user_id = v_uid and date > p_date - 7 and date <= p_date and public.coach_categorie_sante(metric) = 'ressenti';
  end if;

  return jsonb_build_object(
    'date', p_date,
    'forme', coalesce(v_forme, '{}'::jsonb) || jsonb_build_object(
      'ctl_il_y_a_28_jours', v_ctl_avant,
      'tendance_ctl_28_jours', case when v_forme is not null and v_ctl_avant is not null
                                    then round(((v_forme ->> 'ctl')::numeric) - v_ctl_avant, 1) end
    ),
    'charge', jsonb_build_object(
      'tss_7_jours', round(v_tss7),
      'tss_7_jours_precedents', round(v_tss7_prec),
      'variation_pct_vs_semaine_precedente', case when v_tss7_prec > 0 then round(100 * (v_tss7 - v_tss7_prec) / v_tss7_prec) end,
      'moyenne_hebdo_28_jours', round(v_tss28 / 4.0),
      'jours_avec_seance_7_jours', v_actifs7,
      'jours_sans_seance_7_jours', 7 - v_actifs7
    ),
    'volume_par_sport', v_volume,
    'derniers_jours', v_jours,
    'dernieres_seances', v_dernieres,
    'prevues', v_prevues,
    'competitions', v_competitions,
    'indisponibilites', v_indispo,
    'jours_de_repos', v_repos,
    'cycles', v_cycles,
    'objectifs', v_objectifs,
    'sante', v_sante,
    'qualite', jsonb_build_object(
      'historique_jours', case when v_premier is null then 0 else p_date - v_premier + 1 end,
      'seances_28_jours', v_seances28,
      'jours_avec_seance_28_jours', v_actifs28,
      'ressenti_jours_renseignes_7_jours', v_ressenti_jours,
      'peu_de_donnees', (v_premier is null or p_date - v_premier + 1 < 28 or v_seances28 < 4),
      'sante_autorisee', to_jsonb(v_sante_ok)
    )
  );
end;
$$;

-- Droits : comptes connectés seulement (ni le public, ni anon)
revoke all on function public.rpc_coach_resume(date, text[]) from public, anon;
grant execute on function public.rpc_coach_resume(date, text[]) to authenticated;
revoke all on function public.coach_famille_sport(text) from public, anon;
grant execute on function public.coach_famille_sport(text) to authenticated;
revoke all on function public.coach_categorie_sante(text) from public, anon;
grant execute on function public.coach_categorie_sante(text) to authenticated;
