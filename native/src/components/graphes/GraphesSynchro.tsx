import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import type { CourbesSortie } from '@/data/outils/courbes-sortie';
import { aireSousCourbe, echelle, lisse } from '@/data/outils/courbes';
import { formatAllure, formatKm, formatNombre } from '@/data/outils/format';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les courbes de la sortie l'une sous l'autre (allure ou vitesse, cœur, cadence, puissance), sur le même axe de distance : un seul curseur,
// qu'on glisse au doigt, donne la valeur de chaque mesure au même endroit.
// Le relief (altitude) est dessiné en silhouette derrière chaque courbe, et le cœur est posé sur ses zones colorées.
// Un doigt : le curseur commun. Deux doigts : on entoure une portion ; quand on les lève, les courbes se recalculent sur cette portion (moyenne à gauche, max à droite,
// et distance / vitesse de la portion dans la barre du haut). « Tout voir » revient à la sortie entière.
interface Props {
  courbes: CourbesSortie;
  /** Distance de la sortie (km), si les flux n'en ont pas. */
  km: number | null;
  /** Course : l'allure ; vélo : la vitesse. */
  rythme: 'allure' | 'vitesse';
  couleur: string;
  /** La durée de la sortie (s), pour le laps de temps d'une portion quand les courbes sont découpées par durée (sans distance dans les flux). */
  dureeS?: number | null;
  /** La hauteur disponible pour tout le bloc (barre du haut, courbes, axe) : les courbes s'y adaptent. */
  hauteur: number;
  /** Début des zones cardio Z3, Z4 et Z5 (bpm), pour colorer le fond de la courbe de cœur. Absent sans FC max ni seuil. */
  seuilsCoeur?: [number, number, number] | null;
  /** Le doigt est posé sur les courbes : l'écran suspend le balayage des pages. */
  onGlisse?: (actif: boolean) => void;
}

