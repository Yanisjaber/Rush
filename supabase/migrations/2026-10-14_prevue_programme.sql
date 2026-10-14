-- Une séance prévue de muscu peut être reliée à un de tes programmes (PUSH, PULL, LEGS…) : la carte « Séance du jour » de l'accueil
-- propose alors de démarrer CE programme. Relançable sans risque (idempotente).
--
-- Sécurité : la clé étrangère est (programme_id, user_id) → (id, user_id) de strength_programs. La base refuse donc de relier une séance
-- au programme d'un AUTRE utilisateur, même en connaissant son identifiant. Quand le programme est supprimé, le lien se vide (set null)
-- sans supprimer la séance prévue. RLS : inchangée (la colonne est dans activity_planned, déjà limitée à auth.uid() = user_id).

-- 1) Pour pouvoir viser « ce programme ET cet utilisateur », strength_programs a besoin d'une contrainte d'unicité sur (id, user_id)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'strength_programs_id_user_unique' and conrelid = 'public.strength_programs'::regclass) then
    alter table public.strength_programs add constraint strength_programs_id_user_unique unique (id, user_id);
  end if;
end $$;

-- 2) La colonne (vide pour toutes les séances existantes)
alter table public.activity_planned add column if not exists programme_id uuid;

-- 3) La clé étrangère composite (le lien se vide à la suppression du programme, la séance reste)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_planned_programme_fk' and conrelid = 'public.activity_planned'::regclass) then
    alter table public.activity_planned
      add constraint activity_planned_programme_fk
      foreign key (programme_id, user_id) references public.strength_programs (id, user_id) on delete set null (programme_id);
  end if;
end $$;

create index if not exists idx_activity_planned_programme on public.activity_planned (programme_id) where programme_id is not null;
