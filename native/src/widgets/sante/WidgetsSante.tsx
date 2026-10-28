import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AnneauZones } from '@/components/AnneauZones';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { indiceVeille, jusquAuDernierIndice, lecture, niveauDe, piliersDispo, type PointForme } from '@/data/sante/forme-sante';
import { avecAlpha } from '@/theme/couleurs';
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
export function WidgetEtatDuJour({ serie: brute, tuile = false }: PropsSante) {
  // Le dernier jour qui a un indice : un jour avec seulement un poids ou un check-in ne doit pas effacer l'état connu
  const serie = jusquAuDernierIndice(brute);
  const point = serie[serie.length - 1] ?? null;
  const l = lecture(point);
  if (tuile) {
    return <Tuile gros titre="État de forme" valeur={l ? String(l.indice) : '—'} unite={l ? '/100' : undefined} note={l ? l.mot : 'Pas assez de données'} />;
  }
  const veille = indiceVeille(serie);
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
  const { pris: dispo, total } = piliersDispo(point);
  const ecart = l && veille != null ? l.indice - veille : null;
  // Les trois zones de lecture, avec les seuils de l'état de forme : à ménager (0 à 40), moyen (40 à 65), récupéré (65 à 100)
  const zones = [
    { de: 0, a: 40, couleur: avecAlpha(p.danger, 0.4) },
    { de: 40, a: 65, couleur: avecAlpha(p.alerte, 0.4) },
    { de: 65, a: 100, couleur: avecAlpha(p.ok, 0.4) },
  ];
  return (
    <View style={styles.scene}>
      <AnneauZones
        valeur={l ? l.indice : null}
        taille={124}
        epaisseur={14}
        zones={zones}
        couleurRepere={couleur}
        contourRepere={p.fond}
        etiquette={l ? `État de forme : ${l.mot}, ${l.indice} sur 100. C'est une estimation.` : 'État de forme indisponible'}
      >
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.mot, { color: l ? p.texte : p.texteMuet }]}>
          {l ? l.mot : '—'}
        </Text>
        {l ? (
          <View style={styles.detail}>
            <Text style={[typo.petit, { color: p.texteDoux }]}>{l.indice}</Text>
            {ecart != null && ecart !== 0 ? (
              <View style={styles.variation} accessible accessibilityLabel={`${ecart > 0 ? 'Plus' : 'Moins'} ${Math.abs(ecart)} point${Math.abs(ecart) > 1 ? 's' : ''} depuis hier`}>
                <Svg width={9} height={7} viewBox="0 0 10 8">
                  <Path d={ecart > 0 ? 'M5 0 L10 8 L0 8 Z' : 'M0 0 L10 0 L5 8 Z'} fill={ecart > 0 ? p.ok : p.danger} />
                </Svg>
                <Text style={[typo.petit, { color: p.texteDoux }]}>{Math.abs(ecart)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </AnneauZones>
      <View accessible accessibilityLabel={`Précision ${point?.precision ? MOT_PRECISION[point.precision] : 'insuffisante'}, ${dispo} piliers sur ${total}`} style={styles.points}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.point, { backgroundColor: i < dispo ? p.texte : p.traitFort }]} />
        ))}
        <Text style={[typo.micro, { color: p.texteMuet, marginLeft: 6 }]}>estimation</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  mot: { fontFamily: police.titre800, fontSize: 21, lineHeight: 25, maxWidth: 90, textAlign: 'center' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  variation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  points: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  point: { width: 8, height: 8, borderRadius: 4 },
});
