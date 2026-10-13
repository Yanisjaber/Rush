-- Test des fonctions de jetons chiffrés (Vault) : migration phase 1, puis phase 2. À lancer sur la base LOCALE de test uniquement.
-- Prérequis : base locale avec l'ancien schéma dans `public` (voir supabase/proposals/db-v2/tests/run_cutover.sh pour la préparation).
\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.ok(p_nom text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin if p_ok is not true then raise exception '❌ % %', p_nom, p_detail; end if; raise notice '✅ % %', p_nom, p_detail; end $$;

-- (la structure de test n'a pas les clés étrangères ; en production, connexions_app.user_id → auth.users est en ON DELETE CASCADE)
alter table public.connexions_app add constraint connexions_app_user_fk foreign key (user_id) references auth.users (id) on delete cascade;
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.invalid'), ('aaaaaaaa-0000-4000-8000-000000000002', 'b@test.invalid');
insert into public.connexions_app (user_id, app, external_id, access_token, refresh_token, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'strava', '42', 'acc_old', 'ref_old', now() + interval '1 hour');
insert into public.connexions_app (user_id, app, access_token, expires_at, oauth1_token, oauth1_secret) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'garmin', 'g_acc', now(), 'g_o1', 'g_o1s');
insert into public.connexions_app (user_id, app, access_token, refresh_token, expires_at) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'strava', 'b_acc', 'b_ref', now());

\ir ../migrations/2026-10-14_jetons_vault_1_ajout.sql

