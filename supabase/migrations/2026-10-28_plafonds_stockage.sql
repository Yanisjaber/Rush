-- ============================================================
-- Plafonds de stockage par compte (l'inscription est ouverte : sans limite, un seul compte pourrait
-- remplir les 500 Mo de l'offre gratuite).
--
-- 1. Nombre de lignes par compte et par table : un déclencheur « après insertion » (une vérification
--    par requête, pas par ligne) refuse l'insertion qui ferait dépasser le plafond. Les plafonds sont
--    très larges par rapport aux usages réels mesurés le 28/10/2026 (le plus gros compte : 2 984 séances).
--    `health_metrics` a déjà son propre plafond (50 000, 2026-10-20) et n'est pas touchée.
-- 2. Taille des champs lourds : `streams_gz` (1 Mo, le plus gros actuel : 278 Ko), `extras` du profil (100 Ko, actuel : 8 Ko).
--
-- Relançable sans risque. Retour arrière : supprimer les déclencheurs `plafond_*` et les deux contraintes.
-- ============================================================

create or replace function public.trg_plafond_lignes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_cap integer := TG_ARGV[0]::integer;
  u uuid;
  n integer;
begin
  for u in select distinct user_id from nouvelles where user_id is not null loop
    execute format('select count(*) from (select 1 from public.%I where user_id = $1 limit %s) s', TG_TABLE_NAME, v_cap + 1)
      into n using u;
    if n > v_cap then
      raise exception 'Plafond atteint : % lignes au maximum dans % par compte', v_cap, TG_TABLE_NAME
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

do $$
declare
  p record;
begin
  for p in
    select * from (values
      ('activities', 20000), ('activity_planned', 10000), ('activity_template', 2000), ('activity_edits', 20000),
      ('day_notes', 20000), ('rest_day', 20000), ('training_phases', 2000), ('yearly_goals', 1000),
      ('strength_exercises', 1000), ('strength_programs', 500), ('strength_sets', 200000),
      ('hyrox_tests', 5000), ('hyrox_efforts', 50000), ('training_cycles', 1000)
    ) as t(nom, plafond)
  loop
    if to_regclass('public.' || p.nom) is not null then
      execute format('drop trigger if exists plafond_%1$s on public.%1$I', p.nom);
      execute format(
        'create trigger plafond_%1$s after insert on public.%1$I referencing new table as nouvelles for each statement execute function public.trg_plafond_lignes(%2$s)',
        p.nom, p.plafond);
    end if;
  end loop;
end;
$$;

-- Taille des champs lourds
alter table public.activities drop constraint if exists activities_streams_taille;
alter table public.activities add constraint activities_streams_taille
  check (streams_gz is null or octet_length(streams_gz) <= 1000000);
alter table public.user_profiles drop constraint if exists user_profiles_extras_taille;
alter table public.user_profiles add constraint user_profiles_extras_taille
  check (extras is null or octet_length(extras::text) <= 100000);
