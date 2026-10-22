import { SerieHebdo } from '@/components/SerieHebdo';
import { tonnageParSemaine } from '@/data/force';
import { formatNombre } from '@/data/format';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Le tonnage (répétitions × charge) soulevé chaque semaine, sur 12 semaines. La mise en forme (XS, S, M, L) est celle de SerieHebdo.
export function WidgetTonnage({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const t = tonnageParSemaine(contexte.force.series);
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportMuscu}
      titreTuile="Tonnage / sem."
      titreL="Tonnage par semaine"
      valeur={formatNombre(t.derniere)}
      unite="kg"
      parSemaine={t.parSemaine}
      formater={(n) => formatNombre(n)}
      badge={t.ecartPct != null ? { texte: `${t.ecartPct > 0 ? '+' : ''}${t.ecartPct} % vs moyenne`, ton: t.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied="Répétitions × charge, additionné sur 7 jours glissants. Pointillés : ta moyenne."
      videTuile="Pas encore de séries"
      videL="Pas encore de séries enregistrées. Démarre une séance pour voir ton tonnage."
      etiquette="Tonnage soulevé par semaine sur 12 semaines"
    />
  );
}
