#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la LTHR déduite des sorties quand le profil n'en a pas (TSS cardio des sorties sans capteur).
# Usage : bash supabase/tests/sql/lthr_deduite.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  strava_id bigint, name text, sport text, start_date_local timestamptz, merged_into uuid,
  tss integer, np integer, avg_watts integer, avg_heartrate integer, max_heartrate integer, moving_time integer, elapsed_time integer,
  excl_power boolean, excl_hr boolean, excl_load boolean, excl_duration boolean,
  device_watts boolean, power_curve jsonb, ftp_at_time integer, intensity numeric
);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, tss numeric, ctl numeric, atl numeric, tsb numeric, duration_min numeric, activity_count integer, primary key (user_id, iso_date));
create table public.user_profiles (user_id uuid primary key references auth.users(id) on delete cascade, ftp integer, hr_max integer, lthr integer);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t'), ('00000000-0000-4000-8000-00000000000c','c@t');
-- A : ni LTHR ni FC max. B : ni LTHR ni FC max, mais seulement 10 sorties avec une FC max (trop peu). C : une LTHR de 160 au profil.
insert into public.user_profiles (user_id, ftp, hr_max, lthr) values ('00000000-0000-4000-8000-00000000000a', null, null, null), ('00000000-0000-4000-8000-00000000000b', null, null, null), ('00000000-0000-4000-8000-00000000000c', null, null, 160);

-- A : 30 sorties avec une FC max de 190 (+ une valeur aberrante de 254 qui ne doit pas compter) → 98e centile = 190 → LTHR = round(0,92 × 190) = 175.
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, max_heartrate, moving_time, ftp_at_time, tss)
select '00000000-0000-4000-8000-00000000000a', 100 + i, 'a fond ' || i, 'Ride', current_date - 400 - i, false, 150, 120, 190, 3600, 230, 50 from generate_series(1, 30) i;
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, max_heartrate, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000a', 200, 'a aberrante', 'Ride', current_date - 300, false, 150, 120, 254, 3600, 230, 50),
 -- les sorties testées : watts estimés (device_watts faux) et un vieux TSS tiré d'eux
 ('00000000-0000-4000-8000-00000000000a', 201, 'a1 sans capteur, FC 150', 'Ride', current_date - 20, false, 220, 150, 175, 3600, 230, 130),
 ('00000000-0000-4000-8000-00000000000a', 202, 'a2 sans capteur, FC 175 (à la LTHR)', 'Ride', current_date - 19, false, 200, 175, 185, 7200, 230, 240);
-- B : 10 sorties avec une FC max seulement : pas de LTHR déduite : les sorties gardent leur TSS
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, max_heartrate, moving_time, ftp_at_time, tss)
select '00000000-0000-4000-8000-00000000000b', 300 + i, 'b ' || i, 'Ride', current_date - 100 - i, false, 150, 140, 190, 3600, 230, 77 from generate_series(1, 10) i;
-- C : une LTHR de 160 au profil, une sortie sans capteur, FC 144 → (144 / 160)² = 81
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, max_heartrate, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000c', 400, 'c1 profil avec LTHR', 'Ride', current_date - 10, false, 150, 144, 190, 3600, 230, 40);

grant select on public.activities, public.daily_metrics to authenticated;
create function public.trg_recalc_daily_metrics() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  for u in select distinct user_id from changed_rows where user_id is not null loop
    perform public.recalc_daily_metrics(u);
  end loop;
  return null;
end;
$$;
create trigger activities_recalc_metrics_upd after update on public.activities referencing new table as changed_rows for each statement execute function public.trg_recalc_daily_metrics();
SQL
sed -n '/^create or replace function public.tss_retenu/,/^\$\$;/p' supabase/migrations/2026-11-02_duree_ecartable.sql > /tmp/tss_retenu_test.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f /tmp/tss_retenu_test.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_forme_jusqua_aujourdhui.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_ftp_glissante.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_tss_plausible.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_ftp_fenetre_90.sql
bash $H psql -d rush -At -c "select 'AVANT (sans LTHR déduite) : a1 garde ' || tss from public.activities where name like 'a1 %'"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_lthr_deduite.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_lthr_deduite.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
select controle, ok from (
select 1 as n, 'a1 : LTHR déduite = 0,92 × 190 = 175 (la FC aberrante de 254 est ignorée) : (150 / 175)² = 73, au lieu des 130 tirés des watts estimés' as controle, (select tss = 73 from public.activities where name like 'a1 %') as ok
union all select 2, 'a2 : à la LTHR pendant 2 h : (175 / 175)² × 2 h = 200 (et pas le 240 des watts estimés)', (select tss = 200 from public.activities where name like 'a2 %')
union all select 3, 'B : seulement 10 sorties avec une FC max (moins de 20) : pas de LTHR déduite, les sorties gardent leur TSS (77)', (select bool_and(tss = 77) from public.activities where user_id = '00000000-0000-4000-8000-00000000000b')
union all select 4, 'C : une LTHR au profil (160) n''est pas remplacée : (144 / 160)² = 81', (select tss = 81 from public.activities where name like 'c1 %')
union all select 5, 'relançable : une 2e passe ne modifie plus rien', (select public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000a') = 0 and public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000b') = 0 and public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000c') = 0)
union all select 6, 'seul le service peut lancer le recalcul (ni anon ni un utilisateur)', (select not has_function_privilege('authenticated', 'public.recalc_ftp_tss(uuid)', 'execute') and not has_function_privilege('anon', 'public.recalc_ftp_tss(uuid)', 'execute'))
) t order by n;
SQL
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
