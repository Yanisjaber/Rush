import { Fragment, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as TexteSvg } from 'react-native-svg';
import { detailIntervalles, grapheDeBlocs, lignesIntervalles, texteValeur, type LigneDetail } from '@/data/calendrier/graphe-prevue';
import { COULEURS_ZONE, texteDuree, ZONES, type Bloc, type Reference } from '@/data/calendrier/structure';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le graphique d'une séance prévue et le tableau de ses intervalles (maquette 3 du 14 nov.) : une barre par segment, colorée par zone, à la hauteur de sa cible (l'allure la plus rapide en haut),
// avec les axes (cible à gauche, temps en bas) ; la valeur est écrite au-dessus de chaque effort. Dessous, le détail en lignes compactes : une pastille de durée, une pastille de zone avec sa cible,
// le libellé ; les répétitions sont encadrées avec leur « 3× ».
// Héros de la page 1 d'une séance prévue sans parcours.
const HAUTEUR = 132;
const G = 34; // la place des valeurs à gauche
const D = 6;
const H = 16; // la place de la valeur d'un effort au-dessus de sa barre
const B = 18; // la place du temps en bas
const ETAPES_MAX = 5; // au-delà, le détail s'arrête : le reste est sur la page 2

export function GrapheSeancePrevue({ blocs, couleur, reference, sport }: { blocs: Bloc[]; couleur: string; reference: Reference; sport: string }) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const g = grapheDeBlocs(blocs, reference, sport);
  if (!g) return null;
  const lignes = lignesIntervalles(blocs, reference, sport);
  const etapes = detailIntervalles(blocs, reference, sport);
  const etendue = Math.max(1, g.max - g.min);
  // Un peu d'air au-dessus et en dessous des cibles extrêmes
  const bas = g.min - etendue * 0.15;
  const haut = g.max + etendue * 0.15;
  const L = Math.max(1, largeur - G - D);
  const x = (min: number): number => G + (min / g.total) * L;
  // Allure : la valeur basse (rapide) en haut ; watts et cardio : la valeur haute en haut
  const y = (v: number): number => H + ((g.allure ? v - bas : haut - v) / (haut - bas)) * (HAUTEUR - H - B);
  const base = HAUTEUR - B;
  const reperes = g.allure ? [g.min, g.max] : [g.min, g.max];
  const pasTemps = g.total > 90 ? 30 : g.total > 40 ? 15 : 10;
  const temps: number[] = [];
  for (let t = 0; t <= g.total + 0.01; t += pasTemps) temps.push(t);
  const etiquette = `Profil de la séance, ${texteDuree(g.total)}. ${lignes.map((l) => `${l.repetitions > 1 ? `${l.repetitions} fois ` : ''}${l.nom}, ${l.effort}, ${l.cible}${l.recup ? `, récupération ${l.recup}` : ''}`).join(' ; ')}.`;

  return (
    <View accessible accessibilityLabel={etiquette} style={[styles.carte, { backgroundColor: p.surface, borderColor: p.trait }]}>
      <View style={[styles.bandeau, { backgroundColor: couleur }]} />
      <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}>
        {largeur > 0 ? (
          <Svg width="100%" height={HAUTEUR} viewBox={`0 0 ${largeur} ${HAUTEUR}`}>
            {reperes.map((v) => (
              <Fragment key={v}>
                <Line x1={G} x2={largeur - D} y1={y(v)} y2={y(v)} stroke={p.trait} strokeWidth={1} />
                <TexteSvg x={G - 5} y={y(v) + 3} fontSize={10} fontFamily={police.texte400} fill={p.texteMuet} textAnchor="end">
                  {texteValeur(v, g.metrique)}
                </TexteSvg>
              </Fragment>
            ))}
            {g.segments.map((s, i) => {
              const x0 = x(s.debut);
              const w = Math.max(2, x(s.fin) - x0 - 1.5);
              const yy = y(s.valeur);
              return (
                <Fragment key={i}>
                  <Rect x={x0} y={yy} width={w} height={Math.max(2, base - yy)} rx={2} fill={COULEURS_ZONE[Math.min(s.zone, COULEURS_ZONE.length - 1)]} />
                  {s.effort && w > 22 ? (
                    <TexteSvg x={x0 + w / 2} y={yy - 4} fontSize={10} fontFamily={police.texte600} fill={p.texte} textAnchor="middle">
                      {texteValeur(s.valeur, g.metrique)}
                    </TexteSvg>
                  ) : null}
                </Fragment>
              );
            })}
            {temps.map((t) => (
              <TexteSvg key={t} x={x(t)} y={HAUTEUR - 4} fontSize={10} fontFamily={police.texte400} fill={p.texteMuet} textAnchor={t === 0 ? 'start' : 'middle'}>
                {t === 0 ? '0' : `${t}′`}
              </TexteSvg>
            ))}
          </Svg>
        ) : (
          <View style={{ height: HAUTEUR }} />
        )}
      </View>

      <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.detail}>
        {etapes.slice(0, ETAPES_MAX).map((e, i) =>
          e.genre === 'ligne' ? (
            <Ligne key={i} ligne={e.ligne} metrique={g.metrique} />
          ) : (
            <View key={i} style={[styles.groupe, { borderColor: couleur }]}>
              <View style={[styles.badge, { backgroundColor: couleur }]}>
                <Text style={[typo.petit, { color: p.fond, fontFamily: police.texte600 }]}>{e.repetitions}×</Text>
              </View>
              {e.lignes.map((l, k) => (
                <Ligne key={k} ligne={l} metrique={g.metrique} />
              ))}
            </View>
          ),
        )}
        {etapes.length > ETAPES_MAX ? <Text style={[typo.petit, { color: p.texteMuet }]}>+ {etapes.length - ETAPES_MAX} blocs sur la page suivante</Text> : null}
      </View>
    </View>
  );
}

