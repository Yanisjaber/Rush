-- Disposition de l'accueil v2 : quels widgets, dans quel ordre, quelle taille (une ligne par utilisateur).
-- Relançable sans risque. À appliquer à la main dans le SQL Editor Supabase.
--
-- Sécurité :
--   - RLS : chacun ne lit et n'écrit que sa propre ligne (auth.uid() = user_id).
--   - Aucun accès anonyme.
--   - Taille du JSON plafonnée (16 Ko) : pas de stockage détourné.
--   - Le contenu n'est jamais exécuté : le front ne garde que des identifiants de widgets connus
--     et des tailles valides (voir v2/src/lib/widgets/registre.js, fonction normaliser).

create table if not exists public.user_dashboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  layout jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_dashboard_layout_taille check (pg_column_size(layout) < 16384)
);

alter table public.user_dashboard enable row level security;

drop policy if exists "user_dashboard_select_own" on public.user_dashboard;
create policy "user_dashboard_select_own" on public.user_dashboard
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_dashboard_insert_own" on public.user_dashboard;
create policy "user_dashboard_insert_own" on public.user_dashboard
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_dashboard_update_own" on public.user_dashboard;
create policy "user_dashboard_update_own" on public.user_dashboard
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_dashboard_delete_own" on public.user_dashboard;
create policy "user_dashboard_delete_own" on public.user_dashboard
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.user_dashboard from public, anon;
grant select, insert, update, delete on public.user_dashboard to authenticated;
