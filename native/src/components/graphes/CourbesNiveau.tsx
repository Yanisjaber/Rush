import { Fragment, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as TexteSvg } from 'react-native-svg';
import { moisDuTrimestre, nomTrimestre, type CourbeSport } from '@/data/bilan/niveau-trimestriel';
import { texteHM } from '@/data/outils/format';
import { espace } from '@/theme/couleurs';
import { SPORTS } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le niveau trimestre par trimestre : une courbe de 0 à 100 par sport, dans la couleur du sport. La note d'un trimestre combine ses heures, sa charge et les records posés pendant ces trois mois
// (voir data/bilan/niveau-trimestriel.ts) ; 100 = ton meilleur trimestre de ce sport.
// On voit les 5 dernières années ; un glissement du doigt vers la droite remonte dans le temps. Un trait vertical marque chaque début d'année, l'axe 0 / 50 / 100 reste fixe.
// Toucher un trimestre le choisit : sous le dessin, la note de chaque sport pour ce trimestre (sinon, le meilleur trimestre de chaque sport).
interface Props {
  /** Tous les trimestres, dans l'ordre (« 2026-T1 »). */
  trimestres: string[];
  courbes: CourbeSport[];
  /** La couleur de chaque sport (par famille). */
  couleurs: Record<string, string>;
  /** Le trimestre touché (rang dans `trimestres`), ou null. */
  selection: number | null;
  onSelection: (index: number | null) => void;
}

const HAUTEUR = 200;
const G = 30; // la place des notes à gauche (axe fixe)
const MARGE = 12; // un peu d'air de chaque côté de la courbe
const H = 12;
const B = 24; // la place des années en bas
const TRIMESTRES_VISIBLES = 20; // 5 ans
const LARGEUR_DEFAUT = 320;

const nomSport = (famille: string): string => (Object.hasOwn(SPORTS, famille) ? SPORTS[famille as keyof typeof SPORTS].court : famille);
const heures = (h: number): string => texteHM(Math.round(h * 60));
/** Les trois faits d'un trimestre, écrits : « 51h40 · 2 140 pts · 2 records » */
const faits = (pt: { heures: number; charge: number; records: number }): string =>
  [heures(pt.heures), pt.charge > 0 ? `${Math.round(pt.charge).toLocaleString('fr-FR')} pts` : '', pt.records > 0 ? `${pt.records} ${pt.records > 1 ? 'records' : 'record'}` : ''].filter(Boolean).join(' · ');

const y = (note: number): number => H + ((100 - note) / 100) * (HAUTEUR - H - B);

