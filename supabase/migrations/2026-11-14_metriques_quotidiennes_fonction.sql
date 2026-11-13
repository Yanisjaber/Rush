-- ============================================================
-- La condition (CTL), la fatigue (ATL) et la forme (TSB) de chaque jour, CALCULÉES à la demande au lieu d'être stockées (14/11/2026).
--
-- Pourquoi : la table daily_metrics recalculait et réécrivait toute la série à chaque séance (2,1 millions de mises à jour, 98 Mo de gonflement).
-- Cette fonction fait le même calcul, avec exactement les mêmes règles que `recalc_daily_metrics` (copie de la version en base) :
--   - séries continues de la 1re séance jusqu'à aujourd'hui, les jours sans séance comptent pour une charge de 0 ;
--   - les étapes fusionnées d'un triathlon ne sont pas comptées deux fois (merged_into) ;
--   - la charge d'une séance est celle que l'utilisateur a retenue (tss_retenu : les données écartées sont retirées) ;
--   - CTL = CTL de la veille + (charge - CTL de la veille) × 2 / 43 ; ATL = idem avec 2 / 8 ; TSB = CTL - ATL.
-- Étape 1 sur 2 : cette migration AJOUTE seulement la fonction. La table daily_metrics est remplacée par une vue dans la migration suivante,
-- une fois qu'on a vérifié que les deux donnent les mêmes valeurs.
--
-- Sécurité : `security invoker` : les séances lues sont celles que la RLS laisse voir à l'appelant (un compte ne calcule que SES jours).
-- Aucun accès `anon`. Relançable sans risque.
-- ============================================================

create or replace function public.metriques_quotidiennes(p_user uuid)
returns table (
  iso_date       date,
  tss            integer,
  ctl            numeric,
  atl            numeric,
  tsb            numeric,
  duration_min   integer,
  activity_count integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  d_first date;
  d_last  date;
  r record;
  v_ctl numeric := 0;
  v_atl numeric := 0;
begin
  select min(a.start_date_local::date), greatest(max(a.start_date_local::date), current_date)
    into d_first, d_last
  from public.activities a
  where a.user_id = p_user
    and a.merged_into is null
    and a.start_date_local is not null
    and a.start_date_local::date >= date '2000-01-01';  -- ignore les dates aberrantes (1970)

  if d_first is null then
    return;
  end if;

  for r in
    with agg as (
      select a.start_date_local::date as iso,
             sum(public.tss_retenu(a.tss, a.np, a.avg_watts, a.avg_heartrate, a.excl_power, a.excl_hr, a.excl_load, a.excl_duration)) as tss,
             sum(case when coalesce(a.excl_duration, false) then 0 else round(coalesce(a.moving_time, a.elapsed_time, 0) / 60.0) end) as dur,
             count(*) as cnt
      from public.activities a
      where a.user_id = p_user
        and a.merged_into is null
        and a.start_date_local is not null
        and a.start_date_local::date >= date '2000-01-01'
      group by 1
    )
    select gs::date as iso,
           coalesce(g.tss, 0) as tss,
           coalesce(g.dur, 0) as dur,
           coalesce(g.cnt, 0) as cnt
    from generate_series(d_first, d_last, interval '1 day') gs
    left join agg g on g.iso = gs::date
    order by gs::date
  loop
    v_ctl := v_ctl + (r.tss - v_ctl) * 2 / 43.0;
    v_atl := v_atl + (r.tss - v_atl) * 2 / 8.0;
    iso_date := r.iso;
    tss := round(r.tss)::integer;
    ctl := round(v_ctl, 1);
    atl := round(v_atl, 1);
    tsb := round(v_ctl - v_atl, 1);
    duration_min := r.dur::integer;
    activity_count := r.cnt::integer;
    return next;
  end loop;
end;
$$;

revoke all on function public.metriques_quotidiennes(uuid) from public, anon;
grant execute on function public.metriques_quotidiennes(uuid) to authenticated, service_role;
