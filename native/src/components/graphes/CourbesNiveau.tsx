import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as TexteSvg } from 'react-native-svg';
import { ZoneTactile } from '@/components/graphes/ZoneTactile';
import { moisDuTrimestre, nomTrimestre, type CourbeSport } from '@/data/bilan/niveau-trimestriel';
import { texteHM } from '@/data/outils/format';
import { espace } from '@/theme/couleurs';
import { SPORTS } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le niveau trimestre par trimestre : une courbe de 0 à 100 par sport, dans la couleur du sport. La note d'un trimestre combine ses heures, sa charge et les records posés pendant ces trois mois
// (voir data/bilan/niveau-trimestriel.ts) ; 100 = ton meilleur trimestre de ce sport.
// Toucher le graphique choisit un trimestre : sous le dessin, la note de chaque sport pour ce trimestre (sinon, le meilleur trimestre de chaque sport).
interface Props {
  /** Les trimestres affichés, dans l'ordre (« 2026-T1 »). */
  trimestres: string[];
  courbes: CourbeSport[];
  /** La couleur de chaque sport (par famille). */
  couleurs: Record<string, string>;
  /** Le trimestre touché (rang dans `trimestres`), ou null. */
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
/** Les trois faits d'un trimestre, écrits : « 51h40 · 2 140 pts · 2 records » */
const faits = (pt: { heures: number; charge: number; records: number }): string =>
  [heures(pt.heures), pt.charge > 0 ? `${Math.round(pt.charge).toLocaleString('fr-FR')} pts` : '', pt.records > 0 ? `${pt.records} ${pt.records > 1 ? 'records' : 'record'}` : ''].filter(Boolean).join(' · ');

export function CourbesNiveau({ trimestres, courbes, couleurs, selection, onSelection }: Props) {
  const p = usePalette();
  const n = trimestres.length;
  const pas = n > 1 ? (LARGEUR - G - D) / (n - 1) : 0;
  const x = (i: number): number => (n > 1 ? G + i * pas : (G + LARGEUR - D) / 2);
  const y = (note: number): number => H + ((100 - note) / 100) * (HAUTEUR - H - B);
  const rang = new Map(trimestres.map((t, i) => [t, i]));
  // Les années écrites sous la courbe : à chaque T1, et au premier trimestre affiché (sauf quand le T1 suivant est à moins de 2 trimestres : les deux années s'écriraient l'une sur l'autre)
  const premiersT1 = trimestres.map((t, i) => ({ t, i })).filter(({ t }) => t.endsWith('-T1'));
  const premierT1 = premiersT1[0]?.i ?? Infinity;
  const annees = trimestres.map((t, i) => ({ t, i })).filter(({ t, i }) => (i === 0 && (t.endsWith('-T1') || premierT1 >= 2)) || (i > 0 && t.endsWith('-T1')));
  const indexDe = (xTactile: number, largeur: number): number | null => {
    if (n === 0 || largeur <= 0) return null;
    const xSvg = (xTactile / largeur) * LARGEUR;
    return Math.max(0, Math.min(n - 1, Math.round((xSvg - G) / (pas || 1))));
  };
  const etiquette = `Niveau trimestre par trimestre, de ${nomTrimestre(trimestres[0] ?? '')} à ${nomTrimestre(trimestres[n - 1] ?? '')}. ${courbes.map((c) => `${nomSport(c.famille)} : meilleur trimestre ${nomTrimestre(c.meilleur.trimestre)}, ${faits(c.meilleur)}`).join(' ; ')}.`;
  const choisiT = selection != null ? trimestres[selection] : null;

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
          {annees.map(({ t, i }) => (
            <TexteSvg key={t} x={x(i)} y={HAUTEUR - 6} fontSize={11} fontFamily={police.texte500} fill={p.texteDoux} textAnchor={i === 0 ? 'start' : 'middle'}>
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
        </Svg>
      </ZoneTactile>

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
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  note: { fontFamily: police.titre800, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'], minWidth: 48, textAlign: 'right' },
});
