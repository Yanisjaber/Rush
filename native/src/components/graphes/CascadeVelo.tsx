import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as TexteSvg } from 'react-native-svg';
import type { Statut } from '@/data/bilan/progression';
import type { EstimationVelo } from '@/data/bilan/progression-velo';
import { cascadeVelo } from '@/data/bilan/progression-velo-affichage';
import { formatNum } from '@/data/outils/format';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// De l'écart brut à l'écart à cardio égal : chaque étape retire ce qui ne vient pas de ta forme (un cardio plus haut, le home-trainer).
// Une rangée par étape (le nom et le détail s'écrivent en texte, ils passent à la ligne), toutes sur le même axe des watts.
interface Props {
  estimation: EstimationVelo;
  statut: Statut;
}

const LARGEUR = 300;
const HAUTEUR_BARRE = 26;
const MARGE = 6;
const PLACE_VALEUR = 74; // de la place pour écrire « −34 W » au bout de la barre

const signe = (v: number): string => `${v >= 0 ? '+' : '−'}${formatNum(Math.abs(v), 1)} W`;

export function CascadeVelo({ estimation, statut }: Props) {
  const p = usePalette();
  const etapes = cascadeVelo(estimation);
  const bornes = etapes.flatMap((e) => [e.de, e.a, 0]);
  const bas = Math.min(...bornes);
  const haut = Math.max(...bornes);
  const etendue = haut - bas || 1;
  // Les valeurs s'écrivent au bout de la barre : on garde de la place du côté (ou des deux) où les barres s'éloignent de zéro
  const placeGauche = bas < 0 ? PLACE_VALEUR : 0;
  const placeDroite = haut > 0 ? PLACE_VALEUR : 0;
  const largeurUtile = LARGEUR - 2 * MARGE - placeGauche - placeDroite;
  const x = (v: number): number => MARGE + placeGauche + ((v - bas) / etendue) * largeurUtile;
  const couleurVerdict = statut === 'hausse' ? p.ok : statut === 'baisse' ? p.alerte : p.texteDoux;

  return (
    <View style={styles.liste}>
      {etapes.map((e) => {
        const gauche = Math.min(x(e.de), x(e.a));
        const largeur = Math.max(2, Math.abs(x(e.a) - x(e.de)));
        const couleur = e.total ? couleurVerdict : e.watts < 0 ? p.alerte : p.ok;
        const versLaDroite = x(e.a) >= x(e.de);
        const phrase = `${e.nom} : ${signe(e.watts)}. ${e.detail}.`;
        return (
          <View key={e.cle} accessible accessibilityLabel={phrase}>
            <Text style={[typo.petit, { color: p.texte }]}>
              <Text style={{ fontFamily: police.texte600 }}>{e.nom}</Text>
              <Text style={{ color: p.texteDoux }}> · {e.detail}</Text>
            </Text>
            <Svg width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR_BARRE}`} style={{ aspectRatio: LARGEUR / HAUTEUR_BARRE }}>
              <Line x1={x(0)} x2={x(0)} y1={0} y2={HAUTEUR_BARRE} stroke={p.texte} strokeWidth={1.2} />
              <Rect x={gauche} y={5} width={largeur} height={14} rx={4} fill={couleur} fillOpacity={e.total ? 1 : 0.62} />
              <TexteSvg
                x={versLaDroite ? gauche + largeur + 5 : gauche - 5}
                y={17}
                fontSize={13}
                fontFamily={police.titre700}
                fill={e.total ? couleurVerdict : p.texte}
                textAnchor={versLaDroite ? 'start' : 'end'}
              >
                {signe(e.watts)}
              </TexteSvg>
            </Svg>
          </View>
        );
      })}
      <Text style={[typo.petit, styles.note, { color: p.texteDoux }]}>
        Les écarts du dessus s'additionnent au dernier : c'est ton évolution une fois le cardio et le home-trainer mis de côté.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: 6 },
  note: { marginTop: 2 },
});
