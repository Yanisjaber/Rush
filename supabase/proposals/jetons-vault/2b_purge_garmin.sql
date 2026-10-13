-- Jetons des connexions : PHASE 2b sur 2 — on EFFACE le clair restant (GARMIN). PROPOSITION : à lancer SEULEMENT quand le Pi est à jour et vérifié.
-- (La phase 2a, déjà appliquée, a effacé le clair de Strava : supabase/migrations/2026-10-14_jetons_vault_2a_purge_strava.sql.)
-- Prérequis : phases 1 et 2a appliquées ; le script du Raspberry Pi mis à jour (git pull) ; une synchro Garmin réussie APRÈS cette mise à jour.
-- Relançable sans risque. Quand c'est appliqué, déplacer ce fichier dans supabase/migrations/.

-- 1. L'écriture double s'arrête : plus aucun jeton en clair n'est écrit
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
  update public.connexions_app set secret_id = v_secret, expires_at = coalesce(p_expires_at, expires_at),
    access_token = null, refresh_token = null, oauth1_token = null, oauth1_secret = null
  where id = v_id;
end $$;

-- 2. Garde-fou : on refuse d'effacer si une connexion n'a pas encore son secret chiffré
do $$
begin
  if exists (select 1 from public.connexions_app where secret_id is null) then
    raise exception 'Une connexion n''a pas de secret chiffré : phase 2 annulée (rien n''a été effacé).';
  end if;
end $$;

-- 3. Effacement du clair
update public.connexions_app set access_token = null, refresh_token = null, oauth1_token = null, oauth1_secret = null
where secret_id is not null and (access_token is not null or refresh_token is not null or oauth1_token is not null or oauth1_secret is not null);

-- 4. Contrôle : doit renvoyer 0 ligne en clair
--   select count(*) as jetons_encore_en_clair from public.connexions_app where access_token is not null or refresh_token is not null or oauth1_token is not null or oauth1_secret is not null;
