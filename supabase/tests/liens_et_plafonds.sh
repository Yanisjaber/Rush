#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : liens vers une séance (SEC-4) et plafonds de stockage.
# Usage : bash supabase/tests/liens_et_plafonds.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../.."
H=supabase/proposals/db-v2/tests/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/tests/suppression_compte_decor.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
alter table public.activities add column streams_gz text;
create table public.user_profiles (user_id uuid primary key references auth.users(id) on delete cascade, extras jsonb default '{}'::jsonb);
alter table public.strength_sets enable row level security;
alter table public.hyrox_tests enable row level security;
create policy s_sel on public.strength_sets for select to authenticated using (auth.uid() = user_id);
create policy h_sel on public.hyrox_tests for select to authenticated using (auth.uid() = user_id);
create policy a_sel on public.activities for select to authenticated using (user_id = auth.uid());
alter table public.activities enable row level security;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
insert into public.activities (id, user_id, start_date_local, tss) values
  ('aaaaaaaa-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000000a', now(), 10),
  ('bbbbbbbb-0000-4000-8000-000000000001','00000000-0000-4000-8000-00000000000b', now(), 10);
insert into public.user_profiles (user_id) values ('00000000-0000-4000-8000-00000000000a');
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_liens_activite_et_droits.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_plafonds_stockage.sql
# relançable
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_liens_activite_et_droits.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-28_plafonds_stockage.sql
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
create or replace function pg_temp.essaie(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'accepté'; exception when others then return 'refusé'; end $$;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select 'lien vers SA séance (force)'            as controle, pg_temp.essaie($$insert into public.strength_sets (user_id, activity_id) values ('00000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001')$$) = 'accepté' as ok
union all select 'lien vers la séance d''un AUTRE (force)', pg_temp.essaie($$insert into public.strength_sets (user_id, activity_id) values ('00000000-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-000000000001')$$) = 'refusé'
union all select 'lien vers SA séance (hyrox)',            pg_temp.essaie($$insert into public.hyrox_tests (user_id, activity_id) values ('00000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001')$$) = 'accepté'
union all select 'lien vers la séance d''un AUTRE (hyrox)', pg_temp.essaie($$insert into public.hyrox_tests (user_id, activity_id) values ('00000000-0000-4000-8000-00000000000a','bbbbbbbb-0000-4000-8000-000000000001')$$) = 'refusé'
union all select 'sans séance liée (force)',               pg_temp.essaie($$insert into public.strength_sets (user_id) values ('00000000-0000-4000-8000-00000000000a')$$) = 'accepté'
union all select 'mise à jour vers la séance d''un AUTRE', pg_temp.essaie($$update public.strength_sets set activity_id = 'bbbbbbbb-0000-4000-8000-000000000001' where user_id = '00000000-0000-4000-8000-00000000000a'$$) <> 'accepté' or (select count(*) from public.strength_sets where activity_id = 'bbbbbbbb-0000-4000-8000-000000000001') = 0;
reset role;
-- plafonds : on abaisse le plafond de hyrox_tests à 3 pour tester sans insérer des milliers de lignes
drop trigger plafond_hyrox_tests on public.hyrox_tests;
create trigger plafond_hyrox_tests after insert on public.hyrox_tests referencing new table as nouvelles for each statement execute function public.trg_plafond_lignes(3);
delete from public.hyrox_tests;
select 'sous le plafond (3 lignes)' as controle, pg_temp.essaie($$insert into public.hyrox_tests (user_id) select '00000000-0000-4000-8000-00000000000a' from generate_series(1,3)$$) = 'accepté' as ok
union all select 'au-delà du plafond (4e ligne)', pg_temp.essaie($$insert into public.hyrox_tests (user_id) values ('00000000-0000-4000-8000-00000000000a')$$) = 'refusé'
union all select 'AUTRE compte non gêné', pg_temp.essaie($$insert into public.hyrox_tests (user_id) values ('00000000-0000-4000-8000-00000000000b')$$) = 'accepté'
union all select 'flux de 1,2 Mo refusé', pg_temp.essaie($$update public.activities set streams_gz = repeat('x', 1200000) where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$) = 'refusé'
union all select 'flux de 200 Ko accepté', pg_temp.essaie($$update public.activities set streams_gz = repeat('x', 200000) where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$) = 'accepté'
union all select 'extras de 150 Ko refusé', pg_temp.essaie($$update public.user_profiles set extras = jsonb_build_object('x', repeat('y', 150000))$$) = 'refusé';
SQL
bash $H stop >/dev/null 2>&1 || true
