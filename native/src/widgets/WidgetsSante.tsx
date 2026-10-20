import { Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { GrandChiffre } from '@/components/GrandChiffre';
import { Tuile } from '@/components/Tuile';
import { lecture, type PointForme } from '@/data/forme-sante';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le widget de l'écran principal de Santé : l'état du jour. Même cadre que ceux de l'Accueil (CadreWidget) ; comme premier bloc de la page,
// il prend le look dossard. Les piliers qui l'expliquent sont dessous, sous forme de cartes identiques (CartePilier).
export interface PropsSante {
  /** L'état de forme jour par jour (de la plus ancienne à la plus récente), voir forme-sante.ts. */
  serie: PointForme[];
  /** XS, S ou M : la version tuile (chiffre clé) ; L : le grand format. */
  tuile?: boolean;
}

const MOT_PRECISION = { basique: 'basique', bonne: 'bonne', elevee: 'élevée' } as const;

const SOUS_TITRE_FAIBLE: Record<string, string> = {
  hrv: 'ta HRV',
  fc: 'ta FC de repos',
  sommeil: 'ton sommeil',
  ressenti: 'ton ressenti du matin',
  stress: 'ton stress de nuit',
  charge: "ta charge d'entraînement",
  resp: 'ta respiration de nuit',
  temperature: 'ta température cutanée',
};

// La précision de l'estimation (combien de piliers sur 8 ont une donnée), puis le frein (malade, blessé) ou ce qui pèse le plus
function LignePrecision({ point, faible }: { point: PointForme; faible?: string }) {
  const p = usePalette();
  const dispo = point.composantes.filter((c) => c.indice != null).length;
  return (
    <View style={{ marginTop: 4, gap: 2 }}>
      <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
        Précision {point.precision ? MOT_PRECISION[point.precision] : 'insuffisante'} · {dispo} piliers sur {point.composantes.length}
      </Text>
      {point.freins.slice(0, 1).map((f) => (
        <Text key={f} numberOfLines={1} style={[typo.petit, { color: p.texte }]}>
          {f}
        </Text>
      ))}
      {!point.freins.length && faible ? (
        <Text numberOfLines={1} style={[typo.petit, { color: p.texte }]}>
          Ce qui pèse le plus : {SOUS_TITRE_FAIBLE[faible]}.
        </Text>
      ) : null}
      <Text style={[typo.petit, { color: p.texteDoux, marginTop: 4 }]}>Voir la courbe et le calcul ›</Text>
    </View>
  );
}

/** L'état du jour : l'indice de forme (0 à 100), une phrase de lecture, la précision et ce qui pèse le plus. */
export function WidgetEtatDuJour({ serie, tuile = false }: PropsSante) {
  const point = serie[serie.length - 1] ?? null;
  const l = lecture(point);
  if (tuile) {
    return <Tuile gros titre="État de forme" valeur={l ? String(l.indice) : '—'} unite={l ? '/100' : undefined} note={l ? l.libelle : 'Pas assez de données'} />;
  }
  const detail = l ? l.phrase : 'Il faut quelques semaines de nuits (HRV, FC de repos, sommeil) pour calibrer ta référence personnelle.';
  return (
    <CadreWidget titre="État du jour">
      <GrandChiffre reduit valeur={l ? String(l.indice) : '—'} nom={l ? l.libelle : 'Pas assez de données'} detail={detail}>
        {point ? <LignePrecision point={point} faible={l?.pointFaible?.cle} /> : null}
      </GrandChiffre>
    </CadreWidget>
  );
}
