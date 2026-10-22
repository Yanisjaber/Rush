import { SerieHebdo } from '@/components/SerieHebdo';
import { seancesForce } from '@/data/synthese';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// La force qui soutient le Hyrox (sled, farmers, lunges, wall balls) : combien de séances par semaine. La valeur est la moyenne des
// 4 dernières semaines ; les barres montrent les 12 dernières (mise en forme XS, S, M, L : voir SerieHebdo). Le jaune Hyrox est dans les barres.
export function WidgetChargeForce({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const recent = seancesForce(contexte.toutesSeances, 4);
  const long = seancesForce(contexte.toutesSeances, 12);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportHybride}
      titreTuile="Charge de force"
      titreL="Charge de force"
      valeur={String(recent.moyenne).replace('.', ',')}
      unite="/sem."
      parSemaine={long.parSemaine}
      formater={(n) => String(n)}
      decimale
      uniteTotal="séances"
      badge={long.serie > 0 ? { texte: `${long.serie} semaine${long.serie > 1 ? 's' : ''} d'affilée`, ton: 'ok' } : null}
      periode={`${recent.total} séance${recent.total > 1 ? 's' : ''} en 4 semaines`}
      pied={`${recent.total} séance${recent.total > 1 ? 's' : ''} de force sur les 4 dernières semaines. Pointillés : ta moyenne sur 12 semaines.`}
      videTuile="Aucune séance de force"
      videL="Aucune séance de force sur les 12 dernières semaines."
      etiquette="Séances de force par semaine sur 12 semaines"
    />
  );
}
