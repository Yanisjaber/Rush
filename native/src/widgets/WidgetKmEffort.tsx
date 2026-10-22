import { SerieHebdo } from '@/components/SerieHebdo';
import { formatKm } from '@/data/format';
import { kmEffortParSemaine } from '@/data/trail';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Les km-effort de chaque semaine de trail (1 km-effort = 1 km + 100 m de D+) : le volume réel, bien plus juste que les seuls kilomètres.
export function WidgetKmEffort({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const k = kmEffortParSemaine(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportCourse}
      titreTuile="Km-effort / sem."
      titreL="Km-effort par semaine"
      valeur={formatKm(k.derniere)}
      unite="km-effort"
      parSemaine={k.parSemaine}
      formater={(n) => formatKm(n)}
      badge={k.ecartPct != null ? { texte: `${k.ecartPct > 0 ? '+' : ''}${k.ecartPct} % vs moyenne`, ton: k.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="1 km-effort = 1 km + 100 m de dénivelé positif, sur tes sorties de trail, additionné sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de trail"
      videL="Pas encore de trail. Dès ta première sortie, tes km-effort par semaine apparaissent ici."
      etiquette="Kilomètres-effort en trail par semaine sur 12 semaines"
      decimale
    />
  );
}
