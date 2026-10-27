-- ============================================================
-- daily_metrics : la série va jusqu'à AUJOURD'HUI (pas seulement la dernière séance).
--
-- Problème : recalc_daily_metrics() s'arrêtait à la dernière séance, alors que
-- strava-webhook prolongeait la série jusqu'à aujourd'hui. Après quelques jours
-- de repos, la forme (CTL/ATL/TSB) affichée dépendait donc de qui avait calculé
-- en dernier. Jusqu'à aujourd'hui est plus juste : la forme redescend quand on
-- ne s'entraîne pas.
--
-- Correction : d_last = le plus grand de (dernière séance, aujourd'hui, en UTC
-- comme Supabase). Les jours sans séance valent 0 TSS. Relançable sans risque.
-- Limite : la série ne grandit qu'au prochain changement dans `activities`.
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
             sum(coalesce(tss, 0)) as tss,
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
