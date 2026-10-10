-- État OAuth à usage unique (Strava / Whoop).
-- Remplace le JWT Supabase qui voyageait dans le paramètre `state` de l'URL.
-- Écrit par la fonction `oauth-start`, consommé (supprimé) par les callbacks.
-- Aucune policy : seules les Edge Functions (service_role) y accèdent.

create table if not exists public.oauth_states (
  state       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  provider    text not null check (provider in ('strava', 'whoop')),
  return_url  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists oauth_states_created_at_idx on public.oauth_states (created_at);

alter table public.oauth_states enable row level security;

revoke all on public.oauth_states from anon, authenticated;
