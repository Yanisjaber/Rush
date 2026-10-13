-- Jetons des connexions (Strava, Garmin) : chiffrés dans Supabase Vault. PHASE 1 sur 2 : AJOUT, sans aucune coupure.
-- Relançable sans risque. À appliquer à la main : supabase db query --linked -f supabase/migrations/2026-10-14_jetons_vault_1_ajout.sql
--
-- Principe
--   * `connexions_app.secret_id` pointe vers un secret chiffré de Vault qui contient les jetons (JSON) ;
--   * deux fonctions réservées au serveur (service_role) lisent et écrivent ces jetons : rpc_connection_secrets, rpc_save_connection_secrets ;
--   * PENDANT LA TRANSITION, l'ancien emplacement (colonnes en clair) reste tenu à jour et sert de repli en lecture :
--     les anciennes versions des Edge Functions et du script du Raspberry Pi continuent donc de fonctionner ;
--   * la PHASE 2 (supabase/proposals/jetons-vault/2_purge.sql) efface le clair, une fois tout redéployé et vérifié.
--
-- Sécurité : fonctions SECURITY DEFINER, `search_path` figé, EXECUTE retiré à public/anon/authenticated. Le navigateur ne lit toujours
-- aucune colonne de jeton (droits par colonne inchangés) et ne voit pas non plus `secret_id`.

alter table public.connexions_app add column if not exists secret_id uuid;
alter table public.connexions_app alter column access_token drop not null;   -- nécessaire pour pouvoir effacer le clair en phase 2

-- Lecture : jetons déchiffrés (JSON) d'une connexion, ou null si elle n'existe pas
create or replace function public.rpc_connection_secrets(p_user_id uuid, p_app text) returns jsonb
language plpgsql security definer set search_path = public, vault as $$
declare v_row public.connexions_app%rowtype; v_secret text;
begin
  select * into v_row from public.connexions_app where user_id = p_user_id and app = p_app;
  if not found then return null; end if;
  if v_row.secret_id is not null then
    select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.id = v_row.secret_id;
    if v_secret is not null then return v_secret::jsonb; end if;
  end if;
  -- repli de transition : anciens jetons en clair
  return jsonb_strip_nulls(jsonb_build_object('access_token', v_row.access_token, 'refresh_token', v_row.refresh_token,
                                              'oauth1_token', v_row.oauth1_token, 'oauth1_secret', v_row.oauth1_secret));
end $$;

-- Écriture : FUSIONNE avec les jetons existants (un renouvellement Strava ne renvoie pas toujours tous les champs), chiffre dans Vault,
-- et met à jour la date d'expiration. Phase 1 : écrit aussi l'ancien emplacement (écriture double).
create or replace function public.rpc_save_connection_secrets(p_user_id uuid, p_app text, p_payload jsonb, p_expires_at timestamptz default null) returns void
language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid; v_secret uuid; v_payload jsonb;
begin
  select id, secret_id into v_id, v_secret from public.connexions_app where user_id = p_user_id and app = p_app for update;
  if v_id is null then raise exception 'connexion inconnue'; end if;
  v_payload := coalesce(public.rpc_connection_secrets(p_user_id, p_app), '{}'::jsonb) || jsonb_strip_nulls(coalesce(p_payload, '{}'::jsonb));
  if v_secret is null then
    v_secret := vault.create_secret(v_payload::text, 'connexion:' || v_id::text, 'Jetons ' || p_app);
  else
    perform vault.update_secret(v_secret, v_payload::text);
  end if;
  update public.connexions_app set
    secret_id     = v_secret,
    expires_at    = coalesce(p_expires_at, expires_at),
    access_token  = v_payload ->> 'access_token',
    refresh_token = v_payload ->> 'refresh_token',
    oauth1_token  = v_payload ->> 'oauth1_token',
    oauth1_secret = v_payload ->> 'oauth1_secret'
  where id = v_id;
end $$;

-- Quand une connexion disparaît (déconnexion, suppression de compte), son secret chiffré disparaît avec elle
create or replace function public.trg_connexions_delete_secret() returns trigger
language plpgsql security definer set search_path = public, vault as $$
begin
  if old.secret_id is not null then delete from vault.secrets where id = old.secret_id; end if;
  return old;
end $$;
drop trigger if exists connexions_app_delete_secret on public.connexions_app;
create trigger connexions_app_delete_secret after delete on public.connexions_app for each row execute function public.trg_connexions_delete_secret();

revoke all on function public.rpc_connection_secrets(uuid, text) from public, anon, authenticated;
revoke all on function public.rpc_save_connection_secrets(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.trg_connexions_delete_secret() from public, anon, authenticated;
grant execute on function public.rpc_connection_secrets(uuid, text) to service_role;
grant execute on function public.rpc_save_connection_secrets(uuid, text, jsonb, timestamptz) to service_role;

-- Les connexions existantes : leurs jetons actuels sont chiffrés dans Vault (le clair reste en place jusqu'à la phase 2)
do $$
declare r record;
begin
  for r in select user_id, app from public.connexions_app where secret_id is null loop
    perform public.rpc_save_connection_secrets(r.user_id, r.app, '{}'::jsonb, null);
  end loop;
end $$;
