-- ============================================================
-- IA de Rush : le coach va lire lui-même les données de l'athlète (12/11/2026, décision de Yanis : liste blanche d'outils).
--
-- Six fonctions de LECTURE, chacune bornée, que le coach appelle avec le jeton de l'utilisateur (RLS) :
--   - rpc_coach_prevues    : les séances prévues d'une période (jamais leur nom ni leurs notes) ;
--   - rpc_coach_force      : la musculation par jour et par exercice (séries, répétitions, charge max, volume) ;
--   - rpc_coach_hyrox      : les tests Hyrox (temps total, segments) et l'objectif ;
--   - rpc_coach_objectifs  : les objectifs de l'année et les phases d'entraînement ;
--   - rpc_coach_fiche      : FTP, FC max, seuil, taille, âge, sexe ; le poids seulement si la catégorie « corps » est autorisée ;
--   - rpc_coach_sante      : l'historique des mesures de santé, SEULEMENT pour les catégories que l'utilisateur a autorisées.
--
-- Sécurité (même cadre que rpc_coach_resume) :
--   - security invoker : la RLS s'applique ; chaque fonction ne lit que auth.uid() (aucun identifiant en paramètre).
--     Sans connexion elle renvoie null. Réservée à `authenticated` (pas anon). Jamais de clé service_role.
--   - AUCUN texte libre n'en sort (ni nom de séance, ni note, ni nom d'exercice saisi, ni GPX) : des nombres, des dates et des
--     valeurs de listes fermées. Les bornes sont imposées ici, pas seulement par l'Edge Function.
--   - Les jetons, le Vault et les autres comptes ne sont pas touchés : ces fonctions ne lisent que les tables ci-dessus.
-- Relançable sans risque. Test local : bash supabase/tests/sql/coach_lecture_athlete.sh
-- ============================================================

create or replace function public.rpc_coach_prevues(p_du date, p_au date, p_limite integer default 50)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limite integer := least(greatest(coalesce(p_limite, 50), 1), 100);
  v_res jsonb;
begin
  if v_uid is null or p_du is null or p_au is null or p_au < p_du or p_au - p_du > 400 then
    return case when v_uid is null then null else '[]'::jsonb end;
  end if;
  select coalesce(jsonb_agg(l order by l ->> 'date'), '[]'::jsonb) into v_res
  from (
    select jsonb_build_object(
             'date', date, 'sport', public.coach_famille_sport(sport), 'categorie', category,
             'minutes', duration, 'km', km, 'denivele', d_plus, 'tss', tss, 'priorite', priority,
             'creee_par_ia', coalesce(created_by_ia, false)) as l
    from activity_planned
    where user_id = v_uid and date between p_du and p_au
    order by date
    limit v_limite
  ) x;
  return v_res;
end;
$$;

create or replace function public.rpc_coach_force(p_du date, p_au date, p_limite integer default 100)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limite integer := least(greatest(coalesce(p_limite, 100), 1), 200);
  v_res jsonb;
begin
  if v_uid is null or p_du is null or p_au is null or p_au < p_du or p_au - p_du > 400 then
    return case when v_uid is null then null else '[]'::jsonb end;
  end if;
  -- L'exercice est identifié par sa clé de bibliothèque (liste fermée) ; une clé qui n'a pas la forme attendue est masquée
  select coalesce(jsonb_agg(l order by l ->> 'date' desc, l ->> 'exercice'), '[]'::jsonb) into v_res
  from (
    select jsonb_build_object(
             'date', date,
             'exercice', case when exercise_key ~ '^[a-z0-9_:-]{1,40}$' then exercise_key else 'autre' end,
             'groupe', case when muscle_group in ('pectoraux','dos','epaules','jambes','tronc','bras') then muscle_group else null end,
             'series', count(*), 'repetitions', coalesce(sum(reps), 0),
             'charge_max_kg', max(weight_kg),
             'volume_kg', round(coalesce(sum(reps * weight_kg), 0)::numeric)) as l
    from strength_sets
    where user_id = v_uid and date between p_du and p_au
    group by date, exercise_key, muscle_group
    order by date desc
    limit v_limite
  ) x;
  return v_res;
end;
$$;

create or replace function public.rpc_coach_hyrox(p_limite integer default 10)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limite integer := least(greatest(coalesce(p_limite, 10), 1), 20);
  v_tests jsonb;
  v_obj jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('date', date, 'total_s', total_s, 'segments_s', segments) order by date desc), '[]'::jsonb)
    into v_tests
  from (select date, total_s, segments from hyrox_tests where user_id = v_uid order by date desc limit v_limite) t;
  select jsonb_build_object('total_s', total_s, 'segments_s', segments) into v_obj from hyrox_objectif where user_id = v_uid;
  return jsonb_build_object('tests', v_tests, 'objectif', v_obj);
