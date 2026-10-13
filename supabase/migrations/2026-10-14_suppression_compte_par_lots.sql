-- ============================================================
-- Suppression de compte fiable, même pour un gros compte (3 000 activités, 5 600 jours de métriques).
--
-- Problème constaté le 2026-10-13 : la suppression d'un gros compte échouait (« context canceled » côté Auth).
-- Causes :
--   1. quatre clés étrangères vers `activities` n'avaient pas d'index : chaque activité supprimée obligeait Postgres
--      à parcourir toute la table `daily_metrics` / `power_profile` pour remettre la référence à NULL (coût quadratique) ;
--   2. le déclencheur de recalcul de la forme se relançait à chaque suppression d'activité, pour un compte qui disparaît.
--
-- Correctifs (idempotents) :
--   - index (partiels) sur les colonnes qui pointent vers `activities` ;
--   - le recalcul est ignoré quand la transaction a posé `app.suppression_compte = 1` ;
--   - `rpc_purge_compte(user, lot)` : supprime les données lourdes PAR LOTS et renvoie ce qui reste (sert de barre
--     d'avancement) ; réservée au service_role (Edge Function `delete-account`).
-- ============================================================

create index if not exists idx_daily_metrics_main_activity on public.daily_metrics (main_activity_id) where main_activity_id is not null;
create index if not exists idx_power_profile_act_alltime   on public.power_profile (activity_id_alltime) where activity_id_alltime is not null;
create index if not exists idx_power_profile_act_90d       on public.power_profile (activity_id_90d) where activity_id_90d is not null;
create index if not exists idx_hyrox_tests_activity        on public.hyrox_tests (activity_id) where activity_id is not null;

-- Recalcul de la forme : inchangé, sauf pendant une suppression de compte
create or replace function public.trg_recalc_daily_metrics()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  u uuid;
begin
  if current_setting('app.suppression_compte', true) = '1' then return null; end if;
  for u in select distinct user_id from changed_rows where user_id is not null loop
    perform public.recalc_daily_metrics(u);
  end loop;
  return null;
end;
$$;

-- Purge par lots : p_lot <= 0 = juste compter. Ordre : métriques, courbes de puissance, puis activités (les références
-- vers les activités sont alors déjà vides, donc rien à remettre à NULL).
create or replace function public.rpc_purge_compte(p_user uuid, p_lot integer default 500)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  lot integer := least(greatest(coalesce(p_lot, 0), 0), 2000);
  n_met integer;
  n_pp  integer;
  n_act integer;
begin
  if p_user is null then raise exception 'utilisateur manquant'; end if;
  perform set_config('app.suppression_compte', '1', true);

  if lot > 0 then
    select count(*) into n_met from public.daily_metrics where user_id = p_user;
    if n_met > 0 then
      delete from public.daily_metrics where ctid in (select ctid from public.daily_metrics where user_id = p_user limit lot);
    else
      select count(*) into n_pp from public.power_profile where user_id = p_user;
      if n_pp > 0 then
        delete from public.power_profile where ctid in (select ctid from public.power_profile where user_id = p_user limit lot);
      else
        delete from public.activities where id in (select id from public.activities where user_id = p_user limit lot);
      end if;
    end if;
  end if;

  select count(*) into n_met from public.daily_metrics  where user_id = p_user;
  select count(*) into n_pp  from public.power_profile  where user_id = p_user;
  select count(*) into n_act from public.activities     where user_id = p_user;
  return jsonb_build_object('metriques', n_met, 'courbes', n_pp, 'activites', n_act, 'total', n_met + n_pp + n_act);
end;
$$;

revoke all on function public.rpc_purge_compte(uuid, integer) from public, anon, authenticated;
grant execute on function public.rpc_purge_compte(uuid, integer) to service_role;
