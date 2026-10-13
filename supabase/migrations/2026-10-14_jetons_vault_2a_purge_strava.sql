-- Jetons des connexions : PHASE 2a sur 2 — on EFFACE le clair des jetons STRAVA. Relançable sans risque.
--
-- Pourquoi seulement Strava : toutes les Edge Functions qui lisent les jetons Strava passent désormais par le coffre (vérifié et déployé le
-- 13/10/2026 : synchro complète, tours, courbes). Seul le Raspberry Pi (Garmin) a encore l'ancien code tant qu'il n'a pas fait `git pull` :
-- le clair Garmin reste donc en place (phase 2b : supabase/proposals/jetons-vault/2b_purge_garmin.sql).
--
-- Après cette migration, `rpc_save_connection_secrets` n'écrit plus de clair pour Strava (il continue pour Garmin, jusqu'à la phase 2b).

-- 1. Garde-fou : on refuse si une connexion Strava n'a pas son secret chiffré
do $$
begin
  if exists (select 1 from public.connexions_app where app = 'strava' and secret_id is null) then
    raise exception 'Une connexion Strava n''a pas de secret chiffré : phase 2a annulée (rien n''a été effacé).';
  end if;
end $$;

-- 2. L'écriture double s'arrête pour Strava
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
    -- clair : plus jamais pour Strava ; encore tenu à jour pour Garmin tant que le Pi n'est pas à jour (phase 2b)
    access_token  = case when p_app = 'strava' then null else v_payload ->> 'access_token' end,
    refresh_token = case when p_app = 'strava' then null else v_payload ->> 'refresh_token' end,
    oauth1_token  = case when p_app = 'strava' then null else v_payload ->> 'oauth1_token' end,
    oauth1_secret = case when p_app = 'strava' then null else v_payload ->> 'oauth1_secret' end
  where id = v_id;
end $$;

-- 3. Effacement du clair Strava
update public.connexions_app set access_token = null, refresh_token = null, oauth1_token = null, oauth1_secret = null
where app = 'strava' and secret_id is not null;
