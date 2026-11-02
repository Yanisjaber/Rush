-- ============================================================
-- daily_metrics : la série va de nouveau jusqu'à AUJOURD'HUI (régression corrigée).
--
-- Problème : 2026-10-27_daily_metrics_jusqua_aujourdhui.sql avait fait aller la série jusqu'à aujourd'hui
-- (la forme redescend quand on ne s'entraîne pas), et la tâche de nuit (2026-10-28_daily_metrics_cron_nuit.sql)
-- compte dessus. Mais les migrations suivantes qui redéfinissent `recalc_daily_metrics`
-- (2026-10-27_daily_metrics_sans_etapes_fusionnees.sql, 2026-11-02_donnees_ecartees.sql, 2026-11-02_duree_ecartable.sql)
-- sont reparties de l'ancienne version et ont remis `max(start_date_local)` à la place de
-- `greatest(max(start_date_local), current_date)`. Résultat : la série s'arrête à la dernière séance
-- (et supprime les jours d'après), donc pendant les jours de repos l'app affiche la forme du dernier jour roulé, sans décroissance.
--
-- Correction : même fonction que 2026-11-02_duree_ecartable.sql (étapes fusionnées ignorées, `tss_retenu` avec la durée écartée),
-- avec d_last = le plus grand de (dernière séance, aujourd'hui, en UTC comme Supabase). Relançable sans risque.
-- ============================================================

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
  select min(start_date_local::date), greatest(max(start_date_local::date), current_date)
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

  -- Purge des lignes hors plage (avant la 1re activité / après aujourd'hui).
  delete from daily_metrics
  where user_id = p_user
    and (iso_date < d_first or iso_date > d_last);

  -- Série continue jour par jour + EWMA (même formule que strava-ingest).
  for r in
    with agg as (
      select start_date_local::date as iso,
             sum(public.tss_retenu(tss, np, avg_watts, avg_heartrate, excl_power, excl_hr, excl_load, excl_duration)) as tss,
             sum(case when coalesce(excl_duration, false) then 0 else round(coalesce(moving_time, elapsed_time, 0) / 60.0) end) as dur,
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

-- Même sécurité qu'avant (2026-10-11_remove_coach_system.sql) : ni le public, ni anon, ni un utilisateur connecté ne peut l'appeler.
revoke all on function public.recalc_daily_metrics(uuid) from public, anon, authenticated;

-- Recalcul immédiat pour tous les comptes qui ont des séances.
do $$
declare
  u uuid;
begin
  for u in select distinct user_id from public.activities loop
    perform public.recalc_daily_metrics(u);
  end loop;
end;
$$;
