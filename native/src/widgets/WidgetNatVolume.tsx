import { SerieHebdo } from '@/components/SerieHebdo';
import { formatNombre } from '@/data/format';
import { volumeNatation } from '@/data/natation';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Les mètres nagés chaque semaine, sur 8 semaines. Même forme que le tonnage de la muscu (voir SerieHebdo).
export function WidgetNatVolume({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const v = volumeNatation(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportNatation}
      titreTuile="Natation / semaine"
      titreL="Natation par semaine"
      valeur={formatNombre(v.derniere)}
      unite="m"
      parSemaine={v.parSemaine}
      formater={(n) => formatNombre(n)}
      badge={v.ecartPct != null ? { texte: `${v.ecartPct > 0 ? '+' : ''}${v.ecartPct} % vs moyenne`, ton: v.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="8 dernières semaines"
      pied="Mètres nagés, additionnés sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de natation"
      videL="Pas encore de natation. Dès ta première séance, tes mètres par semaine apparaissent ici."
      etiquette="Mètres nagés par semaine sur 8 semaines"
    />
  );
}
