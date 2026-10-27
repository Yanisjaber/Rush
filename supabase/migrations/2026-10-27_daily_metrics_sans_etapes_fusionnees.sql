-- ============================================================
-- daily_metrics : le recalcul ignore maintenant les étapes fusionnées.
--
-- Problème : recalc_daily_metrics() comptait TOUTES les activités, donc un
-- triathlon fusionné (parent + natation/vélo/course rattachées par
-- merged_into) était compté deux fois dans la charge (TSS, CTL, ATL), alors
-- que strava-ingest et strava-webhook, eux, excluaient déjà les étapes.
-- Selon qui recalculait en dernier, la courbe de forme changeait.
--
-- Correction : même fonction qu'avant, avec « merged_into is null » dans
-- la plage de dates ET dans l'agrégat. Relançable sans risque.
-- Les triggers (2026-07-08) ne changent pas : ils appellent cette fonction.
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


-- Recalcul immédiat pour les comptes qui ont des étapes fusionnées.
do $$
declare
  u uuid;
begin
  for u in select distinct user_id from public.activities where merged_into is not null loop
    perform public.recalc_daily_metrics(u);
  end loop;
end;
$$;