end;
$$;

create or replace function public.rpc_coach_objectifs()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_obj jsonb;
  v_phases jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('annee', year, 'sport', sport, 'type', template, 'cible', target, 'actuel_saisi', current_manual)
                            order by year desc, sport), '[]'::jsonb)
    into v_obj
  from (select * from yearly_goals where user_id = v_uid order by year desc limit 50) g;
  select coalesce(jsonb_agg(jsonb_build_object('phase', phase, 'du', from_date, 'au', to_date) order by from_date), '[]'::jsonb)
    into v_phases
  from (select * from training_phases where user_id = v_uid and to_date >= current_date - 365 order by from_date limit 50) p;
  return jsonb_build_object('objectifs_annuels', v_obj, 'phases', v_phases);
end;
$$;

create or replace function public.rpc_coach_fiche(p_sante text[] default '{}')
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_p user_profiles%rowtype;
  v_naissance date;
  v_res jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  select * into v_p from user_profiles where user_id = v_uid;
  if not found then
    return '{}'::jsonb;
  end if;
  begin
    v_naissance := nullif(v_p.extras ->> 'birth_date', '')::date;
  exception when others then
    v_naissance := null;
  end;
  v_res := jsonb_build_object(
    'ftp_w', v_p.ftp, 'fc_max', v_p.hr_max, 'fc_seuil', v_p.lthr,
    'puissance_max_w', case when (v_p.extras ->> 'pmax') ~ '^[0-9]{1,5}(\.[0-9]+)?$' then (v_p.extras ->> 'pmax')::numeric end,
    'taille_cm', case when (v_p.extras ->> 'height') ~ '^[0-9]{2,3}(\.[0-9]+)?$' then (v_p.extras ->> 'height')::numeric end,
    'age', case when v_naissance is not null then extract(year from age(current_date, v_naissance))::int end,
    'sexe', case when (v_p.extras ->> 'sex') in ('M', 'F', 'H', 'homme', 'femme', 'male', 'female') then v_p.extras ->> 'sex' end);
  -- Le poids est une donnée de santé : seulement si la catégorie « corps » est autorisée
  if 'corps' = any (coalesce(p_sante, '{}')) then
    v_res := v_res || jsonb_build_object('poids_kg', v_p.weight);
  end if;
  return v_res;
end;
$$;

create or replace function public.rpc_coach_sante(p_du date, p_au date, p_sante text[] default '{}', p_limite integer default 200)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limite integer := least(greatest(coalesce(p_limite, 200), 1), 400);
  v_ok text[] := coalesce(p_sante, '{}');
  v_res jsonb;
begin
  if v_uid is null or p_du is null or p_au is null or p_au < p_du or p_au - p_du > 400 then
    return case when v_uid is null then null else '[]'::jsonb end;
  end if;
  if cardinality(v_ok) = 0 then
    return '[]'::jsonb;
  end if;
  -- Une seule valeur par jour et par mesure (la saisie à la main passe avant l'appareil), et seulement les catégories autorisées
  select coalesce(jsonb_agg(jsonb_build_object('date', date, 'mesure', metric, 'valeur', value) order by date desc, metric), '[]'::jsonb)
    into v_res
  from (
    select distinct on (date, metric) date, metric, value
    from health_metrics
    where user_id = v_uid and date between p_du and p_au
      and public.coach_categorie_sante(metric) = any (v_ok)
    order by date desc, metric, (source = 'manual') desc, updated_at desc
    limit v_limite
  ) h;
  return v_res;
end;
$$;

revoke all on function public.rpc_coach_prevues(date, date, integer) from public, anon;
grant execute on function public.rpc_coach_prevues(date, date, integer) to authenticated;
revoke all on function public.rpc_coach_force(date, date, integer) from public, anon;
grant execute on function public.rpc_coach_force(date, date, integer) to authenticated;
revoke all on function public.rpc_coach_hyrox(integer) from public, anon;
grant execute on function public.rpc_coach_hyrox(integer) to authenticated;
revoke all on function public.rpc_coach_objectifs() from public, anon;
grant execute on function public.rpc_coach_objectifs() to authenticated;
revoke all on function public.rpc_coach_fiche(text[]) from public, anon;
grant execute on function public.rpc_coach_fiche(text[]) to authenticated;
revoke all on function public.rpc_coach_sante(date, date, text[], integer) from public, anon;
grant execute on function public.rpc_coach_sante(date, date, text[], integer) to authenticated;
