-- Retrait de Whoop : la table whoop_data (vide) disparaît et les états OAuth
-- ne concernent plus que Strava.

drop table if exists public.whoop_data;
drop table if exists public.whoop_connections;

delete from public.oauth_states where provider = 'whoop';
delete from public.connexions_app where app = 'whoop';

alter table public.oauth_states drop constraint if exists oauth_states_provider_check;
alter table public.oauth_states add constraint oauth_states_provider_check check (provider in ('strava'));
