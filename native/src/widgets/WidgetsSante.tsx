import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AnneauJauge } from '@/components/AnneauJauge';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { lecture, niveauDe, type PointForme } from '@/data/forme-sante';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le widget de l'écran principal de Santé : l'état du jour, en une image. Un anneau qui se remplit, l'indice au centre, un mot, la variation depuis hier,
// et de petits points pour la précision. Aucune phrase : la forme et la couleur disent l'essentiel. Même cadre que les widgets de l'Accueil
// (CadreWidget) ; comme premier bloc de la page, il prend le look dossard.
export interface PropsSante {
  /** L'état de forme jour par jour (de la plus ancienne à la plus récente), voir forme-sante.ts. */
  serie: PointForme[];
  /** XS, S ou M : la version tuile (chiffre clé) ; L : le grand format avec l'anneau. */
  tuile?: boolean;
}

const MOT_PRECISION = { basique: 'basique', bonne: 'bonne', elevee: 'élevée' } as const;

/** L'état du jour : l'anneau de l'indice (0 à 100), le mot, la variation depuis hier, la précision en points. */
export function WidgetEtatDuJour({ serie, tuile = false }: PropsSante) {
  const point = serie[serie.length - 1] ?? null;
  const l = lecture(point);
  if (tuile) {
    return <Tuile gros titre="État de forme" valeur={l ? String(l.indice) : '—'} unite={l ? '/100' : undefined} note={l ? l.mot : 'Pas assez de données'} />;
  }
  const veille = serie[serie.length - 2]?.indice ?? null;
  return (
    <CadreWidget titre="État du jour" serre>
      <ContenuAnneau point={point} veille={veille} />
    </CadreWidget>
  );
}

// Dans un composant à part : il doit lire la palette du cadre (inversée quand le widget est en look dossard), pas celle de l'écran
function ContenuAnneau({ point, veille }: { point: PointForme | null; veille: number | null }) {
  const p = usePalette();
  const l = lecture(point);
  const niveau = niveauDe(point?.indice);
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.traitFort;
  const dispo = point ? point.composantes.filter((c) => c.indice != null).length : 0;
  const total = point ? point.composantes.length : 8;
  const ecart = l && veille != null ? l.indice - veille : null;
  return (
    <View style={styles.scene}>
      <AnneauJauge
        valeur={l ? l.indice : null}
        taille={150}
        epaisseur={15}
        couleur={couleur}
        piste={p.surface2}
        reperes={[40, 65].map((valeur) => ({ valeur, couleur: p.traitFort }))}
        etiquette={l ? `État de forme ${l.indice} sur 100, ${l.mot}` : 'État de forme indisponible'}
      >
        <Text style={[styles.chiffre, { color: l ? p.texte : p.texteMuet }]}>{l ? l.indice : '—'}</Text>
        <Text numberOfLines={1} style={[styles.mot, { color: p.texte }]}>
          {l ? l.mot : 'Pas assez de données'}
        </Text>
        {ecart != null && ecart !== 0 ? (
          <View style={styles.variation} accessible accessibilityLabel={`${ecart > 0 ? 'Plus' : 'Moins'} ${Math.abs(ecart)} point${Math.abs(ecart) > 1 ? 's' : ''} depuis hier`}>
            <Svg width={10} height={8} viewBox="0 0 10 8">
              <Path d={ecart > 0 ? 'M5 0 L10 8 L0 8 Z' : 'M0 0 L10 0 L5 8 Z'} fill={ecart > 0 ? p.ok : p.danger} />
            </Svg>
            <Text style={[typo.petit, { color: p.texteDoux }]}>{Math.abs(ecart)}</Text>
          </View>
        ) : null}
      </AnneauJauge>
      <View accessible accessibilityLabel={`Précision ${point?.precision ? MOT_PRECISION[point.precision] : 'insuffisante'}, ${dispo} piliers sur ${total}`} style={styles.points}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.point, { backgroundColor: i < dispo ? p.texte : p.traitFort }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  chiffre: { fontFamily: police.titre800, fontSize: 50, lineHeight: 54, letterSpacing: -1 },
  mot: { fontFamily: police.texte600, fontSize: 15, lineHeight: 18 },
  variation: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  points: { flexDirection: 'row', gap: 6 },
  point: { width: 8, height: 8, borderRadius: 4 },
});
