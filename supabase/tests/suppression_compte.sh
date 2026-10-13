#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) de la suppression d'un gros compte, avant / après la migration.
# Usage : bash supabase/tests/suppression_compte.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../.."
H=supabase/proposals/db-v2/tests/local_pg.sh
SEED_DEFS="supabase/tests/suppression_compte_recalc_prod.sql"   # copie exacte des fonctions de recalcul de la production
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d coachia -q -v ON_ERROR_STOP=1 -f supabase/tests/suppression_compte_decor.sql
bash $H psql -d coachia -q -v ON_ERROR_STOP=1 -f "$SEED_DEFS"
bash $H psql -d coachia -q -v ON_ERROR_STOP=1 <<'SQL'
create trigger activities_recalc_metrics_ins after insert on public.activities referencing new table as changed_rows for each statement execute function public.trg_recalc_daily_metrics();
create trigger activities_recalc_metrics_upd after update on public.activities referencing new table as changed_rows for each statement execute function public.trg_recalc_daily_metrics();
create trigger activities_recalc_metrics_del after delete on public.activities referencing old table as changed_rows for each statement execute function public.trg_recalc_daily_metrics();
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001','gros@test'), ('00000000-0000-4000-8000-000000000002','petit@test');
-- gros compte : 3000 activités étalées sur ~15 ans ; petit compte : 50
insert into public.activities (user_id, start_date_local, tss, moving_time, elapsed_time)
  select '00000000-0000-4000-8000-000000000001', date '2011-01-01' + (i*1.87)::int, 40 + (i % 80), 3600, 3700 from generate_series(1,3000) i;
insert into public.activities (user_id, start_date_local, tss, moving_time, elapsed_time)
  select '00000000-0000-4000-8000-000000000002', date '2024-01-01' + i, 50, 3000, 3100 from generate_series(1,50) i;
-- références vers les activités (comme en production)
update public.daily_metrics d set main_activity_id = (select a.id from public.activities a where a.user_id = d.user_id and a.start_date_local::date = d.iso_date limit 1);
insert into public.power_profile (user_id, duration_s, activity_id_alltime, activity_id_90d)
  select '00000000-0000-4000-8000-000000000001', i, (select id from public.activities where user_id='00000000-0000-4000-8000-000000000001' offset (i % 3000) limit 1), (select id from public.activities where user_id='00000000-0000-4000-8000-000000000001' offset ((i*7) % 3000) limit 1) from generate_series(1,983) i;
select 'décor : '||(select count(*) from public.activities where user_id='00000000-0000-4000-8000-000000000001')||' activités, '||(select count(*) from public.daily_metrics where user_id='00000000-0000-4000-8000-000000000001')||' jours de métriques, '||(select count(*) from public.power_profile)||' courbes' as etat;
SQL
bash $H psql -d coachia -v ON_ERROR_STOP=1 -f supabase/tests/suppression_compte.sql
