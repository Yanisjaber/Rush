# Migrations : comment ça marche, et ses limites

- `supabase/migrations/` est le journal officiel des changements de schéma, un fichier par évolution (`AAAA-MM-JJ_nom.sql`), relançable sans risque. On les applique **à la main** avec `supabase db query --linked -f <fichier>`.
- L'ordre est l'ordre alphabétique des noms. Quand plusieurs fichiers ont la même date, les suffixes (`_1`, `_2a`, `_3`…) donnent l'ordre voulu. Exemple : la suite Vault, `jetons_vault_1_ajout`, `_2a_purge_strava`, `_2b_fin`, `_3_colonnes_mortes`.

## Limite connue : le journal ne se rejoue pas sur une base vide

- La table `activities` (la principale) n'est créée par **aucune** migration : elle existait avant le journal. Rejouer toutes les migrations sur une base vide échoue donc dès les premières.
- Les anciens `schema.sql` et `schema_v2.sql` ont été supprimés (périmés). Pour reconstruire la base, utilise `supabase/baseline/`.
- La vraie base de production est la seule référence exacte. Pour reconstruire une base de test, on part d'un décor minimal (`supabase/tests/*_decor.sql`, `supabase/proposals/db-v2/tests/local_pg.sh`) et on joue seulement les migrations utiles au test.

## Instantané de départ (28/10/2026)

`supabase/baseline/schema_public_2026-10-28.sql` est le schéma `public` de la production à cette date (sans données), pris avec `supabase db dump --linked --schema public` (Docker requis). **Il se rejoue sans erreur sur une base vide** (testé sur le Postgres jetable : `local_pg.sh start`, `reset`, puis `psql -d rush -f` sur ce fichier ; 24 tables, 13 fonctions).

- Toutes les migrations datées **jusqu'au 28/10/2026** sont déjà dedans : pour reconstruire une base, on charge l'instantané puis seulement les migrations **postérieures**.
- Ce que l'instantané ne contient pas : les tâches `pg_cron` (schéma `cron`, par exemple `daily_metrics_nuit`, voir `supabase/migrations/2026-10-28_daily_metrics_cron_nuit.sql`), Vault et les secrets, les utilisateurs (`auth`).
- À refaire (et à renommer avec la nouvelle date) quand le schéma a beaucoup changé.