export function CourbesNiveau({ trimestres, courbes, couleurs, selection, onSelection }: Props) {
  const p = usePalette();
  const defilement = useRef<ScrollViewInstance>(null);
  const [largeur, setLargeur] = useState(LARGEUR_DEFAUT);
  const n = trimestres.length;
  // La zone qui défile : 20 trimestres tiennent dans l'écran, les autres sont derrière (à gauche, plus anciens)
  const visible = Math.max(80, largeur - G);
  const pas = (visible - 2 * MARGE) / (TRIMESTRES_VISIBLES - 1);
  const x = (i: number): number => MARGE + i * pas;
  const contenu = Math.max(visible, 2 * MARGE + Math.max(0, n - 1) * pas);
  const rang = new Map(trimestres.map((t, i) => [t, i]));
  // Un trait vertical et l'année à chaque début d'année (T1) ; le premier trimestre affiché n'écrit son année que s'il y a la place avant le premier trait
  const debutsAnnee = trimestres.map((t, i) => ({ t, i })).filter(({ t }) => t.endsWith('-T1'));
  const premierT1 = debutsAnnee[0]?.i ?? Infinity;
  const premiereAnnee = n > 0 && !trimestres[0].endsWith('-T1') && premierT1 * pas >= 40 ? [{ t: trimestres[0], i: 0 }] : [];
  const etiquette = `Niveau trimestre par trimestre, de ${nomTrimestre(trimestres[0] ?? '')} à ${nomTrimestre(trimestres[n - 1] ?? '')}. ${courbes.map((c) => `${nomSport(c.famille)} : meilleur trimestre ${nomTrimestre(c.meilleur.trimestre)}, ${faits(c.meilleur)}`).join(' ; ')}.`;
  const choisiT = selection != null ? trimestres[selection] : null;

  return (
    <View style={{ gap: espace.e3 }}>
      <View onLayout={(e) => setLargeur(e.nativeEvent.layout.width)} style={styles.zone}>
        {/* L'axe des notes, fixe : il ne bouge pas quand on fait glisser le graphique */}
        <Svg width={G} height={HAUTEUR} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[0, 50, 100].map((v) => (
            <TexteSvg key={v} x={G - 6} y={y(v) + 4} fontSize={11} fontFamily={v === 100 ? police.texte600 : police.texte400} fill={v === 100 ? p.texte : p.texteMuet} textAnchor="end">
              {v}
            </TexteSvg>
          ))}
        </Svg>
        {/* Le graphique : on le fait glisser vers la droite pour remonter dans le temps ; il démarre sur les trimestres les plus récents */}
        <ScrollView
          ref={defilement}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          onContentSizeChange={() => defilement.current?.scrollToEnd({ animated: false })}
          accessibilityHint="Fais glisser vers la droite pour voir les années précédentes"
        >
          <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width={contenu} height={HAUTEUR}>
            {[0, 50, 100].map((v) => (
              <Line key={v} x1={0} x2={contenu} y1={y(v)} y2={y(v)} stroke={v === 100 ? p.texteDoux : p.trait} strokeWidth={v === 100 ? 1.2 : 1} strokeDasharray={v === 100 ? '4 4' : undefined} />
            ))}
            {/* Un trait vertical à chaque début d'année, avec l'année écrite en bas */}
            {debutsAnnee.map(({ t, i }) => (
              <Fragment key={t}>
                <Line x1={x(i)} x2={x(i)} y1={H} y2={HAUTEUR - B} stroke={p.trait} strokeWidth={1} />
                <TexteSvg x={x(i) + 4} y={HAUTEUR - 6} fontSize={11} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="start">
                  {t.slice(0, 4)}
                </TexteSvg>
              </Fragment>
            ))}
            {premiereAnnee.map(({ t, i }) => (
              <TexteSvg key={t} x={x(i)} y={HAUTEUR - 6} fontSize={11} fontFamily={police.texte500} fill={p.texteDoux} textAnchor="start">
                {t.slice(0, 4)}
              </TexteSvg>
            ))}
            {selection != null ? <Line x1={x(selection)} x2={x(selection)} y1={H} y2={HAUTEUR - B} stroke={p.texteMuet} strokeWidth={1} strokeDasharray="3 3" /> : null}
            {courbes.map((c) => {
              const couleur = couleurs[c.famille] ?? p.sportNeutre;
              const pts = c.points.filter((pt) => rang.has(pt.trimestre));
              const d = pts.map((pt, k) => `${k ? 'L' : 'M'}${x(rang.get(pt.trimestre) as number).toFixed(1)} ${y(pt.note).toFixed(1)}`).join(' ');
              const meilleur = rang.has(c.meilleur.trimestre) ? c.meilleur : null;
              const choisi = choisiT ? pts.find((pt) => pt.trimestre === choisiT) : null;
              return (
                <Fragment key={c.famille}>
                  {pts.length > 1 ? <Path d={d} fill="none" stroke={couleur} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" /> : null}
                  {pts.length === 1 ? <Circle cx={x(rang.get(pts[0].trimestre) as number)} cy={y(pts[0].note)} r={3} fill={couleur} /> : null}
                  {/* Ton meilleur trimestre de ce sport : un rond creux sur la ligne des 100 */}
                  {meilleur ? <Circle cx={x(rang.get(meilleur.trimestre) as number)} cy={y(100)} r={5.5} fill={p.fond} stroke={couleur} strokeWidth={2.4} /> : null}
                  {choisi ? <Circle cx={x(rang.get(choisi.trimestre) as number)} cy={y(choisi.note)} r={4.5} fill={couleur} stroke={p.fond} strokeWidth={1.5} /> : null}
                </Fragment>
              );
            })}
            {/* Les zones à toucher : une colonne par trimestre. Un appui choisit le trimestre, un second appui le désélectionne ; le glissement du doigt fait défiler. */}
            {trimestres.map((t, i) => (
              <Rect key={`zone-${t}`} x={x(i) - pas / 2} y={0} width={pas} height={HAUTEUR} fill="transparent" onPress={() => onSelection(selection === i ? null : i)} />
            ))}
          </Svg>
        </ScrollView>
      </View>

      {/* La lecture : sans trimestre touché, le meilleur trimestre de chaque sport ; sinon la note de chaque sport pour le trimestre touché */}
      <View style={{ gap: espace.e1 }}>
        <Text style={[typo.micro, { color: p.texteMuet }]}>{choisiT ? `${nomTrimestre(choisiT)} · ${moisDuTrimestre(choisiT)}`.toUpperCase() : 'TON MEILLEUR TRIMESTRE, PAR SPORT'}</Text>
        {courbes.map((c) => {
          const couleur = couleurs[c.famille] ?? p.sportNeutre;
          const pt = choisiT ? c.points.find((x2) => x2.trimestre === choisiT) : c.meilleur;
          const sous = choisiT ? (pt ? `${faits(pt)}${pt.enCours ? ' · trimestre en cours' : ''}` : 'avant ton premier trimestre') : `${nomTrimestre(c.meilleur.trimestre)} · ${faits(c.meilleur)}`;
          return (
            <View key={c.famille} accessible accessibilityLabel={`${nomSport(c.famille)}, ${pt ? `note ${pt.note}` : 'pas de note'}, ${sous}`} style={styles.ligne}>
              <View style={[styles.pastille, { backgroundColor: couleur }]} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>{nomSport(c.famille)}</Text>
                <Text numberOfLines={2} style={[typo.petit, { color: p.texteMuet }]}>{sous}</Text>
              </View>
              <Text style={[styles.note, { color: p.texte }]}>{pt ? pt.note : '—'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flexDirection: 'row' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  note: { fontFamily: police.titre800, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
});
