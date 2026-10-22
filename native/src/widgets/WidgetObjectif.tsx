import { Tuile } from '@/components/Tuile';
import { CadreWidget } from '@/components/CadreWidget';
import { GrandChiffre } from '@/components/GrandChiffre';
import { ListeCompacte } from '@/components/ListeCompacte';
import { formatDateCourte, formatDateLongue, formatKm, joursAvant } from '@/data/format';
import type { WidgetProps } from '@/data/types';

// Le compte à rebours de la prochaine compétition : « J-54 » en gros, son nom et sa date.
//  - XS : le compte à rebours et le nom ; S : + la date ; M : + la date, la distance et le temps visé en liste ; L : le grand format.
// S'il est le premier de la page, le cadre lui donne le look dossard.
export function WidgetObjectif({ contexte, taille = 'm' }: WidgetProps) {
  const objectif = contexte.objectifs[0] ?? null;
  const jours = objectif ? `J-${joursAvant(objectif.date)}` : '—';
  const detail = objectif
    ? `${formatDateLongue(objectif.date)}${objectif.km ? ` · ${formatKm(objectif.km, 2)} km` : ''}${objectif.duration ? ` · objectif ${objectif.duration} min` : ''}`
    : 'Ajoute une compétition pour voir ton compte à rebours.';

  if (taille !== 'l') {
    const lignes = objectif
      ? [
          { cle: 'date', nom: 'Date', valeur: formatDateCourte(objectif.date) },
          ...(objectif.km ? [{ cle: 'km', nom: 'Distance', valeur: `${formatKm(objectif.km, 2)} km` }] : []),
          ...(objectif.duration ? [{ cle: 'temps', nom: 'Temps visé', valeur: `${objectif.duration} min` }] : []),
          ...(objectif.d_plus ? [{ cle: 'dplus', nom: 'Dénivelé', valeur: `${objectif.d_plus} m` }] : []),
        ]
      : [];
    return (
      <Tuile
        titre={taille === 's' ? 'Objectif' : 'Prochain objectif'} // en S, la tuile est étroite : le titre court tient sur une ligne
        valeur={jours}
        note={objectif ? (taille === 'm' ? objectif.name : `${objectif.name} · ${formatDateCourte(objectif.date)}`) : 'Aucun objectif'}
        large
      >
        {taille === 'm' && lignes.length ? <ListeCompacte lignes={lignes} etiquette={`${objectif?.name}, ${detail}`} /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Prochain objectif">
      <GrandChiffre valeur={jours} nom={objectif ? objectif.name : 'Aucun objectif'} detail={detail} />
    </CadreWidget>
  );
}
