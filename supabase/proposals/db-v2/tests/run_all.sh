#!/bin/bash
# Rejoue TOUT le scénario sur une base locale jetable : décor Supabase → ancienne base + données de test → schéma V2 → migration.
# Usage : tests/run_all.sh   (nécessite : brew install postgresql@17, puis tests/local_pg.sh start)
set -e
cd "$(dirname "$0")/.."
L=tests/local_pg.sh; P="$L psql"
$L reset
$P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null -f tests/legacy_schema.sql
$P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null -f tests/legacy_fixture.sql
$P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null -f 01_schema.sql
$P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null -f 02_seed_reference.sql
$P -d rush -v ON_ERROR_STOP=1 -1 -q -o /dev/null -f 03_migrate_from_legacy.sql
echo "migration OK"
