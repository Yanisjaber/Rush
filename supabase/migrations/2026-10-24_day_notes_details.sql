-- Notes de santé détaillées : maladie (nom, symptômes, gravité), blessure (zone, côté, nature, douleur), indisponibilité (motif, lieu).
-- Le détail vit dans une colonne JSONB `details` (null pour une simple note) ; le type 'indisponible' s'ajoute aux types permis.
-- Idempotente. La RLS de day_notes ne change pas : chaque utilisateur n'accède qu'à ses lignes (auth.uid() = user_id).

alter table public.day_notes add column if not exists details jsonb;

-- Le détail est un objet de petite taille (l'app ne garde que des clés connues, la base refuse le reste d'énorme)
alter table public.day_notes drop constraint if exists day_notes_details_check;
alter table public.day_notes
  add constraint day_notes_details_check
  check (details is null or (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2048));

-- Les types permis : on retire toute ancienne contrainte portant sur `type`, puis on pose la nouvelle.
-- NOT VALID : les lignes déjà là ne sont pas revérifiées, seules les nouvelles écritures le sont.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.day_notes'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%' and pg_get_constraintdef(oid) ilike '%maladie%'
  loop
    execute format('alter table public.day_notes drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.day_notes drop constraint if exists day_notes_type_check;
alter table public.day_notes
  add constraint day_notes_type_check
  check (type in ('texte', 'maladie', 'blessure', 'indisponible')) not valid;
