-- Répétitions en réserve (RIR) notées série par série : combien de répétitions il te restait en fin de série (0 = à l'échec).
-- Facultatif : la colonne reste vide pour toutes les séries existantes et pour celles où tu ne notes rien. Relançable sans risque (idempotente).
--
-- Sécurité : aucune nouvelle table ni nouveau droit. La colonne est dans strength_sets, dont la RLS (auth.uid() = user_id) s'applique
-- à toute la ligne : chacun ne lit et n'écrit que ses propres séries. La contrainte borne la valeur (0 à 10) côté base, en plus du client.

alter table public.strength_sets add column if not exists rir smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'strength_sets_rir_borne' and conrelid = 'public.strength_sets'::regclass) then
    alter table public.strength_sets add constraint strength_sets_rir_borne check (rir is null or (rir between 0 and 10));
  end if;
end $$;
