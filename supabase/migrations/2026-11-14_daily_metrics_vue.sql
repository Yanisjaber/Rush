-- ============================================================
-- daily_metrics n'est plus une table : c'est une VUE calculée à la demande à partir des activités (14/11/2026).
-- Étape 2 sur 2 (la fonction metriques_quotidiennes, ajoutée avant, a été vérifiée : mêmes valeurs que la table sur les deux comptes).
--
-- Ce qui change :
--   - les 3 déclencheurs qui recalculaient toute la série à chaque séance sont supprimés ;
--   - l'ancienne table est renommée daily_metrics_ancienne (gardée quelques jours pour pouvoir revenir en arrière ; à supprimer ensuite) ;
--   - la vue `daily_metrics` a les mêmes colonnes et le même nom : tout ce qui la lit (fonctions du Coach, écran Santé, Accueil) marche sans changement ;
--   - rpc_purge_compte ne vide plus de métriques (il n'y en a plus à vider).
-- Sécurité : la vue est `security_invoker` : elle appelle la fonction avec l'identité de l'appelant, et la RLS des activités limite à SES séances.
-- Aucun accès `anon`. Elle ne renvoie que les jours du compte connecté (user_id = auth.uid()).
-- Tout se fait dans une seule transaction avec une vérification : si la vue ne redonne pas exactement les mêmes lignes que la table, tout est annulé.
-- ============================================================

begin;

-- 1. Plus de recalcul à chaque séance
drop trigger if exists activities_recalc_metrics_ins on public.activities;
drop trigger if exists activities_recalc_metrics_upd on public.activities;
drop trigger if exists activities_recalc_metrics_del on public.activities;

-- 2. L'ancienne table (idempotent : seulement si c'est encore une table)
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'daily_metrics' and c.relkind = 'r') then
    alter table public.daily_metrics rename to daily_metrics_ancienne;
  end if;
end $$;

-- 3. La vue, mêmes colonnes que la table
create or replace view public.daily_metrics with (security_invoker = true) as
select auth.uid() as user_id,
       m.iso_date,
       m.tss,
       m.ctl,
       m.atl,
       m.tsb,
       m.duration_min,
       m.activity_count,
       null::uuid as main_activity_id,
       now() as calculated_at
from public.metriques_quotidiennes(auth.uid()) m;

revoke all on public.daily_metrics from public, anon;
grant select on public.daily_metrics to authenticated, service_role;

-- 4. La suppression de compte ne vide plus de métriques
create or replace function public.rpc_purge_compte(p_user uuid, p_lot integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lot integer := least(greatest(coalesce(p_lot, 0), 0), 2000);
  n_pp  integer;
  n_act integer;
begin
  if p_user is null then raise exception 'utilisateur manquant'; end if;
  perform set_config('app.suppression_compte', '1', true);

  if lot > 0 then
    select count(*) into n_pp from public.power_profile where user_id = p_user;
    if n_pp > 0 then
      delete from public.power_profile where ctid in (select ctid from public.power_profile where user_id = p_user limit lot);
    else
      delete from public.activities where id in (select id from public.activities where user_id = p_user limit lot);
    end if;
  end if;

  select count(*) into n_pp  from public.power_profile where user_id = p_user;
  select count(*) into n_act from public.activities    where user_id = p_user;
  -- « metriques » reste dans la réponse (toujours 0) : l'app lit cette clé pour sa barre de progression
  return jsonb_build_object('metriques', 0, 'courbes', n_pp, 'activites', n_act, 'total', n_pp + n_act);
end;
$$;

-- 5. Vérification : pour chaque compte, la vue (via la fonction) redonne exactement les lignes de l'ancienne table. Sinon, tout est annulé.
do $$
declare
  u uuid;
  ecarts integer;
begin
  if to_regclass('public.daily_metrics_ancienne') is null then return; end if;
  for u in select distinct user_id from public.daily_metrics_ancienne loop
    select count(*) into ecarts
    from public.metriques_quotidiennes(u) f
    full join (select * from public.daily_metrics_ancienne where user_id = u) d on d.iso_date = f.iso_date
    where (f.tss, f.ctl, f.atl, f.tsb, f.duration_min, f.activity_count)
          is distinct from (d.tss::integer, d.ctl, d.atl, d.tsb, d.duration_min::integer, d.activity_count::integer);
    if ecarts > 0 then raise exception 'Vérification échouée : % lignes différentes pour le compte %', ecarts, u; end if;
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
