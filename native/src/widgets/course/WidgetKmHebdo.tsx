import { SerieHebdo } from '@/components/SerieHebdo';
import { kmParSemaine } from '@/data/sports/course';
import { formatKm } from '@/data/outils/format';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Les kilomètres courus chaque semaine, sur 12 semaines. Même forme que le tonnage de la muscu (voir SerieHebdo).
export function WidgetKmHebdo({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const k = kmParSemaine(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportCourse}
      titreTuile="Course / semaine"
      titreL="Kilomètres par semaine"
      valeur={formatKm(k.derniere)}
      unite="km"
      parSemaine={k.parSemaine}
      formater={(n) => formatKm(n)}
      badge={k.ecartPct != null ? { texte: `${k.ecartPct > 0 ? '+' : ''}${k.ecartPct} % vs moyenne`, ton: k.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Kilomètres courus, additionnés sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de course"
      videL="Pas encore de course. Dès ta première sortie, tes kilomètres par semaine apparaissent ici."
      etiquette="Kilomètres courus par semaine sur 12 semaines"
    />
  );
}
