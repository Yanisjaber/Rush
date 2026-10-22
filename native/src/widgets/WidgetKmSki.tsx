import { SerieHebdo } from '@/components/SerieHebdo';
import { formatKm } from '@/data/format';
import { kmParSemaineSport } from '@/data/trail';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Les kilomètres skiés chaque semaine (ski de fond, ski à roulettes, hors-piste), sur 12 semaines (voir SerieHebdo). Le ski alpin n'y compte pas.
export function WidgetKmSki({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const k = kmParSemaineSport(contexte.toutesSeances, 'ski');
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportNeutre}
      titreTuile="Ski / semaine"
      titreL="Kilomètres de ski par semaine"
      valeur={formatKm(k.derniere)}
      unite="km"
      parSemaine={k.parSemaine}
      formater={(n) => formatKm(n)}
      badge={k.ecartPct != null ? { texte: `${k.ecartPct > 0 ? '+' : ''}${k.ecartPct} % vs moyenne`, ton: k.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Kilomètres de ski de fond, de ski à roulettes et de hors-piste, additionnés sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas de ski récent"
      videL="Pas de ski sur les 12 dernières semaines. Le ski à roulettes compte aussi : dès ta première sortie, tes kilomètres par semaine apparaissent ici."
      etiquette="Kilomètres de ski par semaine sur 12 semaines"
      decimale
    />
  );
}
