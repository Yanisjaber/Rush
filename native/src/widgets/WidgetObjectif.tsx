import { Tuile } from '@/components/Tuile';
import { CadreWidget } from '@/components/CadreWidget';
import { GrandChiffre } from '@/components/GrandChiffre';
import { formatDateLongue, formatKm, joursAvant } from '@/data/format';
import type { WidgetProps } from '@/data/types';

// Le compte à rebours de la prochaine compétition : « J-54 » en gros, son nom et sa date. Comme tous les widgets, il prend la
// forme que lui donne sa taille ; s'il est le premier de la page, le cadre lui donne le look dossard.
export function WidgetObjectif({ contexte, tuile = false }: WidgetProps) {
  const objectif = contexte.objectifs[0] ?? null;
  const jours = objectif ? `J-${joursAvant(objectif.date)}` : '—';
  const detail = objectif
    ? `${formatDateLongue(objectif.date)}${objectif.km ? ` · ${formatKm(objectif.km, 2)} km` : ''}${objectif.duration ? ` · objectif ${objectif.duration} min` : ''}`
    : 'Ajoute une compétition pour voir ton compte à rebours.';

  if (tuile) return <Tuile titre="Prochain objectif" valeur={jours} note={objectif ? `${objectif.name} · ${detail}` : 'Aucun objectif'} />;

  return (
    <CadreWidget titre="Prochain objectif">
      <GrandChiffre valeur={jours} nom={objectif ? objectif.name : 'Aucun objectif'} detail={detail} />
    </CadreWidget>
  );
}
