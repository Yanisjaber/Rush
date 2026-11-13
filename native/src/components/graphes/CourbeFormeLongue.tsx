import { Fragment, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { picCondition, type PointCondition } from '@/data/bilan/forme-longue';
import { dateCourte } from '@/data/bilan/records-texte';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La courbe de forme : la condition (CTL, ta charge d'entraînement lissée sur environ 6 semaines) semaine après semaine, avec ton pic marqué.
// Même principe que le niveau : on voit les 3 dernières années, un glissement vers la droite remonte dans le temps, un trait vertical marque chaque début d'année, l'axe reste fixe.
// Toucher la courbe lit la condition de la semaine touchée.
interface Props {
  semaines: PointCondition[];
  /** L'index (dans `semaines`) de la semaine touchée, ou null. */
  selection: number | null;
  onSelection: (index: number | null) => void;
  /** La couleur de la courbe : celle du sport quand le filtre en choisit un, sinon la couleur du texte. */
  couleur?: string;
}

const HAUTEUR = 170;
const G = 30;
const MARGE = 12;
const H = 12;
const B = 24;
const SEMAINES_VISIBLES = 52 * 3; // 3 ans visibles, les années d'avant sont derrière (on fait glisser)
const LARGEUR_DEFAUT = 320;

export function CourbeFormeLongue({ semaines, selection, onSelection, couleur }: Props) {
  const p = usePalette();
  const trait = couleur ?? p.texte;
  const defilement = useRef<ScrollViewInstance>(null);
  const [largeur, setLargeur] = useState(LARGEUR_DEFAUT);
  const n = semaines.length;
  const visible = Math.max(80, largeur - G);
  const pas = (visible - 2 * MARGE) / (SEMAINES_VISIBLES - 1);
  const x = (i: number): number => MARGE + i * pas;
  const contenu = Math.max(visible, 2 * MARGE + Math.max(0, n - 1) * pas);
  const pic = picCondition(semaines);
  const indexPic = pic ? semaines.findIndex((s) => s.lundi === pic.lundi) : -1;
  // L'échelle : de 0 au plus haut (arrondi à la dizaine au-dessus), le même pour tout l'historique
  const maxi = Math.max(10, Math.ceil((pic?.ctl ?? 10) / 10) * 10);
  const y = (v: number): number => H + ((maxi - v) / maxi) * (HAUTEUR - H - B);
  // Un trait vertical à chaque 1er janvier (la semaine qui contient le 1er janvier ou la première de l'année)
  const debutsAnnee: { an: string; i: number }[] = [];
  let anneePrecedente = '';
  semaines.forEach((s, i) => {
    const an = s.lundi.slice(0, 4);
    if (an !== anneePrecedente) {
      debutsAnnee.push({ an, i });
      anneePrecedente = an;
    }
  });
  const d = semaines.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.ctl).toFixed(1)}`).join(' ');
  const surface = n > 1 ? `${d} L${x(n - 1).toFixed(1)} ${y(0).toFixed(1)} L${x(0).toFixed(1)} ${y(0).toFixed(1)} Z` : '';
  const choisie = selection != null ? semaines[selection] : null;
  const dernier = semaines[n - 1];
  const etiquette = `Courbe de forme, de ${dateCourte(semaines[0]?.lundi ?? '')} à ${dateCourte(dernier?.lundi ?? '')}. ${pic ? `Pic de forme ${pic.ctl}, semaine du ${dateCourte(pic.lundi)}.` : ''}`;

  return (
    <View style={{ gap: espace.e3 }}>
      <View onLayout={(e) => setLargeur(e.nativeEvent.layout.width)} style={styles.zone}>
        <Svg width={G} height={HAUTEUR} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[0, maxi / 2, maxi].map((v) => (
            <TexteSvg key={v} x={G - 6} y={y(v) + 4} fontSize={11} fontFamily={v === maxi ? police.texte600 : police.texte400} fill={v === maxi ? p.texte : p.texteMuet} textAnchor="end">
              {Math.round(v)}
            </TexteSvg>
          ))}
        </Svg>
        <ScrollView
          ref={defilement}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          onContentSizeChange={() => defilement.current?.scrollToEnd({ animated: false })}
          accessibilityHint="Fais glisser vers la droite pour voir les années précédentes"
        >
          {/* Un appui sur la courbe lit la semaine touchée ; le glissement du doigt fait défiler */}
          <Pressable
            accessibilityRole="image"
            accessibilityLabel={etiquette}
            onPress={(e) => {
              if (n === 0) return;
              const i = Math.max(0, Math.min(n - 1, Math.round((e.nativeEvent.locationX - MARGE) / pas)));
              onSelection(selection === i ? null : i);
            }}
          >
            <Svg width={contenu} height={HAUTEUR}>
              {[0, maxi / 2, maxi].map((v) => (
                <Line key={v} x1={0} x2={contenu} y1={y(v)} y2={y(v)} stroke={v === maxi ? p.texteDoux : p.trait} strokeWidth={v === maxi ? 1.2 : 1} strokeDasharray={v === maxi ? '4 4' : undefined} />
              ))}
              {debutsAnnee.map(({ an, i }) => (
                <Fragment key={an}>
                  <Line x1={x(i)} x2={x(i)} y1={H} y2={HAUTEUR - B} stroke={p.trait} strokeWidth={1} />
                  <TexteSvg x={x(i) + 4} y={HAUTEUR - 6} fontSize={11} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="start">
                    {an}
                  </TexteSvg>
                </Fragment>
              ))}
              {n > 1 ? <Path d={surface} fill={trait} opacity={0.1} /> : null}
              {n > 1 ? <Path d={d} fill="none" stroke={trait} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" /> : null}
              {/* Ton pic : un rond creux sur la courbe */}
              {pic && indexPic >= 0 ? <Circle cx={x(indexPic)} cy={y(pic.ctl)} r={5.5} fill={p.fond} stroke={trait} strokeWidth={2.4} /> : null}
              {choisie ? (
                <>
                  <Line x1={x(selection as number)} x2={x(selection as number)} y1={H} y2={HAUTEUR - B} stroke={p.texteMuet} strokeWidth={1} strokeDasharray="3 3" />
                  <Circle cx={x(selection as number)} cy={y(choisie.ctl)} r={4.5} fill={trait} stroke={p.fond} strokeWidth={1.5} />
                </>
              ) : null}
            </Svg>
          </Pressable>
        </ScrollView>
      </View>

      {/* La lecture : la semaine touchée, sinon ton pic et ta forme d'aujourd'hui */}
      <View style={{ gap: espace.e1 }}>
        {choisie ? (
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.micro, { color: p.texteMuet }]}>SEMAINE DU {dateCourte(choisie.lundi).toUpperCase()}</Text>
            </View>
            <Text style={[styles.valeur, { color: p.texte }]}>{choisie.ctl}</Text>
          </View>
        ) : (
          <>
            {pic ? (
              <View style={styles.ligne}>
                <View style={{ flex: 1 }}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>Ton pic de forme</Text>
                  <Text style={[typo.petit, { color: p.texteMuet }]}>Semaine du {dateCourte(pic.lundi)}</Text>
                </View>
                <Text style={[styles.valeur, { color: p.texte }]}>{pic.ctl}</Text>
              </View>
            ) : null}
            {dernier ? (
              <View style={styles.ligne}>
                <View style={{ flex: 1 }}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>Aujourd'hui</Text>
                  <Text style={[typo.petit, { color: p.texteMuet }]}>Semaine du {dateCourte(dernier.lundi)}</Text>
                </View>
                <Text style={[styles.valeur, { color: p.texteDoux }]}>{dernier.ctl}</Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flexDirection: 'row' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  valeur: { fontFamily: police.titre800, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
});
