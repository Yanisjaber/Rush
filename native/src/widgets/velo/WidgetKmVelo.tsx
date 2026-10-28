import { SerieHebdo } from '@/components/SerieHebdo';
import { formatKm } from '@/data/outils/format';
import type { WidgetProps } from '@/data/types';
import { kmVeloParSemaine } from '@/data/sports/velo';
import { usePalette } from '@/theme/usePalette';

// Les kilomètres roulés chaque semaine, sur 12 semaines. Même forme que celui de la course (voir SerieHebdo).
export function WidgetKmVelo({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const k = kmVeloParSemaine(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportVelo}
      titreTuile="Vélo / semaine"
      titreL="Kilomètres à vélo par semaine"
      valeur={formatKm(k.derniere)}
      unite="km"
      parSemaine={k.parSemaine}
      formater={(n) => formatKm(n)}
      badge={k.ecartPct != null ? { texte: `${k.ecartPct > 0 ? '+' : ''}${k.ecartPct} % vs moyenne`, ton: k.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Kilomètres roulés, additionnés sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de vélo"
      videL="Pas encore de vélo. Dès ta première sortie, tes kilomètres par semaine apparaissent ici."
      etiquette="Kilomètres à vélo par semaine sur 12 semaines"
    />
  );
}
