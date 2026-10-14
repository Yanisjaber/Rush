#!/bin/bash
# Rejoue la BASCULE COMPLÈTE sur une base locale « comme la production » : bascule → 50 vérifications → retour arrière → vérification du retour.
set -e
cd "$(dirname "$0")/.."
L=tests/local_pg.sh; P="$L psql"; DDL=tests/legacy_schema.sql
$L reset
sed 's/legacy/public/g' "$DDL" | grep -v "create schema" | $P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null
# les données de test visent le schéma legacy : on les redirige vers public (état « avant bascule »)
sed 's/legacy\./public./g' tests/legacy_fixture.sql | $P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null
$P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null -f tests/prod_like_setup.sql
AVANT=$($P -d rush -Atc "select count(*) from public.activities")
tests/build_cutover.sh
echo "== BASCULE =="
$P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null -f cutover_all.sql
echo "== VÉRIFICATIONS =="
$P -d rush -f tests/04_verify.sql 2>&1 | grep -E "✅|❌|ERROR" | sed 's/psql:[^ ]* //' | sed 's/^NOTICE:  //' | awk '{print} END {print NR " lignes"}' | tail -4
echo "== RETOUR ARRIÈRE =="
$P -d rush -v ON_ERROR_STOP=1 -q -o /dev/null -f 09_rollback_cutover.sql
APRES=$($P -d rush -Atc "select count(*) from public.activities")
TABLES=$($P -d rush -Atc "select count(*) from pg_tables where schemaname='public'")
TRIG=$($P -d rush -Atc "select string_agg(tgname, ',' order by tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and not t.tgisinternal")
LEG=$($P -d rush -Atc "select count(*) from pg_namespace where nspname in ('legacy','private')")
echo "activités avant=$AVANT après=$APRES | tables public=$TABLES | déclencheurs auth.users=$TRIG | schémas legacy/private restants=$LEG"
[ "$AVANT" = "$APRES" ] && [ "$TABLES" = "25" ] && [ "$LEG" = "0" ] && echo "RETOUR ARRIÈRE OK : base identique à l'état d'avant" || { echo "RETOUR ARRIÈRE ÉCHOUÉ"; exit 1; }
