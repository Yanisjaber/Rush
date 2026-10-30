import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as TexteSvg } from 'react-native-svg';
import type { EstimationVelo } from '@/data/bilan/progression-velo';
import { geometrieNuage } from '@/data/bilan/progression-velo-affichage';
import { formatNum } from '@/data/outils/format';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Chaque sortie retenue : cardio en abscisse, watts en ordonnée. Deux droites parallèles (la période d'avant, puis maintenant) : l'écart entre elles,
// mesuré au cardio de référence, est l'évolution à cardio égal. Les sorties en salle sont des carrés.
interface Props {
  estimation: EstimationVelo;
  /** Couleur du verdict (pour la flèche de l'écart). */
  couleurVerdict: string;
}

const LARGEUR = 300;
const HAUTEUR = 220;
const G = 38; // la place des watts à gauche
const D = 10;
const H = 22; // la place de « référence … bpm » en haut
const B = 34; // la place des graduations et du titre de l'axe en bas

export function NuageVelo({ estimation: e, couleurVerdict }: Props) {
  const p = usePalette();
  const g = geometrieNuage(e);
  const velo = couleurSport(p, 'velo');
  const x = (v: number): number => G + ((v - g.x0) / (g.x1 - g.x0)) * (LARGEUR - G - D);
  const y = (v: number): number => HAUTEUR - B - ((v - g.y0) / (g.y1 - g.y0)) * (HAUTEUR - B - H);
  const xRef = x(e.fcReference);
  const ecart = g.auReference.actuel - g.auReference.avant;
  const aDroite = xRef > LARGEUR * 0.68; // trop près du bord droit : l'étiquette passe à gauche de la flèche
  const flecheX = aDroite ? xRef - 7 : xRef + 7;
  const sens = ecart < 0 ? -1 : 1; // la pointe de la flèche, du côté où va l'écart (en bas si on recule)
  const yFin = y(g.auReference.actuel);
  const etiquette = `Chaque sortie retenue, cardio en abscisse et watts en ordonnée. À ${e.fcReference} battements par minute, la période actuelle est ${Math.abs(Math.round(ecart))} watts ${ecart < 0 ? 'sous' : 'au-dessus de'} la période d'avant.`;

  return (
    <View>
      <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
        {g.reperesY.map((v) => (
          <Line key={`gy${v}`} x1={G} x2={LARGEUR - D} y1={y(v)} y2={y(v)} stroke={p.trait} strokeWidth={1} />
        ))}
        {g.reperesY.map((v) => (
          <TexteSvg key={`ty${v}`} x={G - 6} y={y(v) + 4} fontSize={12} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="end">{v}</TexteSvg>
        ))}
        {g.reperesX.map((v) => (
          <TexteSvg key={`tx${v}`} x={x(v)} y={HAUTEUR - B + 16} fontSize={12} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="middle">{v}</TexteSvg>
        ))}
        <TexteSvg x={G} y={HAUTEUR - 4} fontSize={12} fontFamily={police.texte400} fill={p.texteMuet}>cardio moyen de la sortie (bpm)</TexteSvg>
        <TexteSvg x={2} y={H - 8} fontSize={12} fontFamily={police.texte400} fill={p.texteMuet}>W</TexteSvg>

        <Line x1={xRef} x2={xRef} y1={H} y2={HAUTEUR - B} stroke={p.texteMuet} strokeWidth={1} strokeDasharray="3 4" />
        <TexteSvg x={xRef} y={H - 8} fontSize={12} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="middle">référence {e.fcReference} bpm</TexteSvg>

        <Line x1={x(g.x0)} x2={x(g.x1)} y1={y(g.droiteAvant.de)} y2={y(g.droiteAvant.a)} stroke={p.texteMuet} strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={x(g.x0)} x2={x(g.x1)} y1={y(g.droiteActuelle.de)} y2={y(g.droiteActuelle.a)} stroke={velo} strokeWidth={2.4} strokeLinecap="round" />

        {/* L'écart au cardio de référence : une flèche entre les deux droites */}
        <Line x1={flecheX} x2={flecheX} y1={y(g.auReference.avant)} y2={yFin} stroke={couleurVerdict} strokeWidth={2.4} />
        <Path d={`M${flecheX - 4} ${yFin - sens * 5} L${flecheX} ${yFin} L${flecheX + 4} ${yFin - sens * 5}`} fill="none" stroke={couleurVerdict} strokeWidth={2.4} />
        <TexteSvg
          x={aDroite ? flecheX - 7 : flecheX + 7}
          y={(y(g.auReference.avant) + yFin) / 2 + 4}
          fontSize={13}
          fontFamily={police.titre700}
          fill={couleurVerdict}
          textAnchor={aDroite ? 'end' : 'start'}
        >
          {`${ecart > 0 ? '+' : '−'}${formatNum(Math.abs(ecart))} W`}
        </TexteSvg>

        {e.sorties.map((s, i) => {
          const cx = x(s.fc);
          const cy = y(s.watts);
          const contour = s.actuelle ? velo : p.texteDoux;
          const remplissage = s.actuelle ? velo : 'none';
          return s.interieur ? (
            <Rect key={i} x={cx - 4.5} y={cy - 4.5} width={9} height={9} rx={1.5} fill={remplissage} stroke={contour} strokeWidth={1.8} />
          ) : (
            <Circle key={i} cx={cx} cy={cy} r={4.6} fill={remplissage} stroke={contour} strokeWidth={1.8} />
          );
        })}
      </Svg>
      <View style={styles.legende}>
        <Text style={[typo.petit, { color: p.texteDoux }]}>○ avant</Text>
        <Text style={[typo.petit, { color: velo }]}>● maintenant</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>▢ home-trainer</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legende: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 2, marginTop: 4 },
});
