#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : rpc_piliers_annuels sans les colonnes retirées (durabilité et puissance après fatigue), le reste inchangé.
# Usage : bash supabase/tests/sql/rpc_piliers_nettoyage.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=${LOCAL_PG:-supabase/tests/sql/local_pg.sh}
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 <<'SQL'
create table public.activities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text, sport text, start_date_local timestamptz, power_curve jsonb, merged_into uuid,
  np integer, avg_watts integer, avg_heartrate integer, excl_power boolean, excl_hr boolean, moving_time integer, excl_duration boolean
);
create table public.daily_metrics (user_id uuid not null references auth.users(id) on delete cascade, iso_date date not null, ctl numeric, duration_min numeric, activity_count integer, primary key (user_id, iso_date));
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000000a','a@t');
-- 2025 : trois sorties avec capteur (l'année est fiable) dont une avec les anciennes clés (late_300, late_1200, fat20) qui ne doivent plus rien changer ; un 3e effort de 250 W (régularité 0,9)
insert into public.activities (user_id, name, sport, start_date_local, power_curve, np, avg_heartrate, moving_time) values
 ('00000000-0000-4000-8000-00000000000a', 'r1', 'Ride', '2025-03-01 09:00+00', '{"5": 900, "300": 320, "1200": 280, "3600": 230, "rep_1": 278, "rep_3": 250, "late_300": 260, "late_1200": 220, "fat20": 215, "drift": 4.0}', 200, 140, 9000),
 ('00000000-0000-4000-8000-00000000000a', 'r2', 'Ride', '2025-03-08 09:00+00', '{"300": 300, "1200": 270}', 150, 130, 3600),
 ('00000000-0000-4000-8000-00000000000a', 'r3', 'Ride', '2025-03-15 09:00+00', '{"300": 290, "1200": 260}', 150, 130, 3600);
insert into public.daily_metrics (user_id, iso_date, ctl, duration_min, activity_count)
select '00000000-0000-4000-8000-00000000000a', d::date, 50, case when extract(day from d) = 1 then 120 else 0 end, case when extract(day from d) = 1 then 1 else 0 end
from generate_series(date '2025-01-01', date '2025-12-31', interval '1 day') d;
grant select on public.activities, public.daily_metrics to authenticated;
SQL
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_rpc_piliers_nettoyage.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-11-03_rpc_piliers_nettoyage.sql   # relançable
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
\pset tuples_only on
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000000a';
select controle, ok from (
select 1 as n, 'les colonnes retirées ne sont plus rendues (late300, late1200, n_longues, fat20, n_fat)' as controle, (select pg_get_function_result('public.rpc_piliers_annuels()'::regprocedure) !~ '(late300|late1200|n_longues|fat20|n_fat)') as ok
union all select 2, 'les colonnes utiles sont toujours là, dans l''ordre : an, w5, w300, w1200, w3600, rep_ratio, rep_n, ctl_max, n_courbes, rep_w3, drift_med, n_drift, p_ref, fc_ref, n_fc, ctl_moy, heures, jours_actifs, jours_couverts',
  (select pg_get_function_result('public.rpc_piliers_annuels()'::regprocedure) = 'TABLE(an integer, w5 integer, w300 integer, w1200 integer, w3600 integer, rep_ratio numeric, rep_n integer, ctl_max numeric, n_courbes integer, rep_w3 integer, drift_med numeric, n_drift integer, p_ref integer, fc_ref integer, n_fc integer, ctl_moy numeric, heures numeric, jours_actifs integer, jours_couverts integer)')
union all select 3, '2025 : les meilleures puissances sont inchangées (sprint 900, 5 min 320, 20 min 280, 60 min 230)', (select (w5, w300, w1200, w3600) = (900, 320, 280, 230) from rpc_piliers_annuels() where an = 2025)
union all select 4, '2025 : la répétabilité compte le 3e effort de 250 W (régularité 250 / 278 = 0,899) sur 1 sortie : 250 W d''abord, 0,5 × 320 = 160 W est la barre', (select (rep_n, rep_w3, rep_ratio) = (1, 250, 0.899) from rpc_piliers_annuels() where an = 2025)
union all select 5, '2025 : la charge et le volume sont inchangés (CTL moyen 50, 12 mois de 2 h = 24 h, 12 jours actifs, 365 jours couverts)', (select (ctl_moy, heures, jours_actifs, jours_couverts) = (50.0, 24.0, 12, 365) from rpc_piliers_annuels() where an = 2025)
union all select 6, '2025 : la puissance de référence (70 % de 95 % de ton meilleur 20 min de 280 W = 186,2 → 186 W)', (select p_ref = 186 from rpc_piliers_annuels() where an = 2025)
) t order by n;
set request.jwt.claim.sub = '';
select 'sans connexion : aucune ligne' as controle, (select count(*) from rpc_piliers_annuels()) = 0 as ok;
reset role;
set role anon;
select 'anon refusé' as controle, not has_function_privilege('anon', 'public.rpc_piliers_annuels()', 'execute') as ok;
SQL
bash $H stop >/dev/null 2>&1 || true
echo "--- test terminé : toutes les lignes ci-dessus doivent afficher « t »"
