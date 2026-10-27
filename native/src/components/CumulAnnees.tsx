import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { grapheCumul, HAUTEUR_CUMUL, jourDeX, libelleJour, LARGEUR_CUMUL, MARGE_BAS_CUMUL, MARGE_DROITE_CUMUL, type SerieCumul } from '@/data/cumul-graphe';
import { formatNum } from '@/data/format';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le cumul de l'année choisie contre les deux précédentes : trois courbes, l'année choisie en gras avec sa zone teintée,
// un repère « aujourd'hui », et la valeur de chaque année écrite au bout de sa courbe (pas de légende). La première série est l'année choisie.
// Poser le doigt dessus (et le faire glisser à l'horizontale) déplace une ligne : les valeurs écrites sont celles de la date pointée, la date est écrite au-dessus.
interface Props {
  series: SerieCumul[];
  /** Année en cours : le repère « aujourd'hui » est tracé, sinon les valeurs sont celles de fin d'année. */
  enCours: boolean;
  formater: (valeur: number) => string;
  /** Phrase lue par VoiceOver à la place du dessin. */
  titre: string;
}

export function CumulAnnees({ series, enCours, formater, titre }: Props) {
  const p = usePalette();
  const [jour, setJour] = useState<number | null>(null);
  const [largeur, setLargeur] = useState(0);
  // Le côté où poser les valeurs dépend de leur largeur : on la mesure d'après les valeurs du jour affiché
  const g = useMemo(() => {
    const essai = grapheCumul(series, jour);
    const largeurEtiquette = Math.max(0, ...essai.etiquettes.map((e) => `${e.annee} ${formatNum(e.valeur)}`.length)) * 6.3;
    return grapheCumul(series, jour, largeurEtiquette);
  }, [series, jour]);
  const toucher = (x: number) => setJour(jourDeX(x, largeur, series));
  const couleurs = [p.texte, p.texteDoux, p.texteMuet];
  // Le rang d'une année dans les séries (0 = l'année choisie) : sa couleur et son style ; une année sans valeur ce jour-là n'a pas de point
  const rangDe = (annee: number) => Math.max(0, series.findIndex((x) => x.annee === annee));
  const police400 = police.texte400;
  const ligneBase = HAUTEUR_CUMUL - MARGE_BAS_CUMUL;

  return (
    <View>
      <Text style={[typo.petit, styles.lecture, { color: jour == null ? p.texteMuet : p.texte }]} accessibilityLiveRegion="none">
        {jour == null ? (enCours ? "Aujourd'hui" : "Fin d'année") : libelleJour(g.jour)}
      </Text>
      <View
        onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
        onTouchStart={(e) => toucher(e.nativeEvent.locationX)}
        onTouchMove={(e) => toucher(e.nativeEvent.locationX)}
        onTouchEnd={() => setJour(null)}
        onTouchCancel={() => setJour(null)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${titre} : ${g.points.map((pt) => `${pt.annee}, ${formater(pt.valeur)}`).join(' ; ')}, ${jour != null ? libelleJour(g.jour) : enCours ? "à la date du jour" : "en fin d'année"}`}
      >
        <Svg width="100%" viewBox={`0 0 ${LARGEUR_CUMUL} ${HAUTEUR_CUMUL}`} style={{ aspectRatio: LARGEUR_CUMUL / HAUTEUR_CUMUL }}>
          {g.graduations.map((gr) => (
            <Line key={gr.valeur} x1={6} x2={LARGEUR_CUMUL - MARGE_DROITE_CUMUL} y1={gr.y} y2={gr.y} stroke={p.trait} strokeWidth={1} />
          ))}
          {g.graduations
            .filter((gr) => gr.valeur > 0)
            .map((gr) => (
              <TexteSvg key={`v${gr.valeur}`} x={8} y={gr.y - 4} fontSize={9.5} fontFamily={police400} fill={p.texteMuet}>
                {gr.valeur.toLocaleString('fr-FR')}
              </TexteSvg>
            ))}
          {g.mois.map((m, i) => (
            <TexteSvg key={i} x={m.x} y={HAUTEUR_CUMUL - 5} fontSize={10} fontFamily={police400} fill={p.texteMuet} textAnchor="middle">
              {m.nom}
            </TexteSvg>
          ))}
          {jour != null ? <Line x1={g.curseurX} x2={g.curseurX} y1={12} y2={ligneBase} stroke={p.texte} strokeWidth={1.5} /> : null}
          {enCours ? <Line x1={g.repereX} x2={g.repereX} y1={12} y2={ligneBase} stroke={p.texteMuet} strokeWidth={1} strokeDasharray="3 3" /> : null}
          {/* Du fond vers le devant : la plus ancienne d'abord, l'année choisie par-dessus */}
          {[...g.courbes].reverse().map((c, k, tout) => {
            const rang = tout.length - 1 - k;
            return c.d ? (
              <Path
                key={c.annee}
                d={c.d}
                fill="none"
                stroke={couleurs[rang] ?? p.texteMuet}
                strokeWidth={rang === 0 ? 3 : rang === 1 ? 1.8 : 1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={rang === 2 ? '4 3' : undefined}
              />
            ) : null;
          })}
          {g.points.map((pt) => {
            const rang = rangDe(pt.annee);
            return <Circle key={pt.annee} cx={pt.x} cy={pt.y} r={rang === 0 ? 4.5 : 3.5} fill={rang === 0 ? p.texte : p.fond} stroke={couleurs[rang] ?? p.texteMuet} strokeWidth={1.8} />;
          })}
          {g.etiquettes.map((e) => {
            const rang = rangDe(e.annee);
            const texte = `${e.annee} ${formatNum(e.valeur)}`;
            const commun = { x: e.x, y: e.y + 4, fontSize: 11, fontFamily: rang === 0 ? police.titre800 : police.texte600, textAnchor: e.ancrage === 'fin' ? ('end' as const) : ('start' as const) };
            return (
              <G key={e.annee}>
                {/* un petit fond de la couleur du bloc, pour rester lisible quand le texte passe sur une courbe */}
                <TexteSvg {...commun} fill={p.surface} stroke={p.surface} strokeWidth={3.5} strokeLinejoin="round">
                  {texte}
                </TexteSvg>
                <TexteSvg {...commun} fill={couleurs[rang] ?? p.texteMuet}>
                  {texte}
                </TexteSvg>
              </G>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lecture: { minHeight: 20, marginBottom: 4, textAlign: 'center' },
});
