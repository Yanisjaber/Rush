import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Text as TexteSvg } from 'react-native-svg';
import { CadreWidget } from '@/components/CadreWidget';
import { CourbeLissee } from '@/components/CourbeLissee';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import type { WidgetProps } from '@/data/types';
import { equivalenceWattsFc, wattsACardioEgal } from '@/data/velo';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes watts à cardio égal : sur les sorties faciles, les watts moyens semaine après semaine (ils montent quand ta condition monte).
// Le grand format ajoute l'équivalence entre cardio et watts, calculée sur tes sorties : « à 140 bpm, environ 190 W ».
//  - XS : les watts ; S : + la courbe ; M : + la courbe remplie, plus grande ; L : le suivi, puis le nuage de tes sorties avec sa droite et la table.
const L = 400;
const H = 170;
const MARGE = { g: 34, d: 10, h: 10, b: 24 };

export function WidgetWattsCardio({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const w = wattsACardioEgal(contexte.toutesSeances, contexte.hrMax);
  const valeurs = w ? w.points.map((pt) => pt.watts) : [];
  const monte = !!w && w.evolutionPct > 0;
  const evolution = w ? `${monte ? '+' : ''}${w.evolutionPct.toString().replace('.', ',')} % en 12 sem.` : '';

  if (taille !== 'l') {
    return (
      <Tuile titre="Watts à cardio égal" valeur={w ? String(w.actuelle) : '—'} unite={w ? 'W' : ''} note={w ? evolution : 'Pas assez de sorties'} large>
        {!w ? null : taille === 's' ? (
          <CourbeLissee valeurs={valeurs} couleur={p.sportVelo} hauteur={34} aire={false} pointFinal={false} etiquette="Watts à cardio égal sur 12 semaines" />
        ) : taille === 'm' ? (
          <CourbeLissee valeurs={valeurs} couleur={p.sportVelo} largeur={220} hauteur={90} etiquette="Watts à cardio égal sur 12 semaines" />
        ) : null}
      </Tuile>
    );
  }

  const eq = equivalenceWattsFc(contexte.toutesSeances);
  // Le nuage : une sortie = un point, la droite d'équivalence sur la plage de FC observée
  const nuage = (() => {
    if (!eq) return null;
    const wMin = Math.min(...eq.points.map((pt) => pt.watts));
    const wMax = Math.max(...eq.points.map((pt) => pt.watts));
    const fc0 = eq.fcMin - 3;
    const fc1 = eq.fcMax + 3;
    const w0 = Math.max(0, wMin - 15);
    const w1 = wMax + 15;
    const x = (fc: number) => MARGE.g + ((fc - fc0) / (fc1 - fc0)) * (L - MARGE.g - MARGE.d);
    const y = (watts: number) => H - MARGE.b - ((watts - w0) / (w1 - w0)) * (H - MARGE.b - MARGE.h);
    return { x, y, fc0, fc1, w0, w1 };
  })();

  return (
    <CadreWidget titre="Watts à cardio égal">
      {w ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {w.actuelle}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> W, sorties faciles</Text>
            </Text>
            <View style={[styles.badge, { backgroundColor: monte ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
              <Text style={[typo.petit, styles.badgeTexte, { color: monte ? p.ok : p.texteDoux }]}>{evolution}</Text>
            </View>
          </View>
          <CourbeLissee valeurs={valeurs} couleur={p.sportVelo} hauteur={80} etiquette="Watts à cardio égal sur 12 semaines" />
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Il faut au moins trois semaines de sorties faciles avec cardio et capteur de puissance pour suivre tes watts à cardio égal.</Text>
      )}

      <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte, marginTop: 16 }]}>
        Équivalence cardio et watts
      </Text>
      {eq && nuage ? (
        <>
          <Svg
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Tes ${eq.points.length} sorties : fréquence cardiaque en abscisse, watts en ordonnée, avec la droite d'équivalence`}
            width="100%"
            viewBox={`0 0 ${L} ${H}`}
            style={{ aspectRatio: L / H, marginTop: 8 }}
          >
            <Line x1={MARGE.g} y1={H - MARGE.b} x2={L - MARGE.d} y2={H - MARGE.b} stroke={p.trait} strokeWidth={1} />
            <Line x1={nuage.x(eq.fcMin)} y1={nuage.y(eq.pente * eq.fcMin + eq.ordonnee)} x2={nuage.x(eq.fcMax)} y2={nuage.y(eq.pente * eq.fcMax + eq.ordonnee)} stroke={p.sportVelo} strokeWidth={3} strokeLinecap="round" />
            {eq.points.map((pt, i) => (
              <Circle key={i} cx={nuage.x(pt.fc)} cy={nuage.y(pt.watts)} r={4} fill={avecAlpha(p.sportVelo, 0.55)} />
            ))}
            <TexteSvg x={MARGE.g} y={H - 6} fontSize={11} fill={p.texteDoux} fontFamily={police.texte600}>{`${Math.round(eq.fcMin)} bpm`}</TexteSvg>
            <TexteSvg x={L - MARGE.d} y={H - 6} fontSize={11} fill={p.texteDoux} fontFamily={police.texte600} textAnchor="end">{`${Math.round(eq.fcMax)} bpm`}</TexteSvg>
            <TexteSvg x={MARGE.g - 4} y={nuage.y(nuage.w1) + 10} fontSize={11} fill={p.texteDoux} fontFamily={police.texte600} textAnchor="end">{`${Math.round(nuage.w1)}`}</TexteSvg>
            <TexteSvg x={MARGE.g - 4} y={nuage.y(nuage.w0) - 2} fontSize={11} fill={p.texteDoux} fontFamily={police.texte600} textAnchor="end">{`${Math.round(nuage.w0)}`}</TexteSvg>
          </Svg>
          <View style={{ marginTop: 8 }}>
            <ListeCompacte lignes={eq.table.map((t) => ({ cle: String(t.fc), nom: `À ${t.fc} bpm`, valeur: `≈ ${t.watts} W` }))} />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
            {`Calculée sur tes ${eq.points.length} sorties de 12 semaines, d'après leur cardio et leurs watts moyens : une estimation, ${eq.r2 >= 0.6 ? 'plutôt fiable' : 'peu fiable'} (corrélation ${Math.round(eq.r2 * 100)} %). Jamais au-delà de ce que tu as roulé.`}
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux, marginTop: 6 }]}>Il faut au moins 6 sorties de 20 minutes avec cardio et watts, avec un cardio qui varie d'au moins 10 bpm, pour calculer l'équivalence.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  valeur: { fontFamily: police.titre700, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
});
