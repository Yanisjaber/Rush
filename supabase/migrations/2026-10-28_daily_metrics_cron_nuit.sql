-- ============================================================
-- daily_metrics : la série avance toute seule chaque nuit.
--
-- Constat (test dans le simulateur, 28/10/2026) : depuis que la série va jusqu'à aujourd'hui
-- (2026-10-27_daily_metrics_jusqua_aujourdhui.sql), elle ne s'allongeait que quand `activities`
-- changeait. Sans séance pendant quelques jours, l'app affichait la forme de la veille.
--
-- Correction : une tâche pg_cron, tous les jours à 00 h 05 UTC, relance recalc_daily_metrics()
-- pour chaque compte qui a des séances. Relançable sans risque ; sans pg_cron (base locale), ne fait rien.
-- Retour arrière : select cron.unschedule('daily_metrics_nuit');
-- ============================================================
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron absent : tâche non créée';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'daily_metrics_nuit') then
    perform cron.unschedule('daily_metrics_nuit');
  end if;
  perform cron.schedule(
    'daily_metrics_nuit',
    '5 0 * * *',
    $job$select public.recalc_daily_metrics(u.user_id) from (select distinct user_id from public.activities) u$job$
  );
end;
$$;
