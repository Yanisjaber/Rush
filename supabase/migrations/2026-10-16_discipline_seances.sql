-- Discipline d'une séance d'athlétisme (100 m, saut en hauteur, marathon…) : permet de filtrer l'accueil par discipline.
-- Relançable sans risque (idempotente). Purement additive : la colonne est vide (NULL) pour toutes les séances existantes, et
-- l'ancienne version de l'app, qui ne la connaît pas, continue de fonctionner sans rien changer.
--
-- Contenu : la clé d'une discipline de lib/data/disciplines.js (ex. '100m', 'hauteur', 'semi'), jamais du texte libre :
-- minuscules, chiffres et tirets, 40 caractères au plus. La contrainte le garantit côté base, quoi que l'app envoie.
--
-- Sécurité : aucune nouvelle table ni nouvelle policy. Les colonnes appartiennent à activities et activity_planned, déjà protégées par
-- la RLS (auth.uid() = user_id) : chaque utilisateur ne lit et n'écrit que ses propres lignes, discipline comprise.
-- Rapidité : ajouter une colonne sans valeur par défaut ne réécrit pas la table (même très grosse, comme activities).

alter table public.activity_planned add column if not exists discipline text;
alter table public.activities add column if not exists discipline text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activity_planned_discipline_format' and conrelid = 'public.activity_planned'::regclass) then
    alter table public.activity_planned
      add constraint activity_planned_discipline_format check (discipline is null or discipline ~ '^[a-z0-9-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_discipline_format' and conrelid = 'public.activities'::regclass) then
    alter table public.activities
      add constraint activities_discipline_format check (discipline is null or discipline ~ '^[a-z0-9-]{1,40}$');
  end if;
end $$;
