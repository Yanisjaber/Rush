# Migrations : comment ça marche, et ses limites

- `supabase/migrations/` est le journal officiel des changements de schéma, un fichier par évolution (`AAAA-MM-JJ_nom.sql`), relançable sans risque. On les applique **à la main** avec `supabase db query --linked -f <fichier>`.
- L'ordre est l'ordre alphabétique des noms. Quand plusieurs fichiers ont la même date, les suffixes (`_1`, `_2a`, `_3`…) donnent l'ordre voulu. Exemple : la suite Vault, `jetons_vault_1_ajout`, `_2a_purge_strava`, `_2b_fin`, `_3_colonnes_mortes`.

## Limite connue : le journal ne se rejoue pas sur une base vide

- La table `activities` (la principale) n'est créée par **aucune** migration : elle existait avant le journal. Rejouer toutes les migrations sur une base vide échoue donc dès les premières.
- `supabase/schema.sql` et `supabase/schema_v2.sql` sont les anciens points de départ. Ils sont **périmés** (tables disparues, colonnes manquantes) : ne pas s'en servir pour reconstruire la base.
- La vraie base de production est la seule référence exacte. Pour reconstruire une base de test, on part d'un décor minimal (`supabase/tests/*_decor.sql`, `supabase/proposals/db-v2/tests/local_pg.sh`) et on joue seulement les migrations utiles au test.

## Pour réparer un jour

Prendre un instantané du schéma de production (`supabase db dump --linked --schema public`, qui lit sans écrire), le commiter comme `supabase/baseline/` puis ne rejouer que les migrations postérieures. Il faut Docker pour cette commande.
