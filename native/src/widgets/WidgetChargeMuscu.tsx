import { SerieHebdo } from '@/components/SerieHebdo';
import { chargeMuscuRecente } from '@/data/charge-muscu';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Charge de musculation : répétitions × (poids ÷ ton 1RM de l'exercice), sur 7 jours glissants.
// Le badge compare à ton habitude. La mise en forme (XS, S, M, L) est celle de SerieHebdo.
export function WidgetChargeMuscu({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const c = chargeMuscuRecente(contexte.force.series);
  const pct = c.ratio == null ? null : Math.round((c.ratio - 1) * 100);
  const haut = c.zone.cle === 'attention' || c.zone.cle === 'danger';
  return (
    <SerieHebdo
      taille={taille}
      couleur={p.sportMuscu}
      titreTuile="Charge muscu"
      titreL="Charge musculation"
      valeur={String(c.derniere)}
      unite="pts"
      parSemaine={c.parSemaine}
      formater={(n) => String(n)}
      badge={pct != null ? { texte: `${pct > 0 ? '+' : ''}${pct} % vs habitude`, ton: c.zone.cle === 'ok' ? 'ok' : haut ? 'alerte' : 'neutre' } : null}
      periode="7 derniers jours"
      pied={c.zone.cle === 'inconnu' ? "Pas encore assez d'historique pour te comparer à ton habitude. Pointillés : ta moyenne." : `Charge ${c.zone.libelle}. Pointillés : ta moyenne.`}
      videTuile="Aucune série récente"
      videL="Aucune série sur les 12 dernières semaines. Enregistre une séance pour voir ta charge."
      etiquette="Charge de musculation par semaine sur 12 semaines"
    />
  );
}
