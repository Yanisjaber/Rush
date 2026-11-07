-- ============================================================
-- IA de Rush : lire plus loin dans l'historique (9/11/2026). Bornes techniques élargies : 260 semaines (5 ans), 400 jours,
-- 100 séances par lecture (avant : 52 semaines, 92 jours, 30 séances). Le reste est inchangé. Relançable sans risque.
-- ============================================================
-- ============================================================
-- IA de Rush : l'historique long que le coach peut aller lire (7/11/2026).
--
-- Le résumé (rpc_coach_resume) ne porte que 14 jours et 8 séances. Ces deux fonctions donnent au coach de quoi répondre
-- à « compare ce mois-ci à il y a trois mois » :
--   - rpc_coach_semaines : le bilan semaine par semaine (jusqu'à 52 semaines), tous sports ou un seul ;
--   - rpc_coach_seances  : les séances d'une période (92 jours au plus, 30 séances au plus), jamais leur nom.
--
-- Sécurité (même cadre que rpc_coach_resume) :
--   - security invoker : la RLS s'applique ; la fonction ne lit que auth.uid() (aucun identifiant d'utilisateur en paramètre).
--     Sans connexion elle renvoie null. Réservée aux comptes connectés (pas anon). Jamais de clé service_role.
--   - AUCUN texte venant de l'extérieur n'en sort : que des nombres, des dates et des familles de sport d'une liste fermée.
--   - Les bornes sont imposées ici (52 semaines, 92 jours, 30 séances), pas seulement par l'Edge Function.
--   - Pas de données de santé : elles ont leur propre porte (catégories autorisées) dans rpc_coach_resume.
--
-- Les semaines sont des blocs de 7 jours qui finissent à p_date (comme « les 7 derniers jours » du résumé), du plus ancien
-- au plus récent. Relançable sans risque. Test local : bash supabase/tests/sql/coach_historique.sh
-- ============================================================

create or replace function public.rpc_coach_semaines(p_date date default current_date, p_nb integer default 12, p_sport text default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nb integer := least(greatest(coalesce(p_nb, 12), 1), 260);
  v_res jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  -- Un sport hors liste ne donne rien (jamais d'erreur qui révèle quelque chose)
  if p_sport is not null and p_sport not in ('velo', 'course', 'natation', 'muscu') then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'du', w.du,
             'au', w.au,
             'seances', coalesce(a.seances, 0),
             'minutes', coalesce(a.minutes, 0),
             'km', coalesce(a.km, 0)
           ) || case when p_sport is null
                     then jsonb_build_object('tss', coalesce(m.tss, 0), 'jours_actifs', coalesce(m.actifs, 0), 'ctl_fin', m.ctl_fin)
                     else '{}'::jsonb end
           order by w.du), '[]'::jsonb)
    into v_res
  from (select p_date - 7 * i - 6 as du, p_date - 7 * i as au from generate_series(0, v_nb - 1) i) w
  left join lateral (
    select count(*) as seances,
           coalesce(sum(case when coalesce(excl_duration, false) then 0 else round(coalesce(moving_time, elapsed_time, 0) / 60.0) end), 0) as minutes,
           round(coalesce(sum(distance_km), 0)::numeric, 1) as km
    from activities
    where user_id = v_uid and merged_into is null and start_date_local is not null
      and start_date_local::date between w.du and w.au
      and (p_sport is null or public.coach_famille_sport(sport) = p_sport)
  ) a on true
  left join lateral (
    select coalesce(sum(tss), 0) as tss,
           count(*) filter (where activity_count > 0) as actifs,
           round((array_agg(ctl order by iso_date desc))[1]::numeric, 1) as ctl_fin
    from daily_metrics
    where user_id = v_uid and iso_date between w.du and w.au
  ) m on true;

  return v_res;
end;
$$;

create or replace function public.rpc_coach_seances(p_du date, p_au date, p_sport text default null, p_limite integer default 20)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_au date := p_au;
  v_du date := p_du;
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 100);
  v_res jsonb;
begin
  if v_uid is null then
    return null;
  end if;
  if v_du is null or v_au is null or v_au < v_du then
    return '[]'::jsonb;
  end if;
  if p_sport is not null and p_sport not in ('velo', 'course', 'natation', 'muscu', 'autre') then
    return '[]'::jsonb;
  end if;
  -- 400 jours au plus : on garde la fin de la période demandée
  if v_au - v_du > 400 then
    v_du := v_au - 400;
  end if;
  if v_du < date '2000-01-01' then
    v_du := date '2000-01-01';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('date', jour, 'sport', famille, 'minutes', minutes, 'km', km, 'fc_moyenne', fc)
                            order by jour desc, ordre desc), '[]'::jsonb)
    into v_res
  from (
    select start_date_local::date as jour, start_date_local as ordre,
           public.coach_famille_sport(sport) as famille,
           case when coalesce(excl_duration, false) then 0 else round(coalesce(moving_time, elapsed_time, 0) / 60.0) end as minutes,
           round(coalesce(distance_km, 0)::numeric, 1) as km,
           avg_heartrate as fc
    from activities
    where user_id = v_uid and merged_into is null and start_date_local is not null
      and start_date_local::date between v_du and v_au
      and (p_sport is null or public.coach_famille_sport(sport) = p_sport)
    order by start_date_local desc
    limit v_limite
  ) d;

  return v_res;
end;
$$;

-- Droits : comptes connectés seulement (ni le public, ni anon)
revoke all on function public.rpc_coach_semaines(date, integer, text) from public, anon;
grant execute on function public.rpc_coach_semaines(date, integer, text) to authenticated;
revoke all on function public.rpc_coach_seances(date, date, text, integer) from public, anon;
grant execute on function public.rpc_coach_seances(date, date, text, integer) to authenticated;
