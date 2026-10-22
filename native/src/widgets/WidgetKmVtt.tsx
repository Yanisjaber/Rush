import { SerieHebdo } from '@/components/SerieHebdo';
import { formatKm } from '@/data/format';
import { kmParSemaineSport } from '@/data/trail';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Les kilomètres roulés chaque semaine en VTT (et gravel), sur 12 semaines (voir SerieHebdo). Le vélo de route n'y compte pas.
export function WidgetKmVtt({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const k = kmParSemaineSport(contexte.toutesSeances, 'vtt');
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportVelo}
      titreTuile="VTT / semaine"
      titreL="Kilomètres de VTT par semaine"
      valeur={formatKm(k.derniere)}
      unite="km"
      parSemaine={k.parSemaine}
      formater={(n) => formatKm(n)}
      badge={k.ecartPct != null ? { texte: `${k.ecartPct > 0 ? '+' : ''}${k.ecartPct} % vs moyenne`, ton: k.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Kilomètres de tes sorties de VTT et de gravel, additionnés sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de VTT"
      videL="Pas encore de VTT. Dès ta première sortie, tes kilomètres par semaine apparaissent ici."
      etiquette="Kilomètres de VTT par semaine sur 12 semaines"
      decimale
    />
  );
}
