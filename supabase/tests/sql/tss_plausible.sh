#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : le garde-fou de plausibilité du TSS (jamais plus de 200 points par heure, jamais une intensité de plus de 1,5).
# Usage : bash supabase/tests/sql/tss_plausible.sh      (prérequis : brew install postgresql@17)
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
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t'), ('00000000-0000-4000-8000-00000000000b','b@t');
-- A : LTHR au profil (170). B : ni LTHR ni FC max (comme le compte de test) : aucun TSS cardio possible.
insert into public.user_profiles (user_id, ftp, hr_max, lthr) values ('00000000-0000-4000-8000-00000000000a', null, 195, 170), ('00000000-0000-4000-8000-00000000000b', null, null, null);

-- ----- Compte B : les sorties aberrantes de 2012-2013 (watts estimés par Strava, « FTP » de 4 W enregistrée à l'import) -----
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, moving_time, ftp_at_time, intensity, tss) values
 -- b1 : 4 h sans cardio : 1 176 714 TSS → l'estimation générale (35 par heure) : 14262 s = 3,96 h → 139
 ('00000000-0000-4000-8000-00000000000b', 1, 'b1 aberrante sans cardio', 'Ride', current_date - 900, false, 218, null, 14262, 4, 54.5, 1176714),
 -- b2 : avec un cardio mais sans LTHR : 45 par heure : 9747 s = 2,71 h → 122
 ('00000000-0000-4000-8000-00000000000b', 2, 'b2 aberrante avec cardio', 'Ride', current_date - 899, false, 150, 140, 9747, 4, 71.0, 1104910),
 -- b3 : une sortie normale sans règle applicable : elle garde son TSS (60) et sa FTP
 ('00000000-0000-4000-8000-00000000000b', 3, 'b3 normale', 'Ride', current_date - 898, false, 150, null, 3600, 230, 0.65, 60),
 -- b5 : un vrai capteur mais une courbe cassée (4 W sur 20 min) et un vieux TSS aberrant : pas de FTP estimable → l'estimation (1 h sans cardio : 35)
 ('00000000-0000-4000-8000-00000000000b', 5, 'b5 capteur en panne', 'Ride', current_date - 10, true, 200, null, 3600, 4, 50, 5000);
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, power_curve, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000b', 6, 'b6 effort valide il y a 300 jours', 'Ride', current_date - 300, true, '{"1200": 300}', 3600, 285, 50),
 ('00000000-0000-4000-8000-00000000000b', 7, 'b7 courbe cassée', 'Ride', current_date - 10, true, '{"1200": 4}', 3600, 4, 50);
update public.activities set power_curve = '{"1200": 4}' where name = 'b5 capteur en panne';
-- b4 : une séance saisie à la main (pas de strava_id) : jamais touchée, même avec un TSS énorme
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, moving_time, tss) values
 ('00000000-0000-4000-8000-00000000000b', null, 'b4 saisie à la main', 'Ride', current_date - 800, false, 150, 3600, 999999);

-- ----- Compte A (LTHR 170) -----
-- Un vrai effort de 20 min à 300 W (FTP 285) il y a 100 jours ; une sortie normale à 200 W de puissance normalisée ; une sortie dont la « puissance normalisée » est fausse (5000 W)
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, power_curve, moving_time, ftp_at_time, tss) values
 ('00000000-0000-4000-8000-00000000000a', 10, 'a0 effort valide', 'Ride', current_date - 100, true, '{"1200": 300}', 3600, 285, 50);
insert into public.activities (user_id, strava_id, name, sport, start_date_local, device_watts, np, avg_heartrate, moving_time, ftp_at_time, intensity, tss) values
 -- a1 : capteur, 200 W / FTP 285 = 0,70 → 49 (la règle puissance reste la règle)
 ('00000000-0000-4000-8000-00000000000a', 11, 'a1 normale avec capteur', 'Ride', current_date - 95, true, 200, 150, 3600, 300, 0.667, 50),
 -- a2 : la puissance normalisée est fausse (5000 W) : intensité 17,5, TSS énorme → ce n'est pas un effort : on passe au cardio (150 / 170)² = 78
 ('00000000-0000-4000-8000-00000000000a', 12, 'a2 puissance fausse', 'Ride', current_date - 94, true, 5000, 150, 3600, 300, 16.7, 123456);

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
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-02_ftp_glissante.sql      # l'ancienne règle : les sorties aberrantes de B ne bougent pas
bash $H psql -d rush -v ON_ERROR_STOP=1 -At -c "select 'AVANT (ancienne règle) : b1 garde ' || tss from public.activities where name like 'b1 %'"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_tss_plausible.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_tss_plausible.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
select controle, ok from (
select 1 as n, 'b1 : 1 176 714 TSS sur 4 h → l''estimation générale (35 par heure) = 139, FTP et intensité effacées' as controle, (select (tss, ftp_at_time is null, intensity is null) = (139, true, true) from public.activities where name like 'b1 %') as ok
union all select 2, 'b2 : avec un cardio mais sans LTHR : 45 par heure sur 2,71 h = 122', (select (tss, ftp_at_time is null) = (122, true) from public.activities where name like 'b2 %')
union all select 3, 'b3 : une sortie normale sans règle applicable garde son TSS (60) et sa FTP (230)', (select (tss, ftp_at_time) = (60, 230) from public.activities where name like 'b3 %')
union all select 4, 'b4 : une séance saisie à la main n''est jamais touchée, même avec un TSS énorme', (select tss = 999999 from public.activities where name like 'b4 %')
union all select 5, 'b5 : capteur en panne (courbe à 4 W), le 4 W n''estime pas la FTP : pas de FTP estimable → l''estimation (1 h sans cardio = 35)', (select (tss, ftp_at_time is null) = (35, true) from public.activities where name like 'b5 %')
union all select 6, 'a1 : une sortie normale avec capteur reste en puissance : 200 / 285 → 49', (select (tss, ftp_at_time) = (49, 285) from public.activities where name like 'a1 %')
union all select 7, 'a2 : une puissance normalisée fausse (5000 W, intensité 17,5) ne donne pas de TSS de puissance : on passe au cardio (150 / 170)² = 78, intensité effacée', (select (tss, intensity is null) = (78, true) from public.activities where name like 'a2 %')
union all select 8, 'relançable : une 2e passe ne modifie plus rien', (select public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000a') = 0 and public.recalc_ftp_tss('00000000-0000-4000-8000-00000000000b') = 0)
union all select 9, 'la charge du compte B n''est plus absurde : CTL max sous 100 (avant : plusieurs centaines de milliers)', (select max(ctl) < 100 from public.daily_metrics where user_id = '00000000-0000-4000-8000-00000000000b' and iso_date between current_date - 900 and current_date - 801)
union all select 10, 'aucune sortie Strava ne dépasse 200 points par heure', (select not exists (select 1 from public.activities where strava_id is not null and tss > 200 * moving_time / 3600.0))
union all select 11, 'seul le service peut lancer le recalcul (ni anon ni un utilisateur)', (select not has_function_privilege('authenticated', 'public.recalc_ftp_tss(uuid)', 'execute') and not has_function_privilege('anon', 'public.recalc_ftp_tss(uuid)', 'execute'))
) t order by n;
SQL
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
