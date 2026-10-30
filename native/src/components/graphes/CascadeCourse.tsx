import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as TexteSvg } from 'react-native-svg';
import type { Statut } from '@/data/bilan/progression';
import type { EstimationCourse } from '@/data/bilan/progression-course';
import { cascadeCourse } from '@/data/bilan/progression-course-affichage';
import { formatNum } from '@/data/outils/format';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// De l'écart brut à l'écart à cardio et dénivelé égaux : chaque étape retire ce qui ne vient pas de ta forme (un cardio plus haut, un parcours plus vallonné, le tapis).
// Les barres sont en secondes par km GAGNÉES : vers la droite, tu vas plus vite ; vers la gauche, plus lentement. Une rangée par étape, toutes sur le même axe.
interface Props {
  estimation: EstimationCourse;
  statut: Statut;
}

const LARGEUR = 300;
const HAUTEUR_BARRE = 26;
const MARGE = 6;
const PLACE_VALEUR = 82; // de la place pour écrire « −34 s/km » au bout de la barre

const signe = (v: number): string => `${v >= 0 ? '+' : '−'}${formatNum(Math.abs(v), 1)} s/km`;

export function CascadeCourse({ estimation, statut }: Props) {
  const p = usePalette();
  const etapes = cascadeCourse(estimation);
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
        const couleur = e.total ? couleurVerdict : e.secondes < 0 ? p.alerte : p.ok;
        const versLaDroite = x(e.a) >= x(e.de);
        const phrase = `${e.nom} : ${signe(e.secondes)} ${e.secondes >= 0 ? 'gagnées' : 'perdues'}. ${e.detail}.`;
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
                {signe(e.secondes)}
              </TexteSvg>
            </Svg>
          </View>
        );
      })}
      <Text style={[typo.petit, styles.note, { color: p.texteDoux }]}>
        Secondes par km gagnées (+) ou perdues (−). Les écarts du dessus s'additionnent au dernier : c'est ton évolution une fois le cardio et le parcours mis de côté.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { gap: 6 },
  note: { marginTop: 2 },
});