/** 222 s → « 3 min 42 » ; 45 s → « 45 s » ; 3720 s → « 1h02 ». */
function formatLaps(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
  return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

const MARGE = 6;
const ENTETE = 20; // une ligne par courbe : moyenne à gauche, nom au milieu, max à droite
const HAUT_BARRE = 36; // la barre du haut : conseil de geste, ou les données de la portion zoomée
const HAUT_AXE = 16;
const ECART_MIN = 0.05; // une portion fait au moins 5 % de la vue

interface Serie {
  cle: string;
  titre: string;
  valeurs: number[];
  couleur: string;
  /** Valeur lisible pour un point (v), la moyenne ou le max. */
  texte: (v: number) => string;
  /** Sens inversé : la plus petite valeur en haut (l'allure : plus c'est rapide, plus c'est haut) ; le « max » est alors la valeur la plus basse (l'allure la plus rapide). */
  inverse?: boolean;
}

export function GraphesSynchro({ courbes, km, rythme, couleur, dureeS, hauteur, seuilsCoeur, onGlisse }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const [fraction, setFraction] = useState<number | null>(null); // le curseur à un doigt, dans la vue
  const [sel, setSel] = useState<[number, number] | null>(null); // la portion qu'on entoure à deux doigts, dans la vue
  const [vue, setVue] = useState<[number, number]>([0, 1]); // la partie de la sortie affichée (0 à 1 = tout)
  const bloc = useRef<ComponentRef<typeof View>>(null);
  const gauche = useRef(0); // le bord gauche du bloc à l'écran : pageX est stable d'un bout à l'autre du geste, locationX saute d'un élément à l'autre
  const geste = useRef<'curseur' | 'plage' | null>(null);
  const tap = useRef({ debut: 0, x: 0, bouge: false, dernier: 0 }); // pour reconnaître un double-tap : deux touchers brefs, sans glisser, rapprochés dans le temps
  const refs = useRef({ largeur: 0, onGlisse, sel, vue });
  refs.current = { largeur, onGlisse, sel, vue };
  const distance = courbes.km ?? km;

  const series: Serie[] = [];
  if (courbes.vitesse) {
    if (rythme === 'allure') series.push({ cle: 'allure', titre: 'ALLURE', valeurs: courbes.vitesse.map((v) => Math.min(1200, Math.max(150, 1000 / v))), couleur, texte: (v) => formatAllure(v), inverse: true });
    else series.push({ cle: 'vitesse', titre: 'VITESSE', valeurs: courbes.vitesse.map((v) => v * 3.6), couleur, texte: (v) => `${formatKm(v, 1)} km/h` });
  }
  if (courbes.fc) series.push({ cle: 'fc', titre: 'CŒUR', valeurs: courbes.fc, couleur: p.danger, texte: (v) => `${Math.round(v)} bpm` });
  if (courbes.cadence) series.push({ cle: 'cadence', titre: 'CADENCE', valeurs: courbes.cadence, couleur: p.texteDoux, texte: (v) => `${Math.round(v)} ${rythme === 'vitesse' ? 'tr/min' : 'pas/min'}` });
  if (courbes.watts) series.push({ cle: 'watts', titre: 'PUISSANCE', valeurs: courbes.watts, couleur: p.texteDoux, texte: (v) => `${Math.round(v)} W` });
  // Sans autre courbe, l'altitude s'affiche seule ; sinon elle sert de fond (silhouette) à toutes les autres
  const reliefComplet = courbes.altitude ?? null;
  if (!series.length && reliefComplet) series.push({ cle: 'altitude', titre: 'ALTITUDE', valeurs: reliefComplet, couleur: p.texteDoux, texte: (v) => `${formatNombre(Math.round(v))} m` });
  if (!series.length) return null;

  const n = courbes.n;
  const hSerie = Math.max(34, Math.floor((hauteur - HAUT_BARRE - HAUT_AXE) / series.length) - ENTETE);
  // La partie affichée : les points de la vue (au moins 8, pour que la courbe reste une courbe)
  const [d0, d1] = vue;
  const ia = Math.min(n - 8, Math.max(0, Math.floor(d0 * (n - 1))));
  const ib = Math.max(ia + 7, Math.min(n - 1, Math.ceil(d1 * (n - 1))));
  const coupe = (v: number[]) => v.slice(ia, ib + 1);
  const relief = reliefComplet ? coupe(reliefComplet) : null;
  const zoome = d0 > 0 || d1 < 1;

  const versFraction = (x: number) => Math.min(1, Math.max(0, (x - MARGE) / Math.max(1, refs.current.largeur - 2 * MARGE)));
  const traiter = (xs: number[]) => {
    refs.current.onGlisse?.(true);
    if (xs.length >= 2) {
      // Deux doigts : la portion entre eux (le curseur disparaît)
      geste.current = 'plage';
      setFraction(null);
      const a = versFraction(Math.min(xs[0], xs[1]));
      const b = versFraction(Math.max(xs[0], xs[1]));
      setSel(b - a < ECART_MIN ? [Math.max(0, Math.min(a, 1 - ECART_MIN)), Math.max(0, Math.min(a, 1 - ECART_MIN)) + ECART_MIN] : [a, b]);
    } else if (geste.current !== 'plage') {
      if (geste.current === null) tap.current = { ...tap.current, debut: Date.now(), x: xs[0], bouge: false };
      else if (Math.abs(xs[0] - tap.current.x) > 8) tap.current.bouge = true;
      // Un doigt (et pas un doigt resté après les deux) : le curseur
      geste.current = 'curseur';
      setFraction(versFraction(xs[0]));
    }
  };
  const fin = () => {
    // Tous les doigts sont levés : si on entourait une portion, la vue se recalcule dessus (les zooms se composent)
    const s = refs.current.sel;
    const t = tap.current;
    const bref = geste.current === 'curseur' && !t.bouge && Date.now() - t.debut < 250;
    if (bref) {
      // Un toucher bref : le deuxième, dans les 350 ms, ramène la sortie entière
      if (Date.now() - t.dernier < 350) {
        setVue([0, 1]);
        t.dernier = 0;
      } else t.dernier = Date.now();
    }
    if (geste.current === 'plage' && s) {
      const [v0, v1] = refs.current.vue;
      setVue([v0 + s[0] * (v1 - v0), v0 + s[1] * (v1 - v0)]);
    }
    geste.current = null;
    setSel(null);
    setFraction(null);
    refs.current.onGlisse?.(false);
  };
  const xsDe = (touches: readonly { pageX: number }[]) => touches.map((t) => t.pageX - gauche.current);

  const i = fraction == null ? null : ia + Math.round(fraction * (ib - ia));
  const x = fraction == null ? null : MARGE + fraction * (largeur - 2 * MARGE);
  const xa = sel ? MARGE + sel[0] * (largeur - 2 * MARGE) : 0;
  const xb = sel ? MARGE + sel[1] * (largeur - 2 * MARGE) : 0;
  const hauteurBloc = series.length * (hSerie + ENTETE);

  // Les chiffres de la barre du haut : la portion qu'on entoure, sinon la vue affichée
  const [p0, p1] = sel ? [ia + sel[0] * (ib - ia), ia + sel[1] * (ib - ia)] : [ia, ib];
  const kmPortion = distance != null ? (distance * (p1 - p0)) / (n - 1) : null;
  // Le laps de temps de la portion : avec la distance dans les flux, c'est distance × moyenne de (1 / vitesse) ; sinon la part de la durée totale
  const lapsS = (() => {
    const v = courbes.vitesse;
    if (courbes.km != null && v && kmPortion != null) {
      const tranche = v.slice(Math.max(0, Math.floor(p0)), Math.min(n - 1, Math.ceil(p1)) + 1);
      return tranche.length ? kmPortion * 1000 * (tranche.reduce((a, e) => a + 1 / e, 0) / tranche.length) : null;
    }
    return courbes.km == null && dureeS ? (dureeS * (p1 - p0)) / (n - 1) : null;
  })();

  // Le relief de la portion : la pente moyenne (dénivelé net / distance) et le D+ (somme des montées entre deux points). Estimations : l'altitude des courbes est lissée.
  const relief2 = (() => {
    const alt = reliefComplet;
    if (!alt || kmPortion == null || kmPortion <= 0) return null;
    const a = (x: number) => {
      const k = Math.min(n - 2, Math.max(0, Math.floor(x)));
      return alt[k] + (alt[k + 1] - alt[k]) * (x - k);
    };
    let dPlus = 0;
    const debut = Math.ceil(p0);
    const fin2 = Math.floor(p1);
    for (let k = debut; k < fin2; k++) dPlus += Math.max(0, alt[k + 1] - alt[k]);
    return { pente: ((a(p1) - a(p0)) / (kmPortion * 1000)) * 100, dPlus };
  })();
  const textePente = (v: number) => (Math.abs(v) < 0.05 ? '0 %' : `${v > 0 ? '+' : '−'}${formatKm(Math.abs(v), 1)} %`);

  // La silhouette du relief : la même pour toutes les courbes (échelle propre à l'altitude)
  const reliefChemin = (l: number, h: number) => {
    if (!relief || l <= 0) return null;
    const pts = echelle(relief, l, h, MARGE);
    return aireSousCourbe(lisse(pts), pts, h);
  };
  // Les bandes de zones du cœur : trois fonds de plus en plus soutenus (Z3, Z4, Z5)
  const bandesCoeur = (s: Serie, v: number[], l: number, h: number) => {
    if (s.cle !== 'fc' || !seuilsCoeur) return null;
    const bas = Math.min(...v);
    const haut = Math.max(...v);
    const y = (val: number) => MARGE + (1 - (Math.min(haut, Math.max(bas, val)) - bas) / (haut - bas || 1)) * (h - 2 * MARGE);
    const [z3, z4, z5] = seuilsCoeur;
    const bande = (de: number, a: number, teinte: string) => (y(de) - y(a) > 0.5 ? <Rect key={teinte} x={0} y={y(a)} width={l} height={y(de) - y(a)} fill={teinte} /> : null);
    return (
      <>
        {bande(z3, z4, p.danger + '1a')}
        {bande(z4, z5, p.danger + '33')}
        {bande(z5, 999, p.danger + '55')}
      </>
    );
  };

  return (
    <View>
      <View style={[styles.barre, { height: HAUT_BARRE }]}>
        {zoome || sel ? (
          <>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.valeur, { color: p.texte }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {[
                  kmPortion != null ? `${formatKm(kmPortion, 2)} km` : null,
                  lapsS != null ? formatLaps(lapsS) : null,
                  relief2 ? `pente ${textePente(relief2.pente)}` : null,
                  relief2 ? `D+ ${formatNombre(Math.round(relief2.dPlus))} m` : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
              {zoome && !sel ? <Text style={[typo.petit, { color: p.texteMuet, fontSize: 12, lineHeight: 14 }]}>Double-tap : tout voir</Text> : null}
            </View>
          </>
        ) : (
          <Text style={[typo.petit, { color: p.texteMuet }]} numberOfLines={1}>
            {i != null && distance != null ? `km ${formatKm((distance * i) / (n - 1), 1)}` : 'Un doigt pour lire, deux doigts pour zoomer'}
          </Text>
        )}
      </View>
      <View
        ref={bloc}
        onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)}
        // Le doigt se pose : le curseur apparaît tout de suite ; il suit le doigt (pageX). Un second doigt entoure une portion.
        onTouchStart={(e) => {
          const pageX = e.nativeEvent.touches.map((t) => t.pageX);
          bloc.current?.measureInWindow((x0) => {
            gauche.current = x0;
            traiter(pageX.map((v) => v - x0));
          });
        }}
        onTouchMove={(e) => traiter(xsDe(e.nativeEvent.touches))}
        onTouchEnd={(e) => {
          if (e.nativeEvent.touches.length === 0) fin();
        }}
        onTouchCancel={fin}
        accessible
        accessibilityLabel="Courbes de la sortie, un doigt pour lire les valeurs, deux doigts pour zoomer sur une portion"
        style={[styles.bloc, { backgroundColor: p.surface, height: hauteurBloc }]}
      >
        {series.map((s, k) => {
          const v = coupe(s.valeurs);
          const moy = v.reduce((a, b) => a + b, 0) / v.length;
          const haut = Math.max(...v);
          const bas = Math.min(...v);
          const points = largeur > 0 ? echelle(s.inverse ? v.map((e) => -e) : v, largeur, hSerie, MARGE) : [];
          const fond = s.cle === 'altitude' ? null : reliefChemin(largeur, hSerie);
          return (
            <View key={s.cle} style={[k > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.entete, { height: ENTETE }]}>
                <Text style={[styles.valeur, { color: p.texte, flex: 1 }]} numberOfLines={1}>
                  {s.texte(moy)}
                </Text>
                <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2 }]}>{s.titre}</Text>
                <Text style={[styles.valeur, { color: p.texte, flex: 1, textAlign: 'right' }]} numberOfLines={1}>
                  {i == null ? s.texte(s.inverse ? bas : haut) : s.texte(s.valeurs[i])}
                </Text>
              </View>
              {largeur > 0 && haut > bas ? (
                <Svg width={largeur} height={hSerie} pointerEvents="none">
                  {fond ? <Path d={fond} fill={p.trait} opacity={0.9} /> : null}
                  {bandesCoeur(s, v, largeur, hSerie)}
                  <Path d={lisse(points)} fill="none" stroke={s.couleur} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              ) : (
                <View style={{ height: hSerie }} />
              )}
            </View>
          );
        })}
        {largeur > 0 && sel ? (
          // La portion entourée par les deux doigts : un voile avec deux bords
          <Svg pointerEvents="none" width={largeur} height="100%" style={StyleSheet.absoluteFill}>
            <Rect x={xa} y={0} width={Math.max(0, xb - xa)} height="100%" fill={couleur} opacity={0.16} />
            <Rect x={xa - 1.5} y={0} width={3} height="100%" fill={p.texte} />
            <Rect x={xb - 1.5} y={0} width={3} height="100%" fill={p.texte} />
          </Svg>
        ) : x != null ? (
          // Un seul trait pointillé sur toutes les courbes
          <Svg pointerEvents="none" width={largeur} height="100%" style={StyleSheet.absoluteFill}>
            <Line x1={x} y1={0} x2={x} y2="100%" stroke={p.texteDoux} strokeWidth={1.5} strokeDasharray="3 4" />
          </Svg>
        ) : null}
      </View>
      <View style={[styles.axe, { height: HAUT_AXE }]}>
        {distance != null && distance > 0
          ? [0, 1, 2, 3, 4].map((k) => {
              const km0 = distance * (d0 + ((d1 - d0) * k) / 4);
              return (
                <Text key={k} style={[typo.petit, { color: p.texteMuet, fontSize: 11 }]}>
                  {k === 0 && !zoome ? '0 km' : formatKm(km0, distance >= 100 ? 0 : 1)}
                </Text>
              );
            })
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espace.e3 },
  bloc: { borderRadius: rayon.base, overflow: 'hidden' },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: espace.e3, gap: espace.e2 },
  valeur: { fontFamily: police.texte600, fontSize: 14, fontVariant: ['tabular-nums'] },
  axe: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: MARGE },
});
