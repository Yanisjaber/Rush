-- ============================================================
-- daily_metrics : ne réécrire que les jours dont les valeurs changent (14/11/2026).
-- Problème : recalc_daily_metrics réécrivait TOUTE la série à chaque séance ajoutée ou modifiée (upsert sans condition) :
-- 2,1 millions de mises à jour pour 8 979 lignes, et une table de 98 Mo pour environ 1 Mo de données (récupérés par un VACUUM FULL le 14/11).
-- Correction : `do update … where (anciennes valeurs) is distinct from (nouvelles valeurs)`. Le calcul est inchangé, seule l'écriture est évitée quand rien ne bouge
-- (en pratique : une séance d'aujourd'hui ne touche plus que les derniers jours, la condition des jours lointains arrondie à 0,1 ne change plus).
-- La fonction est la copie exacte de celle en base (avec tss_retenu et les exclusions), plus cette condition. Relançable sans risque.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalc_daily_metrics(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          activity_count = excluded.activity_count
      -- Une ligne dont les valeurs ne changent pas n'est PAS réécrite : sans ça, chaque séance ajoutée réécrivait toute la série
      -- (2,1 millions de mises à jour pour 9 000 lignes, 98 Mo de gonflement pour environ 1 Mo de données).
      where (daily_metrics.tss, daily_metrics.ctl, daily_metrics.atl, daily_metrics.tsb, daily_metrics.duration_min, daily_metrics.activity_count)
            is distinct from (excluded.tss, excluded.ctl, excluded.atl, excluded.tsb, excluded.duration_min, excluded.activity_count);
  end loop;
end;
$function$;
