#!/bin/bash
# Test LOCAL (Postgres jetable, jamais la vraie base) : un triathlon fusionné ne doit pas être compté deux fois dans daily_metrics.
# Avant la migration (copie de la prod) : le test doit échouer. Après : il doit passer.
# Usage : bash supabase/tests/sql/daily_metrics_fusion.sh      (prérequis : brew install postgresql@17)
set -e
cd "$(dirname "$0")/../../.."
H=supabase/tests/sql/local_pg.sh
bash $H start >/dev/null 2>&1 || true
bash $H reset
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/tests/sql/suppression_compte_decor.sql
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/tests/sql/suppression_compte_recalc_prod.sql
cat > /tmp/rush-fusion.sql <<'SQL'
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000001','tri@test') on conflict do nothing;
-- Jour J : un triathlon parent (200 TSS) + ses 3 étapes fusionnées (50 + 100 + 50 = 200 TSS)
insert into public.activities (id, user_id, start_date_local, tss, moving_time) values
  ('a0000000-0000-4000-8000-000000000000','00000000-0000-4000-8000-000000000001','2026-10-01 08:00', 200, 10800);
insert into public.activities (user_id, start_date_local, tss, moving_time, merged_into) values
  ('00000000-0000-4000-8000-000000000001','2026-10-01 08:00', 50, 1800, 'a0000000-0000-4000-8000-000000000000'),
  ('00000000-0000-4000-8000-000000000001','2026-10-01 09:00', 100, 5400, 'a0000000-0000-4000-8000-000000000000'),
  ('00000000-0000-4000-8000-000000000001','2026-10-01 11:00', 50, 3600, 'a0000000-0000-4000-8000-000000000000');
-- Une sortie normale le lendemain
insert into public.activities (user_id, start_date_local, tss, moving_time) values
  ('00000000-0000-4000-8000-000000000001','2026-10-02 08:00', 60, 3600);
select recalc_daily_metrics('00000000-0000-4000-8000-000000000001');
select iso_date, tss, activity_count, duration_min from daily_metrics order by iso_date;
do $$ begin
  if (select tss from daily_metrics where iso_date = '2026-10-01') <> 200 then raise exception 'ECHEC : TSS du triathlon = % (attendu 200)', (select tss from daily_metrics where iso_date = '2026-10-01'); end if;
  if (select activity_count from daily_metrics where iso_date = '2026-10-01') <> 1 then raise exception 'ECHEC : activity_count = % (attendu 1)', (select activity_count from daily_metrics where iso_date = '2026-10-01'); end if;
  raise notice 'OK : le triathlon fusionné est compté une seule fois';
end $$;
SQL
echo "== AVANT la migration (copie de la prod) =="
bash $H psql -d rush -v ON_ERROR_STOP=1 -f /tmp/rush-fusion.sql || echo "(échec attendu avant correction)"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -c "truncate daily_metrics, activities cascade"
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-27_daily_metrics_sans_etapes_fusionnees.sql
echo "== APRÈS la migration =="
bash $H psql -d rush -v ON_ERROR_STOP=1 -f /tmp/rush-fusion.sql
echo "== Migration 'jusqu'à aujourd'hui' : la série doit finir aujourd'hui, le TSS ne bouge pas =="
bash $H psql -d rush -q -v ON_ERROR_STOP=1 -f supabase/migrations/2026-10-27_daily_metrics_jusqua_aujourdhui.sql
bash $H psql -d rush -v ON_ERROR_STOP=1 <<'SQL'
select max(iso_date) as derniere_ligne, current_date as aujourdhui, (select tss from daily_metrics where iso_date = '2026-10-01') as tss_triathlon from daily_metrics;
do $$ begin
  if (select max(iso_date) from daily_metrics) <> current_date then raise exception 'ECHEC : la série ne va pas jusqu''à aujourd''hui'; end if;
  if (select tss from daily_metrics where iso_date = '2026-10-01') <> 200 then raise exception 'ECHEC : TSS triathlon modifié'; end if;
  if (select ctl from daily_metrics where iso_date = current_date) >= (select ctl from daily_metrics where iso_date = '2026-10-02') then raise exception 'ECHEC : la forme ne redescend pas pendant le repos'; end if;
  raise notice 'OK : série jusqu''à aujourd''hui, forme en baisse pendant le repos';
end $$;
SQL
bash $H stop >/dev/null 2>&1 || true