/** Une ligne du détail : la durée, la zone (pastille colorée avec sa cible) et un libellé. */
function Ligne({ ligne, metrique }: { ligne: LigneDetail; metrique: 'power' | 'hr' | 'pace' }) {
  const p = usePalette();
  const z = Math.min(ligne.zone, COULEURS_ZONE.length - 1);
  const couleurZone = COULEURS_ZONE[z];
  const nomZone = `Zone ${ligne.zone + 1}`;
  const existe = ZONES[metrique].noms.length > ligne.zone;
  return (
    <View style={styles.ligneDetail}>
      <View style={[styles.pastilleDuree, { backgroundColor: p.surface2 }]}>
        <Text style={[typo.petit, { color: p.texte }]}>{ligne.duree}</Text>
      </View>
      <View style={[styles.pastilleZone, { backgroundColor: avecAlpha(couleurZone, 0.2) }]}>
        <View style={[styles.rondZone, { backgroundColor: couleurZone }]} />
        <Text numberOfLines={1} style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{existe ? nomZone : `Z${ligne.zone + 1}`}</Text>
        <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet, flexShrink: 1 }]}>{ligne.cible}</Text>
      </View>
      {ligne.libelle ? <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux, flexShrink: 1 }]}>{ligne.libelle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: rayon.bloc, borderWidth: 1, padding: espace.e3, paddingTop: espace.e3 + 4, gap: espace.e2, overflow: 'hidden' },
  bandeau: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  detail: { gap: espace.e2 },
  ligneDetail: { flexDirection: 'row', alignItems: 'center', gap: espace.e2, minHeight: 30 },
  pastilleDuree: { minHeight: 30, paddingHorizontal: 10, borderRadius: rayon.rond, justifyContent: 'center' },
  pastilleZone: { minHeight: 30, paddingHorizontal: 10, borderRadius: rayon.rond, flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  rondZone: { width: 12, height: 12, borderRadius: 6 },
  groupe: { borderWidth: 1.5, borderRadius: 16, padding: espace.e2, paddingTop: espace.e3, gap: espace.e1, marginTop: espace.e1 },
  badge: { position: 'absolute', top: -11, left: 12, minHeight: 22, paddingHorizontal: 10, borderRadius: rayon.rond, justifyContent: 'center' },
});