-- ===== Phase 1 ======================================================================================================
select pg_temp.ok('phase 1 : chaque connexion a un secret chiffré', (select count(*) from public.connexions_app where secret_id is null) = 0, '');
select pg_temp.ok('phase 1 : le secret chiffré contient bien les jetons d''origine', (select (public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000001', 'garmin')) = '{"access_token":"g_acc","oauth1_token":"g_o1","oauth1_secret":"g_o1s"}'::jsonb), '');
select pg_temp.ok('phase 1 : le clair est toujours là (repli pour les anciennes versions)', (select access_token = 'acc_old' from public.connexions_app where external_id = '42'), '');
select pg_temp.ok('lecture d''une connexion inconnue → null', public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000002', 'garmin') is null, '');

-- renouvellement Strava qui ne renvoie QUE access_token : le refresh_token existant est conservé (fusion)
select public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000001', 'strava', '{"access_token":"acc_new"}', now() + interval '6 hours');
select pg_temp.ok('écriture : fusion avec les jetons existants', (public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000001', 'strava')) = '{"access_token":"acc_new","refresh_token":"ref_old"}'::jsonb, '');
select pg_temp.ok('écriture : date d''expiration mise à jour', (select expires_at > now() + interval '5 hours' from public.connexions_app where external_id = '42'), '');
select pg_temp.ok('écriture : phase 1 = écriture double (le clair suit)', (select access_token = 'acc_new' and refresh_token = 'ref_old' from public.connexions_app where external_id = '42'), '');
select pg_temp.ok('écriture : un seul secret par connexion (mis à jour, pas dupliqué)', (select count(*) from vault.secrets) = 3, format('%s secrets', (select count(*) from vault.secrets)));
do $$ declare v boolean := false; begin
  begin perform public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000002', 'garmin', '{"access_token":"x"}', null); exception when others then v := true; end;
  perform pg_temp.ok('écriture sur une connexion inconnue → erreur', v, ''); end $$;

-- ===== Droits ===========================================================================================================
do $$ declare v boolean; begin
  set local role authenticated;
  begin perform public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000001', 'strava'); v := false; exception when others then v := true; end;
  perform pg_temp.ok('un utilisateur connecté ne peut PAS lire les jetons', v, '');
  begin perform public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000001', 'strava', '{"access_token":"pirate"}', null); v := false; exception when others then v := true; end;
  perform pg_temp.ok('un utilisateur connecté ne peut PAS écrire les jetons', v, '');
  begin perform count(*) from vault.decrypted_secrets; v := false; exception when others then v := true; end;
  perform pg_temp.ok('un utilisateur connecté ne peut PAS lire Vault directement', v, '');
  reset role;
  set local role anon;
  begin perform public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000001', 'strava'); v := false; exception when others then v := true; end;
  perform pg_temp.ok('le rôle anonyme ne peut PAS lire les jetons', v, '');
  reset role;
  set local role service_role;
  perform pg_temp.ok('le serveur (service_role) peut lire les jetons', public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000001', 'strava') ->> 'access_token' = 'acc_new', '');
  reset role;
end $$;

-- ===== Suppression : le secret chiffré disparaît avec la connexion =====================================================
delete from public.connexions_app where user_id = 'aaaaaaaa-0000-4000-8000-000000000002';
select pg_temp.ok('déconnexion : le secret chiffré est supprimé avec la connexion', (select count(*) from vault.secrets) = 2, '');
delete from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select pg_temp.ok('suppression de compte : plus aucun secret chiffré', (select count(*) from vault.secrets) = 0, '');

-- ===== Phase 2a (Strava) puis 2b (Garmin) ===============================================================================
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-000000000003', 'c@test.invalid');
insert into public.connexions_app (user_id, app, access_token, refresh_token, expires_at) values ('aaaaaaaa-0000-4000-8000-000000000003', 'strava', 'c_acc', 'c_ref', now());
insert into public.connexions_app (user_id, app, access_token, expires_at, oauth1_token, oauth1_secret) values ('aaaaaaaa-0000-4000-8000-000000000003', 'garmin', 'cg_acc', now(), 'cg_o1', 'cg_o1s');
select public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'strava', '{}', null);
select public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'garmin', '{}', null);
\ir ../migrations/2026-10-14_jetons_vault_2a_purge_strava.sql
select pg_temp.ok('2a : le clair STRAVA est effacé', (select count(*) from public.connexions_app where app = 'strava' and (access_token is not null or refresh_token is not null)) = 0, '');
select pg_temp.ok('2a : le clair GARMIN reste (le Pi n''est pas encore à jour)', (select access_token = 'cg_acc' and oauth1_secret = 'cg_o1s' from public.connexions_app where app = 'garmin'), '');
select pg_temp.ok('2a : les jetons Strava restent lisibles via le coffre', public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'strava') = '{"access_token":"c_acc","refresh_token":"c_ref"}'::jsonb, '');
select public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'strava', '{"access_token":"c_new"}', null);
select pg_temp.ok('2a : une écriture Strava ne remet PAS de clair', (select access_token is null and refresh_token is null from public.connexions_app where app = 'strava'), '');
select pg_temp.ok('2a : l''écriture Strava est bien prise en compte', public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'strava') ->> 'access_token' = 'c_new', '');
select public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'garmin', '{"access_token":"cg_new"}', null);
select pg_temp.ok('2a : une écriture Garmin garde le clair à jour (ancien Pi)', (select access_token = 'cg_new' and oauth1_token = 'cg_o1' from public.connexions_app where app = 'garmin'), '');
create temp table _sid on commit drop as select secret_id from public.connexions_app where app = 'strava' and user_id = 'aaaaaaaa-0000-4000-8000-000000000003';
do $$ declare v boolean := false; begin
  update public.connexions_app set secret_id = null where app = 'strava';
  begin execute $q$do $z$ begin if exists (select 1 from public.connexions_app where app = 'strava' and secret_id is null) then raise exception 'garde-fou'; end if; end $z$ $q$; exception when others then v := true; end;
  perform pg_temp.ok('2a : le garde-fou refuse si un secret Strava manque', v, '');
end $$;
update public.connexions_app set secret_id = (select secret_id from _sid) where app = 'strava' and user_id = 'aaaaaaaa-0000-4000-8000-000000000003';
\ir ../proposals/jetons-vault/2b_purge_garmin.sql
select pg_temp.ok('2b : plus aucun jeton en clair, nulle part', (select count(*) from public.connexions_app where access_token is not null or refresh_token is not null or oauth1_token is not null or oauth1_secret is not null) = 0, '');
select pg_temp.ok('2b : les jetons Garmin restent lisibles via le coffre', public.rpc_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'garmin') = '{"access_token":"cg_new","oauth1_token":"cg_o1","oauth1_secret":"cg_o1s"}'::jsonb, '');
select public.rpc_save_connection_secrets('aaaaaaaa-0000-4000-8000-000000000003', 'garmin', '{"access_token":"cg_new2"}', null);
select pg_temp.ok('2b : une écriture Garmin ne remet PAS de clair', (select access_token is null and oauth1_secret is null from public.connexions_app where app = 'garmin'), '');
rollback;
select 'TOUS LES CONTRÔLES DES JETONS SONT PASSÉS' as resultat;
