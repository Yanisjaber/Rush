import { Dossard } from '@/components/Dossard';
import { Tuile } from '@/components/Tuile';
import { familleAffichage } from '@/data/familles';
import { formatDateLongue, formatKm, joursAvant } from '@/data/format';
import type { WidgetProps } from '@/data/types';

// Le dossard d'objectif : le compte à rebours de la prochaine compétition.
// tuile : le compte à rebours en gros, le nom de la compétition en note.
export function WidgetObjectif({ contexte, taille = 'm', tuile = false }: WidgetProps) {
  const objectif = contexte.objectifs[0] ?? null;
  if (tuile) {
    return <Tuile titre="Prochain objectif" valeur={objectif ? `J-${joursAvant(objectif.date)}` : '—'} note={objectif ? objectif.name : 'Aucun objectif'} />;
  }
  if (!objectif) {
    return <Dossard compact etiquette="Prochain objectif" nom="Aucun objectif" detail="Ajoute une compétition pour voir ton compte à rebours." />;
  }
  const detail = `${formatDateLongue(objectif.date)}${objectif.km ? ` · ${formatKm(objectif.km, 2)} km` : ''}${objectif.duration ? ` · objectif ${objectif.duration} min` : ''}`;
  return (
    <Dossard
      taille={taille === 'l' ? 'l' : 'm'}
      sport={familleAffichage(objectif.sport)}
      etiquette="Prochain objectif"
      nom={objectif.name}
      valeur={`J-${joursAvant(objectif.date)}`}
      detail={detail}
    />
  );
}
