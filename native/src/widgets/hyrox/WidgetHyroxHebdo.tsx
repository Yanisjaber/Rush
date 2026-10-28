import { SerieHebdo } from '@/components/SerieHebdo';
import { formatDuree } from '@/data/outils/format';
import { hyroxParSemaine } from '@/data/sports/hyrox-suivi';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Le temps que tu passes chaque semaine à t'entraîner pour l'Hyrox (toutes tes séances Hyrox : stations, runs, semi-simulations), sur 12 semaines.
// Même forme que les autres widgets « par semaine » (voir SerieHebdo). Les valeurs sont des minutes, écrites en durée (1h05).
export function WidgetHyroxHebdo({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const h = hyroxParSemaine(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportHybride}
      titreTuile="Hyrox / sem."
      titreL="Entraînement Hyrox par semaine"
      valeur={formatDuree(h.derniere * 60)}
      unite=""
      parSemaine={h.parSemaine}
      formater={(n) => formatDuree(n * 60)}
      badge={h.ecartPct != null ? { texte: `${h.ecartPct > 0 ? '+' : ''}${h.ecartPct} % vs moyenne`, ton: h.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Temps de toutes tes séances Hyrox, additionné sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de séance Hyrox"
      videL="Pas encore de séance Hyrox. Dès ta première séance, ton temps par semaine apparaît ici."
      etiquette="Temps d'entraînement Hyrox par semaine sur 12 semaines"
    />
  );
}
