import { SerieHebdo } from '@/components/SerieHebdo';
import { formatNombre } from '@/data/format';
import { deniveleTrailParSemaine } from '@/data/trail';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Le dénivelé positif grimpé chaque semaine en trail, sur 12 semaines (voir SerieHebdo).
export function WidgetDeniveleTrail({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const d = deniveleTrailParSemaine(contexte.toutesSeances);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportCourse}
      titreTuile="D+ / semaine"
      titreL="Dénivelé par semaine"
      valeur={formatNombre(d.derniere)}
      unite="m"
      parSemaine={d.parSemaine}
      formater={(n) => formatNombre(n)}
      badge={d.ecartPct != null ? { texte: `${d.ecartPct > 0 ? '+' : ''}${d.ecartPct} % vs moyenne`, ton: d.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Dénivelé positif de tes sorties de trail, additionné sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de trail"
      videL="Pas encore de dénivelé en trail. Dès qu'une sortie de trail en a, ton D+ par semaine apparaît ici."
      etiquette="Dénivelé positif en trail par semaine sur 12 semaines"
    />
  );
}
