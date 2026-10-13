#!/bin/bash
# Assemble la bascule complète en UN fichier (une seule transaction) : cutover_all.sql
cd "$(dirname "$0")/.."
{
  echo "-- GÉNÉRÉ par tests/build_cutover.sh : ne pas modifier à la main."
  echo "begin;"
  cat 03a_move_to_legacy.sql 01_schema.sql 02_seed_reference.sql 03_migrate_from_legacy.sql
  echo "commit;"
} > cutover_all.sql
echo "cutover_all.sql : $(wc -l < cutover_all.sql) lignes"
