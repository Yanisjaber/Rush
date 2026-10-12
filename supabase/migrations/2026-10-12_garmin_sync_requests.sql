-- Demandes de synchro Garmin « à la demande » (bouton Synchroniser de l'appli).
-- Relançable sans risque.
--
-- Principe : Garmin refuse les serveurs (Supabase, GitHub), donc la synchro tourne
-- sur un Raspberry Pi chez toi. L'appli ne peut pas l'appeler directement : elle
-- écrit une ligne 'pending' ici, le Pi la lit (cron chaque minute, requête sortante
-- uniquement : aucun port ouvert), synchronise, puis marque 'done' ou 'error'.
--
-- Sécurité :
--   - RLS : chacun ne lit et ne crée que ses propres demandes.
--   - Le navigateur ne peut insérer QUE user_id : status, résultat et dates sont
--     posés par la base ou par le Pi (service_role). Pas d'UPDATE ni de DELETE côté
--     navigateur, donc impossible de truquer un résultat.
--   - Une seule demande active par utilisateur (index unique partiel) : pas de spam.

create table if not exists public.garmin_sync_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'error')),
  requested_at timestamptz not null default now(),
  finished_at timestamptz,
  nights integer,
  error text
);

-- Une seule demande en attente ou en cours par utilisateur.
create unique index if not exists uniq_garmin_sync_requests_active
  on public.garmin_sync_requests (user_id)
  where status in ('pending', 'running');

create index if not exists idx_garmin_sync_requests_user
  on public.garmin_sync_requests (user_id, requested_at desc);

alter table public.garmin_sync_requests enable row level security;

drop policy if exists "garmin_sync_requests_select_own" on public.garmin_sync_requests;
create policy "garmin_sync_requests_select_own" on public.garmin_sync_requests
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "garmin_sync_requests_insert_own" on public.garmin_sync_requests;
create policy "garmin_sync_requests_insert_own" on public.garmin_sync_requests
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Droits de table : lecture, et insertion de la seule colonne user_id.
revoke all on public.garmin_sync_requests from public, anon, authenticated;
grant select on public.garmin_sync_requests to authenticated;
grant insert (user_id) on public.garmin_sync_requests to authenticated;

-- Arrêt de l'ancienne synchro horaire (Edge Function garmin-ingest, supprimée du code).
-- Sans effet si pg_cron n'est pas installé ou si le job n'existe plus.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where command ilike '%garmin-ingest%';
  end if;
end $$;
