#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : la FTP d'une sortie se lit dans une fenêtre de ±90 jours (puis ±180, puis ±365).
# Usage : bash supabase/tests/sql/ftp_fenetre_90.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  strava_id bigint, name text, sport text, start_date_local timestamptz, merged_into uuid,
  tss integer, np integer, avg_watts integer, avg_heartrate integer, moving_time integer, elapsed_time integer,
  excl_power boolean, excl_hr boolean, excl_load boolean, excl_duration boolean,
  device_watts boolean, power_curve jsonb, ftp_at_time integer, intensity numeric
);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, tss numeric, ctl numeric, atl numeric, tsb numeric, duration_min numeric, activity_count integer, primary key (user_id, iso_date));
create table public.user_profiles (user_id uuid primary key references auth.users(id) on delete cascade, ftp integer, hr_max integer, lthr integer);
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t');
insert into public.user_profiles (user_id, ftp, hr_max, lthr) values ('00000000-0000-4000-8000-00000000000a', null, null, null);

-- Deux vrais efforts de 20 min : un faible (220 W) il y a 110 jours, un fort (300 W) il y a 40 jours, un très ancien (280 W) il y a 700 jours.
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, power_curve, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000a', 1, 'effort faible', 'Ride', current_date - 110, true, '{"1200": 220}', 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 2, 'effort fort', 'Ride', current_date - 40, true, '{"1200": 300}', 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 3, 'effort ancien', 'Ride', current_date - 700, true, '{"1200": 280}', 3600, 300, 50);
-- Les sorties à recalculer (NP 200, 1 h) :
--   s1 il y a 100 j : à 10 j de l'effort faible, à 60 j de l'effort fort. Avant (±45) : 220 seul → FTP 209. Maintenant (±90) : les deux → 300 → FTP 285.
--   s2 il y a 300 j : aucun effort à moins de 180 j (le plus proche, l'effort faible, est à 190 j). Avant : rien, la sortie gardait son TSS. Maintenant (±365) : 95 % de 300 ou 220 ?
--      l'effort faible est à 190 j, l'effort fort à 260 j, l'effort ancien à 400 j (hors) → 300 → FTP 285.
--   s3 il y a 1200 j : aucun effort à moins de 365 j (l'effort ancien est à 500 j) → rien ne change.
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000a', 11, 's1 fenêtre ±90', 'Ride', current_date - 100, true, 200, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 12, 's2 fenêtre ±365', 'Ride', current_date - 300, true, 200, 3600, 300, 50),
 ('00000000-0000-4000-8000-00000000000a', 13, 's3 aucun effort', 'Ride', current_date - 1200, true, 200, 3600, 300, 50);
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
bash $H psql -d rush -At -c "select 'AVANT (±45 / ±90 / ±180) : s1 FTP ' || ftp_at_time || ', s2 ' || (select ftp_at_time from public.activities where name like 's2 %') from public.activities where name like 's1 %'"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_ftp_fenetre_90.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_ftp_fenetre_90.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
select controle, ok from (
select 1 as n, 's1 : un effort fort à 60 j compte maintenant (±90) : FTP 285 au lieu de 209, TSS 49 au lieu de 70' as controle, (select (ftp_at_time, tss) = (285, 49) from public.activities where name like 's1 %') as ok
union all select 2, 's2 : aucun effort à moins de 180 j, mais un à 260 j (±365) : FTP 285', (select ftp_at_time = 285 from public.activities where name like 's2 %')
union all select 3, 's3 : aucun effort à moins de 365 j : rien ne change (FTP 300, TSS 50)', (select (ftp_at_time, tss) = (300, 50) from public.activities where name like 's3 %')
union all select 4, 'relançable : une 2e passe ne modifie plus rien', (select public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000a') = 0)
union all select 5, 'seul le service peut lancer le recalcul (ni anon ni un utilisateur)', (select not has_function_privilege('authenticated', 'public.recalc_ftp_tss(uuid)', 'execute') and not has_function_privilege('anon', 'public.recalc_ftp_tss(uuid)', 'execute'))
) t order by n;
SQL
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
