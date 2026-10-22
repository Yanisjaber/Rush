import { SerieHebdo } from '@/components/SerieHebdo';
import { formatDuree } from '@/data/format';
import { hebdoCrossfit } from '@/data/crossfit';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Le temps que tu passes chaque semaine en CrossFit (séances CrossFit et HIIT), sur 12 semaines. Les valeurs sont des minutes, écrites en durée (1h05).
// Même forme que les autres widgets « par semaine » (voir SerieHebdo).
export function WidgetCfHebdo({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const h = hebdoCrossfit(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportHybride}
      titreTuile="CrossFit / sem."
      titreL="CrossFit par semaine"
      valeur={formatDuree(h.derniere * 60)}
      unite=""
      parSemaine={h.parSemaine}
      formater={(n) => formatDuree(n * 60)}
      badge={h.ecartPct != null ? { texte: `${h.ecartPct > 0 ? '+' : ''}${h.ecartPct} % vs moyenne`, ton: h.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Temps de tes séances de CrossFit et de HIIT, additionné sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de CrossFit"
      videL="Pas encore de séance de CrossFit. Dès ta première séance, ton temps par semaine apparaît ici."
      etiquette="Temps de CrossFit par semaine sur 12 semaines"
    />
  );
}
