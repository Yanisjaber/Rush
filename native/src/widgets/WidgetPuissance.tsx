import { StyleSheet, Text as TexteRN, View } from 'react-native';
import Svg, { Circle, Line, Path, Text } from 'react-native-svg';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { CADRE, geometriePuissance, LIBELLES_CLES } from '@/data/puissance';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes meilleures puissances de 5 secondes à 1 heure, sur 90 jours (trait plein) et sur toute la vie (tirets).
// tuile : tuile (ta meilleure puissance sur 20 minutes ; à défaut, la plus longue durée connue).
export function WidgetPuissance({ contexte, taille = 'm', tuile = false }: WidgetProps) {
  const p = usePalette();
  const g = geometriePuissance(contexte.puissance);
  const { largeur, hauteur, gauche, droite } = CADRE;

  if (tuile) {
    const cle = g?.points.find((pt) => pt.label === '20 min') ?? g?.points[g.points.length - 1];
    return (
      <Tuile titre={cle ? `Puissance ${cle.label}` : 'Puissance'} valeur={cle ? String(cle.watts) : '—'} unite={cle ? 'W' : ''} note={cle ? 'Meilleure sur 90 jours' : 'Pas encore de sortie avec puissance'} />
    );
  }

  return (
    <CadreWidget titre="Courbe de puissance">
      {g ? (
        <>
          <View style={styles.legende}>
            <View style={styles.item}>
              <View style={[styles.traitPlein, { backgroundColor: p.sportVelo }]} />
              <TexteRN style={[typo.petit, { color: p.texteDoux }]}>90 jours</TexteRN>
            </View>
            <View style={styles.item}>
              <View style={[styles.traitTirets, { borderColor: p.texteDoux }]} />
              <TexteRN style={[typo.petit, { color: p.texteDoux }]}>Toute la vie</TexteRN>
            </View>
          </View>
          <Svg
            accessible
            accessibilityRole="image"
            accessibilityLabel="Meilleures puissances de 5 secondes à 1 heure, sur 90 jours et sur toute la vie"
            width="100%"
            viewBox={`0 0 ${largeur} ${hauteur}`}
            style={{ aspectRatio: largeur / hauteur }}
          >
            <Line x1={gauche} y1={g.base} x2={largeur - droite} y2={g.base} stroke={p.traitFort} strokeWidth={1} />
            <Path d={g.ligneTout} fill="none" stroke={p.texteDoux} strokeWidth={2} strokeDasharray="6 6" />
            <Path d={g.ligne90} fill="none" stroke={p.sportVelo} strokeWidth={taille === 'l' ? 3.4 : 3} strokeLinecap="round" />
            {g.points.map((pt) => (
              <Circle key={pt.label} cx={pt.x} cy={pt.y} r={4.5} fill={p.fond} stroke={p.sportVelo} strokeWidth={2.6} />
            ))}
            {g.points
              .filter((pt) => taille === 'l' || LIBELLES_CLES.includes(pt.label))
              .map((pt) => (
                <Text key={`w-${pt.label}`} x={pt.x} y={pt.y - 10} textAnchor="middle" fontFamily={police.titre700} fontSize={15} fill={p.texte}>
                  {pt.watts}
                </Text>
              ))}
            {g.points
              .filter((pt) => taille === 'l' || LIBELLES_CLES.includes(pt.label))
              .map((pt) => (
                <Text key={`d-${pt.label}`} x={pt.x} y={hauteur - 12} textAnchor="middle" fontFamily={police.texte400} fontSize={15} fill={p.texteDoux}>
                  {pt.label}
                </Text>
              ))}
          </Svg>
          <TexteRN style={[typo.petit, { color: p.texteMuet, marginTop: 4 }]}>Watts</TexteRN>
        </>
      ) : (
        <TexteRN style={[typo.corps, { color: p.texteDoux }]}>Pas encore assez de sorties avec puissance pour tracer ta courbe.</TexteRN>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  legende: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  traitPlein: { width: 16, height: 3, borderRadius: 2 },
  traitTirets: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
});
