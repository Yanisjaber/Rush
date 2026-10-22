-- Cycles d'entraînement : des périodes que l'utilisateur crée (« Bloc force », « Prépa spécifique », « Affûtage »…) avec un nom, des dates et une couleur.
-- Le calendrier les affiche en bandes de couleur sous chaque jour concerné.
-- Relançable sans risque. À appliquer à la main : supabase db query --linked -f supabase/migrations/2026-10-22_training_cycles.sql
--
-- Règles :
--   - une période : de from_date à to_date (inclus), 366 jours au plus ;
--   - AU PLUS DEUX cycles le même jour (le calendrier n'a la place que pour deux bandes) : un déclencheur le garantit, même si l'app est contournée ;
--   - couleur : #rrggbb ; nom : 1 à 60 caractères ;
--   - sport : facultatif (null = le cycle concerne tous les sports), sinon l'un des sports de l'app.
--
-- Sécurité :
--   - RLS activée : chacun ne lit et n'écrit que ses propres lignes (auth.uid() = user_id). Aucun accès anonyme.
--   - Tous les textes et dates sont bornés. Le contenu n'est jamais exécuté : l'app l'affiche en texte.
--   - Les lignes disparaissent avec le compte (on delete cascade).

create table if not exists public.training_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  from_date date not null,
  to_date date not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sport text,
  created_at timestamptz not null default now(),
  constraint training_cycles_dates check (to_date >= from_date and to_date - from_date <= 366)
);

-- Le sport (colonne ajoutée aussi pour une table déjà créée sans lui) : null ou un sport connu de l'app
alter table public.training_cycles add column if not exists sport text;
alter table public.training_cycles drop constraint if exists training_cycles_sport;
alter table public.training_cycles add constraint training_cycles_sport
  check (sport is null or sport in ('course', 'velo', 'natation', 'muscu', 'hyrox', 'triathlon', 'duathlon', 'autre'));

create index if not exists training_cycles_user_from_idx on public.training_cycles (user_id, from_date);

-- Au plus deux cycles le même jour : un jour du cycle écrit ne doit pas déjà être couvert par deux autres cycles du même utilisateur.
create or replace function public.trg_training_cycles_max2()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if exists (
    select 1
    from generate_series(new.from_date, new.to_date, interval '1 day') as g(jour)
    where (
      select count(*) from public.training_cycles c
      where c.user_id = new.user_id and c.id <> new.id and c.from_date <= g.jour::date and c.to_date >= g.jour::date
    ) >= 2
  ) then
    raise exception 'training_cycles : au plus deux cycles le même jour' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists training_cycles_max2 on public.training_cycles;
create trigger training_cycles_max2
  before insert or update of user_id, from_date, to_date on public.training_cycles
  for each row execute function public.trg_training_cycles_max2();

alter table public.training_cycles enable row level security;

drop policy if exists training_cycles_select_own on public.training_cycles;
create policy training_cycles_select_own on public.training_cycles for select to authenticated using (auth.uid() = user_id);

drop policy if exists training_cycles_insert_own on public.training_cycles;
create policy training_cycles_insert_own on public.training_cycles for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists training_cycles_update_own on public.training_cycles;
create policy training_cycles_update_own on public.training_cycles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists training_cycles_delete_own on public.training_cycles;
create policy training_cycles_delete_own on public.training_cycles for delete to authenticated using (auth.uid() = user_id);

revoke all on public.training_cycles from public, anon;
grant select, insert, update, delete on public.training_cycles to authenticated;
