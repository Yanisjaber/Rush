import { Dossard } from '@/components/Dossard';
import { familleAffichage } from '@/data/familles';
import { formatDateLongue, formatKm, joursAvant } from '@/data/format';
import type { WidgetProps } from '@/data/types';

// Le dossard d'objectif : le compte à rebours de la prochaine compétition.
export function WidgetObjectif({ contexte, taille = 'm' }: WidgetProps) {
  const objectif = contexte.objectifs[0] ?? null;
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
