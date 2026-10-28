#!/bin/bash
# Test LOCAL (Postgres jetable) du renommage user_dashboard -> user_preferences + colonne theme + RLS.
set -e
cd "$(dirname "$0")/../../.."
H=supabase/proposals/db-v2/tests/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.user_dashboard (user_id uuid primary key references auth.users(id) on delete cascade, layout jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), constraint user_dashboard_layout_taille check (pg_column_size(layout) < 16384));
alter table public.user_dashboard enable row level security;
create policy user_dashboard_select_own on public.user_dashboard for select using (auth.uid() = user_id);
create policy user_dashboard_insert_own on public.user_dashboard for insert with check (auth.uid() = user_id);
create policy user_dashboard_update_own on public.user_dashboard for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_dashboard_delete_own on public.user_dashboard for delete using (auth.uid() = user_id);
revoke all on public.user_dashboard from anon, authenticated;
grant select, insert, update, delete on public.user_dashboard to authenticated;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001','a@test'), ('00000000-0000-4000-8000-000000000002','b@test');
insert into public.user_dashboard (user_id, layout) values ('00000000-0000-4000-8000-000000000001', '{"v":1,"auto":false,"widgets":[{"id":"charge","taille":"m"}]}');
SQL
echo "== migration deux fois (idempotente), puis colonne sports deux fois"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences_sports.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences_sports.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences_sports_liste.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences_sports_liste.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences_disciplines.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-14_user_preferences_disciplines.sql
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
-- comme le navigateur : rôle authenticated + identité de l'utilisateur A
select 'ancienne table renommée' as controle, to_regclass('public.user_dashboard') is null and to_regclass('public.user_preferences') is not null as ok
union all select 'la disposition existante est conservée', (select layout->>'auto' = 'false' from public.user_preferences where user_id='00000000-0000-4000-8000-000000000001')
union all select '4 règles RLS renommées', (select count(*) from pg_policies where tablename='user_preferences' and policyname like 'user_preferences_%_own') = 4
union all select 'plus aucune règle à l''ancien nom', (select count(*) from pg_policies where tablename='user_preferences' and policyname like 'user_dashboard%') = 0
union all select 'contrainte de taille renommée', exists (select 1 from pg_constraint where conname='user_preferences_layout_taille')
union all select 'colonne theme présente (null par défaut)', (select theme is null from public.user_preferences where user_id='00000000-0000-4000-8000-000000000001');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
insert into public.user_preferences (user_id, theme) values ('00000000-0000-4000-8000-000000000002', 'clair') on conflict (user_id) do update set theme = excluded.theme;
select 'B enregistre son thème (upsert sans layout)' as controle, (select theme = 'clair' and layout = '{}'::jsonb from public.user_preferences where user_id='00000000-0000-4000-8000-000000000002') as ok
union all select 'B ne voit PAS la ligne de A', (select count(*) = 0 from public.user_preferences where user_id='00000000-0000-4000-8000-000000000001')
union all select 'B ne voit que 1 ligne en tout', (select count(*) = 1 from public.user_preferences);
do $$ begin
  begin insert into public.user_preferences (user_id, theme) values ('00000000-0000-4000-8000-000000000001', 'clair'); raise exception 'devait échouer (écrire chez A)';
  exception when insufficient_privilege or others then if sqlstate not in ('42501') then raise; end if; end;
  raise notice 'ok : B ne peut pas écrire la ligne de A';
  begin update public.user_preferences set theme = 'violet' where user_id='00000000-0000-4000-8000-000000000002'; raise exception 'devait échouer (thème invalide)';
  exception when check_violation then null; end;
  raise notice 'ok : un thème invalide est refusé';
end $$;
reset role;
-- Sports choisis : mêmes droits que le navigateur
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
insert into public.user_preferences (user_id, sports) values ('00000000-0000-4000-8000-000000000002', '["course","muscu"]') on conflict (user_id) do update set sports = excluded.sports;
select 'B enregistre ses sports sans toucher à son thème ni à sa disposition' as controle, (select sports = '["course","muscu"]'::jsonb and theme = 'clair' and layout = '{}'::jsonb from public.user_preferences where user_id='00000000-0000-4000-8000-000000000002') as ok
union all select 'B ne voit pas les sports de A', (select count(*) = 0 from public.user_preferences where user_id = '00000000-0000-4000-8000-000000000001');
do $$ begin
  begin update public.user_preferences set sports = '{"a":1}' where user_id='00000000-0000-4000-8000-000000000002'; raise exception 'devait échouer (objet)';
  exception when check_violation then null; end;
  update public.user_preferences set sports = '["course","trail","velo","vtt","natation","triathlon","muscu","hyrox","crossfit","aviron","ski","combat","rando","escalade","pagaie"]' where user_id='00000000-0000-4000-8000-000000000002'; -- les 15 sports : autorisé
  begin update public.user_preferences set sports = (select jsonb_agg('s' || i) from generate_series(1, 21) i) where user_id='00000000-0000-4000-8000-000000000002'; raise exception 'devait échouer (21 sports)';
  exception when check_violation then null; end;
  begin update public.user_preferences set sports = to_jsonb(repeat('x', 1100)) where user_id='00000000-0000-4000-8000-000000000002'; raise exception 'devait échouer (texte)';
  exception when check_violation then null; end;
  update public.user_preferences set sports = null where user_id='00000000-0000-4000-8000-000000000002'; -- null = jamais demandé : autorisé
  update public.user_preferences set sports = '[]' where user_id='00000000-0000-4000-8000-000000000002'; -- vide = demandé sans rien choisir : autorisé
  -- disciplines : un objet par sport ; un tableau ou un texte sont refusés, ainsi qu'un objet trop gros
  update public.user_preferences set disciplines = '{"athletisme":["100m","hauteur"]}' where user_id='00000000-0000-4000-8000-000000000002';
  begin update public.user_preferences set disciplines = '["100m"]' where user_id='00000000-0000-4000-8000-000000000002'; raise exception 'devait échouer (tableau)';
  exception when check_violation then null; end;
  begin update public.user_preferences set disciplines = jsonb_build_object('athletisme', to_jsonb(repeat('x', 2200))) where user_id='00000000-0000-4000-8000-000000000002'; raise exception 'devait échouer (trop gros)';
  exception when check_violation then null; end;
  update public.user_preferences set disciplines = null where user_id='00000000-0000-4000-8000-000000000002';
  raise notice 'ok : disciplines (objet) acceptées, tableau et trop gros refusés';
  raise notice 'ok : sports invalides refusés (objet, plus de 20, trop gros), les 15 sports acceptés, null et [] acceptés';
end $$;
reset role;
SQL
