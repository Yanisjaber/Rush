import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { ZoneTactile } from '@/components/graphes/ZoneTactile';
import { nomMois, type CourbeSport } from '@/data/bilan/niveau-mensuel';
import { texteHM } from '@/data/outils/format';
import { espace } from '@/theme/couleurs';
import { SPORTS } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le niveau mois par mois : une courbe de 0 à 100 par sport, dans la couleur du sport. La note d'un mois combine ses heures, sa charge et les records posés ce mois-là
// (voir data/bilan/niveau-mensuel.ts) ; 100 = ton meilleur mois de ce sport.
// Toucher le graphique choisit un mois : sous le dessin, la note de chaque sport pour ce mois (sinon, le meilleur mois de chaque sport).
interface Props {
  /** Les mois affichés, dans l'ordre (« 2026-03 »). */
  mois: string[];
  courbes: CourbeSport[];
  /** La couleur de chaque sport (par famille). */
  couleurs: Record<string, string>;
  /** Le mois touché (rang dans `mois`), ou null. */
  selection: number | null;
  onSelection: (index: number | null) => void;
}

const LARGEUR = 320;
const HAUTEUR = 200;
const G = 30; // la place des notes à gauche
const D = 10;
const H = 12;
const B = 24; // la place des années en bas

const nomSport = (famille: string): string => (Object.hasOwn(SPORTS, famille) ? SPORTS[famille as keyof typeof SPORTS].court : famille);
const heures = (h: number): string => texteHM(Math.round(h * 60));
/** Les trois faits d'un mois, écrits : « 51h40 · 2 140 pts · 2 records » */
const faits = (pt: { heures: number; charge: number; records: number }): string =>
  [heures(pt.heures), pt.charge > 0 ? `${Math.round(pt.charge).toLocaleString('fr-FR')} pts` : '', pt.records > 0 ? `${pt.records} ${pt.records > 1 ? 'records' : 'record'}` : ''].filter(Boolean).join(' · ');

export function CourbesNiveau({ mois, courbes, couleurs, selection, onSelection }: Props) {
  const p = usePalette();
  const n = mois.length;
  const pas = n > 1 ? (LARGEUR - G - D) / (n - 1) : 0;
  const x = (i: number): number => (n > 1 ? G + i * pas : (G + LARGEUR - D) / 2);
  const y = (note: number): number => H + ((100 - note) / 100) * (HAUTEUR - H - B);
  const rang = new Map(mois.map((m, i) => [m, i]));
  // Les années écrites sous la courbe : au premier mois affiché et à chaque janvier
  // (sauf le premier quand le janvier suivant est à moins de 4 mois : les deux années s'écriraient l'une sur l'autre)
  const janviers = mois.map((m, i) => ({ m, i })).filter(({ m }) => m.endsWith('-01'));
  const premierJanvier = janviers[0]?.i ?? Infinity;
  const annees = mois.map((m, i) => ({ m, i })).filter(({ m, i }) => (i === 0 && (m.endsWith('-01') || premierJanvier >= 4)) || (i > 0 && m.endsWith('-01')));
  const indexDe = (xTactile: number, largeur: number): number | null => {
    if (n === 0 || largeur <= 0) return null;
    const xSvg = (xTactile / largeur) * LARGEUR;
    return Math.max(0, Math.min(n - 1, Math.round((xSvg - G) / (pas || 1))));
  };
  const etiquette = `Niveau mois par mois, de ${nomMois(mois[0] ?? '')} à ${nomMois(mois[n - 1] ?? '')}. ${courbes.map((c) => `${nomSport(c.famille)} : meilleur mois ${nomMois(c.meilleur.mois)}, ${faits(c.meilleur)}`).join(' ; ')}.`;
  const moisChoisi = selection != null ? mois[selection] : null;

  return (
    <View style={{ gap: espace.e3 }}>
      <ZoneTactile indexDe={indexDe} selection={selection} onSelection={onSelection}>
        <Svg accessible accessibilityRole="image" accessibilityLabel={etiquette} width="100%" viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} style={{ aspectRatio: LARGEUR / HAUTEUR }}>
          {[0, 50, 100].map((v) => (
            <Fragment key={v}>
              <Line x1={G} x2={LARGEUR - D} y1={y(v)} y2={y(v)} stroke={v === 100 ? p.texteDoux : p.trait} strokeWidth={v === 100 ? 1.2 : 1} strokeDasharray={v === 100 ? '4 4' : undefined} />
              <TexteSvg x={G - 6} y={y(v) + 4} fontSize={11} fontFamily={v === 100 ? police.texte600 : police.texte400} fill={v === 100 ? p.texte : p.texteMuet} textAnchor="end">
                {v}
              </TexteSvg>
            </Fragment>
          ))}
          {annees.map(({ m, i }) => (
            <TexteSvg key={m} x={x(i)} y={HAUTEUR - 6} fontSize={11} fontFamily={police.texte500} fill={p.texteDoux} textAnchor={i === 0 ? 'start' : 'middle'}>
              {m.slice(0, 4)}
            </TexteSvg>
          ))}
          {selection != null ? <Line x1={x(selection)} x2={x(selection)} y1={H} y2={HAUTEUR - B} stroke={p.texteMuet} strokeWidth={1} strokeDasharray="3 3" /> : null}
          {courbes.map((c) => {
            const couleur = couleurs[c.famille] ?? p.sportNeutre;
            const pts = c.points.filter((pt) => rang.has(pt.mois));
            const d = pts.map((pt, k) => `${k ? 'L' : 'M'}${x(rang.get(pt.mois) as number).toFixed(1)} ${y(pt.note).toFixed(1)}`).join(' ');
            const meilleur = rang.has(c.meilleur.mois) ? c.meilleur : null;
            const choisi = moisChoisi ? pts.find((pt) => pt.mois === moisChoisi) : null;
            return (
              <Fragment key={c.famille}>
                {pts.length > 1 ? <Path d={d} fill="none" stroke={couleur} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" /> : null}
                {pts.length === 1 ? <Circle cx={x(rang.get(pts[0].mois) as number)} cy={y(pts[0].note)} r={3} fill={couleur} /> : null}
                {/* Ton meilleur mois de ce sport : un rond creux sur la ligne des 100 */}
                {meilleur ? <Circle cx={x(rang.get(meilleur.mois) as number)} cy={y(100)} r={5.5} fill={p.fond} stroke={couleur} strokeWidth={2.4} /> : null}
                {choisi ? <Circle cx={x(rang.get(choisi.mois) as number)} cy={y(choisi.note)} r={4.5} fill={couleur} stroke={p.fond} strokeWidth={1.5} /> : null}
              </Fragment>
            );
          })}
        </Svg>
      </ZoneTactile>

      {/* La lecture : sans mois touché, le meilleur mois de chaque sport ; sinon la note de chaque sport pour le mois touché */}
      <View style={{ gap: espace.e1 }}>
        <Text style={[typo.micro, { color: p.texteMuet }]}>{moisChoisi ? nomMois(moisChoisi).toUpperCase() : 'TON MEILLEUR MOIS, PAR SPORT'}</Text>
        {courbes.map((c) => {
          const couleur = couleurs[c.famille] ?? p.sportNeutre;
          const pt = moisChoisi ? c.points.find((x2) => x2.mois === moisChoisi) : c.meilleur;
          const sous = moisChoisi ? (pt ? `${faits(pt)}${pt.enCours ? ' · mois en cours' : ''}` : 'avant ton premier mois') : `${nomMois(c.meilleur.mois)} · ${faits(c.meilleur)}`;
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
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  note: { fontFamily: police.titre800, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
});
