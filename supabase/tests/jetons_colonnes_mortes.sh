#!/bin/bash
# Test LOCAL (Postgres jetable) : on rejoue tout l'historique du coffre de jetons, puis le retrait des colonnes en clair.
set -e
cd "$(dirname "$0")/../.."
H=supabase/proposals/db-v2/tests/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d coachia -q -v ON_ERROR_STOP=1 <<'SQL'
-- table d'origine + colonnes Garmin, comme en production avant le chantier Vault
create table public.connexions_app (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  app text not null, external_id text, athlete_name text, access_token text not null, refresh_token text,
  expires_at timestamptz not null, scope text, first_connected_at timestamptz not null default now(), last_sync_at timestamptz,
  last_sync_status text, last_sync_error text, total_activities_synced integer, oauth1_token text, oauth1_secret text, unique (user_id, app));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001','a@test'), ('00000000-0000-4000-8000-000000000002','b@test');
insert into public.connexions_app (user_id, app, external_id, access_token, refresh_token, expires_at) values ('00000000-0000-4000-8000-000000000001','strava','42','ancien_acc','ancien_ref', now() + interval '1 hour');
SQL
for f in supabase/migrations/2026-10-14_jetons_vault_1_ajout.sql supabase/migrations/2026-10-14_jetons_vault_2a_purge_strava.sql supabase/migrations/2026-10-14_jetons_vault_2b_fin.sql; do
  bash $H psql -d coachia -q -v ON_ERROR_STOP=1 -f $f >/dev/null
done
echo "== le retrait des colonnes (deux fois : idempotent)"
bash $H psql -d coachia -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_jetons_colonnes_mortes.sql
bash $H psql -d coachia -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_jetons_colonnes_mortes.sql
bash $H psql -d coachia -v ON_ERROR_STOP=1 <<'SQL'
select public.rpc_save_connection_secrets('00000000-0000-4000-8000-000000000001', 'strava', '{"access_token":"nouveau_acc"}'::jsonb, now() + interval '2 hours');
create temp table r as select public.rpc_connection_secrets('00000000-0000-4000-8000-000000000001', 'strava') as j;
select 'les 4 colonnes en clair sont supprimées' as controle, not exists (select 1 from information_schema.columns where table_schema='public' and table_name='connexions_app' and column_name in ('access_token','refresh_token','oauth1_token','oauth1_secret')) as ok
union all select 'secret_id conservé', exists (select 1 from information_schema.columns where table_schema='public' and table_name='connexions_app' and column_name='secret_id')
union all select 'les jetons migrés avant restent lisibles (refresh_token)', (select j->>'refresh_token' = 'ancien_ref' from r)
union all select 'une écriture fusionne et chiffre (access_token neuf)', (select j->>'access_token' = 'nouveau_acc' from r)
union all select 'connexion inconnue : lecture renvoie null', public.rpc_connection_secrets('00000000-0000-4000-8000-000000000002','strava') is null
union all select 'rpc refusées à authenticated', not has_function_privilege('authenticated','public.rpc_connection_secrets(uuid,text)','execute') and not has_function_privilege('authenticated','public.rpc_save_connection_secrets(uuid,text,jsonb,timestamptz)','execute')
union all select 'rpc refusées à anon', not has_function_privilege('anon','public.rpc_connection_secrets(uuid,text)','execute')
union all select 'le déclencheur de suppression du secret est toujours là', exists (select 1 from pg_trigger where tgname='connexions_app_delete_secret');
do $$ begin
  begin perform public.rpc_save_connection_secrets('00000000-0000-4000-8000-000000000002', 'strava', '{"a":1}'::jsonb); raise exception 'devait échouer';
  exception when others then if sqlerrm <> 'connexion inconnue' then raise; end if; end;
  raise notice 'ok : une écriture sur une connexion inconnue est refusée';
end $$;
delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
select 'suppression du compte : le secret chiffré est supprimé' as controle, (select count(*) = 0 from vault.secrets) as ok;
SQL
