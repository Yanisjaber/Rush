-- ============================================================
-- Numéro de dossard (14/11/2026) : chaque compte reçoit un numéro, dans l'ordre d'inscription (1, 2, 3…).
-- Affiché une fois, à l'activation du compte dans l'app (« Bienvenue, dossard n° 0042 »), puis dans le profil.
--
-- Sécurité (« qui peut lire ou modifier ça ? ») : RLS activée, le compte lit SA ligne seulement, personne ne peut
-- écrire depuis l'app (la ligne est créée par un déclencheur à l'inscription). Aucun accès anonyme.
-- Supprimée avec le compte (cascade). Un numéro n'est jamais réattribué : la suite continue après une suppression.
-- Idempotente : on peut la rejouer.
-- ============================================================

create sequence if not exists public.dossard_numero_seq;

create table if not exists public.dossards (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  numero     integer not null unique default nextval('public.dossard_numero_seq'),
  created_at timestamptz not null default now()
);

alter table public.dossards enable row level security;
revoke all on public.dossards from anon, authenticated;
grant select on public.dossards to authenticated;
drop policy if exists dossards_select_own on public.dossards;
create policy dossards_select_own on public.dossards for select using (auth.uid() = user_id);

-- Les comptes déjà là reçoivent leur numéro dans l'ordre de leur inscription
insert into public.dossards (user_id)
select u.id from auth.users u
where not exists (select 1 from public.dossards d where d.user_id = u.id)
order by u.created_at, u.id;

-- Un nouveau compte reçoit son numéro tout de suite
create or replace function public.attribuer_dossard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.dossards (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.attribuer_dossard() from public, anon, authenticated;

drop trigger if exists attribuer_dossard_inscription on auth.users;
create trigger attribuer_dossard_inscription after insert on auth.users
  for each row execute function public.attribuer_dossard();
