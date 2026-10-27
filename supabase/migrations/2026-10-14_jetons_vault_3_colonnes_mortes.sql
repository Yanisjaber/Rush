-- ============================================================
-- Jetons des connexions : retrait des 4 colonnes en clair devenues inutiles (13/10/2026).
--
-- Depuis les phases 2a/2b du chantier Vault, plus aucun jeton n'est écrit dans `connexions_app.access_token`,
-- `refresh_token`, `oauth1_token`, `oauth1_secret` : elles sont vides (0 ligne remplie sur 2). Tous les jetons vivent dans
-- Vault (colonne `secret_id`), et les Edge Functions les lisent par `rpc_connection_secrets` (module `_shared/jetons.ts`).
--
-- Cette migration (idempotente) :
--   1. réécrit les deux fonctions de lecture / écriture des jetons sans le « repli en clair » et sans toucher ces colonnes ;
--   2. supprime les 4 colonnes.
-- Retour arrière : recréer les colonnes (text, nullables) ; les jetons sont intacts dans Vault.
-- ============================================================

-- Lecture : jetons déchiffrés (JSON) d'une connexion ; null si elle n'existe pas ; {} si elle n'a pas encore de secret
create or replace function public.rpc_connection_secrets(p_user_id uuid, p_app text) returns jsonb
language plpgsql security definer set search_path = public, vault as $$
declare v_secret_id uuid; v_secret text;
begin
  select secret_id into v_secret_id from public.connexions_app where user_id = p_user_id and app = p_app;
  if not found then return null; end if;
  if v_secret_id is not null then
    select ds.decrypted_secret into v_secret from vault.decrypted_secrets ds where ds.id = v_secret_id;
    if v_secret is not null then return v_secret::jsonb; end if;
  end if;
  return '{}'::jsonb;
end $$;

-- Écriture : fusionne avec les jetons existants et chiffre dans Vault (crée le secret au besoin)
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
  update public.connexions_app set secret_id = v_secret, expires_at = coalesce(p_expires_at, expires_at) where id = v_id;
end $$;

revoke all on function public.rpc_connection_secrets(uuid, text) from public, anon, authenticated;
revoke all on function public.rpc_save_connection_secrets(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.rpc_connection_secrets(uuid, text) to service_role;
grant execute on function public.rpc_save_connection_secrets(uuid, text, jsonb, timestamptz) to service_role;

-- Garde-fou : on ne supprime les colonnes que si elles sont toutes vides (sinon on s'arrête sans rien casser)
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'connexions_app' and column_name = 'access_token') then
    if exists (select 1 from public.connexions_app where access_token is not null or refresh_token is not null or oauth1_token is not null or oauth1_secret is not null) then
      raise exception 'jetons en clair encore présents : migration arrêtée (rien n''a été supprimé)';
    end if;
  end if;
end $$;

alter table public.connexions_app drop column if exists access_token;
alter table public.connexions_app drop column if exists refresh_token;
alter table public.connexions_app drop column if exists oauth1_token;
alter table public.connexions_app drop column if exists oauth1_secret;
