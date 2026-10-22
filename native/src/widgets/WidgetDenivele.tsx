import { SerieHebdo } from '@/components/SerieHebdo';
import { formatNombre } from '@/data/format';
import type { WidgetProps } from '@/data/types';
import { deniveleParSemaine } from '@/data/velo';
import { usePalette } from '@/theme/usePalette';

// Le dénivelé positif grimpé à vélo chaque semaine, sur 12 semaines (voir SerieHebdo).
export function WidgetDenivele({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const d = deniveleParSemaine(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportVelo}
      titreTuile="Dénivelé / semaine"
      titreL="Dénivelé par semaine"
      valeur={formatNombre(d.derniere)}
      unite="m"
      parSemaine={d.parSemaine}
      formater={(n) => formatNombre(n)}
      badge={d.ecartPct != null ? { texte: `${d.ecartPct > 0 ? '+' : ''}${d.ecartPct} % vs moyenne`, ton: d.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Dénivelé positif des sorties à vélo, additionné sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de dénivelé"
      videL="Pas encore de dénivelé. Dès qu'une sortie à vélo en a, ton dénivelé par semaine apparaît ici."
      etiquette="Dénivelé à vélo par semaine sur 12 semaines"
    />
  );
}
