-- ============================================================
-- yearly_goals : un objectif ne peut plus exister en double, et la base
-- refuse les valeurs aberrantes (jusqu'ici, seul le formulaire les filtrait).
--
-- Avant : aucune contrainte à part la clé primaire. Deux envois du même
-- formulaire (double clic, deux appareils) créaient deux fois le même objectif.
-- Maintenant :
--   - un seul objectif par (utilisateur, année, sport, modèle) ;
--   - année entre 2000 et 2100, cible > 0 et <= 10 000 000, saisie >= 0 ;
--   - sport dans la liste du Bilan (Hyrox, Triathlon et Duathlon y sont désormais).
-- La RLS (auth.uid() = user_id) était déjà en place : on la garantit ici, et
-- on retire tout accès au rôle anonyme.
-- Relançable sans risque.
-- ============================================================

alter table public.yearly_goals enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'yearly_goals' and policyname = 'Users can manage their own yearly_goals') then
    create policy "Users can manage their own yearly_goals" on public.yearly_goals
      for all to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.yearly_goals'::regclass and conname = 'yearly_goals_year_check') then
    alter table public.yearly_goals add constraint yearly_goals_year_check check (year between 2000 and 2100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.yearly_goals'::regclass and conname = 'yearly_goals_target_check') then
    alter table public.yearly_goals add constraint yearly_goals_target_check check (target > 0 and target <= 10000000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.yearly_goals'::regclass and conname = 'yearly_goals_current_manual_check') then
    alter table public.yearly_goals add constraint yearly_goals_current_manual_check check (current_manual is null or (current_manual >= 0 and current_manual <= 10000000));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.yearly_goals'::regclass and conname = 'yearly_goals_sport_check') then
    alter table public.yearly_goals add constraint yearly_goals_sport_check
      check (sport in ('tous', 'cyclisme', 'course', 'natation', 'musculation', 'hyrox', 'triathlon', 'duathlon', 'autre'));
  end if;
end $$;

create unique index if not exists yearly_goals_un_objectif_par_modele
  on public.yearly_goals (user_id, year, sport, template);

revoke all on public.yearly_goals from anon;
