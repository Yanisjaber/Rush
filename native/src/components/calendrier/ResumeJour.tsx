import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { chargeJour, compositionJour, type JourGrille } from '@/data/calendrier/calendrier';
import { formatDuree } from '@/data/outils/format';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le résumé d'un jour : le temps fait en grand (« sur 2h59 » s'il reste du prévu) et la charge à droite, puis une barre découpée par sport (plein = fait, hachuré = prévu)
// sans légende (le titre dit déjà « faites sur … »). On voit d'un coup d'œil ce qui est fait et ce qui reste à faire.
export function ResumeJour({ jour }: { jour: JourGrille }) {
  const p = usePalette();
  const { fait, faitSec, prevuSec } = compositionJour(jour);
  const total = faitSec + prevuSec;
  if (total <= 0) return null;
  const charge = chargeJour(jour);
  const titre = faitSec > 0 ? formatDuree(faitSec) : formatDuree(prevuSec);
  const suite = faitSec > 0 ? (prevuSec > 0 ? `faites sur ${formatDuree(total)}` : 'faites') : 'prévues';
  const dit = [faitSec > 0 ? `${formatDuree(faitSec)} faites` : null, faitSec > 0 ? `${charge} points de charge` : null, prevuSec > 0 ? `${formatDuree(prevuSec)} prévues` : null].filter(Boolean).join(', ');

  return (
    <View accessible accessibilityLabel={dit} style={styles.cadre}>
      <View style={styles.ligne}>
        <Text style={[styles.valeur, { color: p.texte }]}>{titre}</Text>
        <Text style={[typo.petit, { color: p.texteDoux, flex: 1 }]}>{suite}</Text>
        {faitSec > 0 ? (
          <Text style={[styles.charge, { color: p.texte }]}>
            {charge}
            <Text style={[typo.petit, { color: p.texteDoux, fontFamily: police.texte400 }]}> pts</Text>
          </Text>
        ) : null}
      </View>
      <View style={[styles.rail, { backgroundColor: p.surface2 }]}>
        {fait.map((x) => (
          <View key={x.nom} style={{ flex: x.secondes, backgroundColor: couleurSport(p, x.sport) }} />
        ))}
        {prevuSec > 0 ? (
          <View style={{ flex: prevuSec }}>
            <Svg width="100%" height={6}>
              <Defs>
                <Pattern id="hachure" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <Line x1={0} y1={0} x2={0} y2={5} stroke={p.texteDoux} strokeWidth={2.5} />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width="100%" height={6} fill="url(#hachure)" opacity={0.55} />
            </Svg>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { gap: 8, marginTop: 4, marginBottom: 6 },
  ligne: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  valeur: { fontFamily: police.titre800, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
  charge: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  rail: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
});
