#!/bin/bash
# Test LOCAL (Postgres jetable) : le compte de démo ne peut rien écrire ; un autre compte écrit normalement ; les deux lisent leurs propres lignes.
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
DEMO=7b0e2f4a-5d3c-4e8a-9a61-2c4f8d1e6b90
AUTRE=00000000-0000-4000-8000-00000000000a
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<SQL
create table public.activities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), name text);
create table public.yearly_goals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), year int);
create table public.sans_utilisateur (id int);
alter table public.activities enable row level security;
alter table public.yearly_goals enable row level security;
create policy a_lire on public.activities for select to authenticated using (auth.uid() = user_id);
create policy a_ecrire on public.activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy g_lire on public.yearly_goals for select to authenticated using (auth.uid() = user_id);
create policy g_ecrire on public.yearly_goals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.activities, public.yearly_goals to authenticated;
insert into auth.users (id, email) values ('$DEMO', 'demo@test'), ('$AUTRE', 'autre@test');
insert into public.activities (user_id, name) values ('$DEMO', 'séance démo'), ('$AUTRE', 'séance autre');
SQL
echo "== la règle, deux fois (relançable)"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-05_compte_demo_lecture_seule.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-05_compte_demo_lecture_seule.sql
echo "== le compte de démo : lit, mais ne peut ni ajouter, ni modifier, ni supprimer"
bash $H psql -d rush -v ON_ERROR_STOP=0 <<SQL
set role authenticated;
set request.jwt.claim.sub = '$DEMO';
select 'démo lit sa ligne' as controle, count(*) = 1 as ok from public.activities;
insert into public.activities (user_id, name) values ('$DEMO', 'nouvelle');
update public.activities set name = 'modifiée' where user_id = '$DEMO';
delete from public.activities where user_id = '$DEMO';
insert into public.yearly_goals (user_id, year) values ('$DEMO', 2026);
select 'démo : rien n''a changé' as controle, count(*) = 1 and bool_and(name = 'séance démo') as ok from public.activities;
select 'démo : aucun objectif ajouté' as controle, count(*) = 0 as ok from public.yearly_goals;
SQL
echo "== un autre compte : écrit normalement"
bash $H psql -d rush -v ON_ERROR_STOP=1 <<SQL
set role authenticated;
set request.jwt.claim.sub = '$AUTRE';
insert into public.activities (user_id, name) values ('$AUTRE', 'ajoutée');
update public.activities set name = 'renommée' where user_id = '$AUTRE' and name = 'ajoutée';
insert into public.yearly_goals (user_id, year) values ('$AUTRE', 2026);
select 'autre compte : ajout et modification' as controle, count(*) = 2 and bool_or(name = 'renommée') as ok from public.activities;
select 'autre compte : ne voit pas la démo' as controle, count(*) = 0 as ok from public.activities where user_id = '$DEMO';
select 'autre compte : objectif ajouté' as controle, count(*) = 1 as ok from public.yearly_goals;
SQL
