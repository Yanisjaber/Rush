import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import type { SerieNiveau } from '@/data/bilan/niveau-annees';
import { SORTIES_MINI_SOMMET } from '@/data/bilan/niveau-annees';
import { axeScore, debutsAnnees, libellePeriode, pointsDepuis, positionsNiveau, reperesAnnees, segmentsContinus } from '@/data/bilan/niveau-annees-affichage';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'évolution du niveau : une courbe du score (100 = ton meilleur niveau) par trimestre (ou semestre), avec la zone de marge d'erreur, la ligne des 100 et le meilleur niveau
// cerclé. Les points creux sont des périodes de moins de 8 sorties ; un trait en pointillés relie deux morceaux quand une période n'a pas assez de sorties.
// `mode` : les tranches (trimestres, semestres) ou les années entières (records : un seul point par année).
interface Props {
  serie: SerieNiveau;
  mode: 'tranches' | 'annuel';
  /** Ne montrer que les points de cette année et des suivantes (la fenêtre des 3 dernières années) ; sans valeur, tout l'historique. */
  depuisAn?: number;
  couleur: string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const LARGEUR = 300;
const HAUTEUR = 210;
const G = 38; // la place des scores à gauche
const D = 12;
const H = 18; // le haut : la ligne des 100 et l'étiquette « meilleur »
const B = 30; // le bas : les années

export function CourbeNiveau({ serie, mode, depuisAn, couleur, etiquette }: Props) {
  const p = usePalette();
  const tous = mode === 'tranches' && serie.tranches.length >= 2 ? serie.tranches : serie.annuel;
  const points = pointsDepuis(tous, depuisAn);
  const m = tous === serie.tranches ? serie.tranchesParAn : 1;
  const positions = positionsNiveau(points, m);
  const t0 = positions[0].t;
  const t1 = positions[positions.length - 1].t;
  const axe = axeScore(points);
  const x = (t: number): number => G + ((t - t0) / Math.max(1, t1 - t0)) * (LARGEUR - G - D);
  const y = (v: number): number => H + ((axe.max - Math.min(axe.max, v)) / (axe.max - axe.min)) * (HAUTEUR - H - B);
  const segments = segmentsContinus(positions);
  const sommet = positions.find((o) => o.point.cle === serie.meilleur.cle);
  const aMarge = points.some((pt) => pt.demi > 0);
  // Le sommet est plus ancien que la fenêtre : on le dit, sinon la ligne des 100 n'a pas de point
  const sommetHorsVue = !sommet && points.length < tous.length;

  return (
    <View>
      <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
        {axe.reperes.map((v) => (
          <Fragment key={v}>
            <Line x1={G} x2={LARGEUR - D} y1={y(v)} y2={y(v)} stroke={v === 100 ? couleur : p.trait} strokeWidth={v === 100 ? 1.4 : 1} strokeDasharray={v === 100 ? '4 4' : undefined} />
            <TexteSvg x={G - 7} y={y(v) + 4} fontSize={12} fontFamily={v === 100 ? police.texte600 : police.texte400} fill={v === 100 ? couleur : p.texteMuet} textAnchor="end">{v}</TexteSvg>
          </Fragment>
        ))}

        {/* Une barre au début de chaque année */}
        {debutsAnnees(positions, m).map((t) => (
          <Line key={`an${t}`} x1={x(t)} x2={x(t)} y1={H} y2={HAUTEUR - B} stroke={p.traitFort} strokeWidth={1.5} />
        ))}

        {/* La marge d'erreur : une zone teintée autour de la courbe, morceau par morceau */}
        {aMarge
          ? segments.filter((s) => s.length > 1).map((s, i) => {
              const haut = s.map((o) => `${x(o.t)} ${y(o.point.haut)}`).join(' L');
              const bas = [...s].reverse().map((o) => `${x(o.t)} ${y(o.point.bas)}`).join(' L');
              return <Path key={`z${i}`} d={`M${haut} L${bas} Z`} fill={couleur} fillOpacity={0.16} />;
            })
          : null}

        {/* Un trait en pointillés entre deux morceaux : une période sans assez de sorties */}
        {segments.slice(1).map((s, i) => {
          const avant = segments[i][segments[i].length - 1];
          return <Line key={`p${i}`} x1={x(avant.t)} x2={x(s[0].t)} y1={y(avant.point.score)} y2={y(s[0].point.score)} stroke={couleur} strokeWidth={1.6} strokeDasharray="3 4" strokeOpacity={0.7} />;
        })}

        {segments.filter((s) => s.length > 1).map((s, i) => (
          <Path key={`c${i}`} d={s.map((o, k) => `${k ? 'L' : 'M'}${x(o.t)} ${y(o.point.score)}`).join(' ')} fill="none" stroke={couleur} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {positions.map((o) => {
          const creux = o.point.n !== null && o.point.n < SORTIES_MINI_SOMMET;
          return <Circle key={o.point.cle} cx={x(o.t)} cy={y(o.point.score)} r={creux ? 3 : 4} fill={creux ? p.surface : couleur} stroke={couleur} strokeWidth={1.8} />;
        })}

        {sommet ? (
          <>
            <Circle cx={x(sommet.t)} cy={y(sommet.point.score)} r={7} fill="none" stroke={p.texte} strokeWidth={1.6} />
            <TexteSvg x={x(sommet.t)} y={y(sommet.point.score) - 12} fontSize={12} fontFamily={police.texte600} fill={p.texte} textAnchor={x(sommet.t) > LARGEUR / 2 ? 'end' : 'middle'}>meilleur</TexteSvg>
          </>
        ) : null}

        {reperesAnnees(positions).map((r) => (
          <TexteSvg key={r.an} x={x(r.t)} y={HAUTEUR - 8} fontSize={12} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="middle">{r.an}</TexteSvg>
        ))}
      </Svg>
      <Text style={[typo.petit, styles.legende, { color: p.texteDoux }]}>
        {aMarge ? '○ moins de 8 sorties · zone teintée : marge d\'erreur · pointillés : période sans assez de sorties' : 'Un point par année : ton meilleur sur cette durée'}
        {sommetHorsVue ? ` Ton meilleur niveau (${libellePeriode(serie.meilleur.cle)}) est avant cette vue : touche la flèche pour tout voir.` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legende: { marginTop: 4 },
});
