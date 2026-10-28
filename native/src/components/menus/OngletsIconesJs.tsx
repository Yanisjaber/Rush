import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { avecAlpha, clair } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import type { IconeOnglet, OngletIcone, PropsOngletsIcones } from './OngletsIcones.types';

// Des onglets en icônes, qui se comportent comme la barre du bas d'iOS 26 : une seule pastille (une lentille de verre sur iOS 26 et plus) glisse
// d'un onglet à l'autre avec un petit rebond, et on peut la faire glisser au doigt sur la rangée pour changer d'onglet.
// Seul l'onglet choisi montre son nom. Chaque onglet fait au moins 44 × 44 pt. VoiceOver lit toujours le nom.
// Une valeur animée `t` (le numéro de l'onglet, qui passe de 0 à 1 puis 2) règle en même temps la pastille, la largeur du nom et la couleur de l'icône.
// Ailleurs que sur iOS 26 (iOS plus ancien, Android), la rangée n'a pas de verre et la pastille est pleine.
// C'est la version de repli (Android, ou iOS dont l'app n'a pas le module natif) : sur iOS, OngletsIcones.ios.tsx utilise à sa place le vrai sélecteur natif d'iOS.
const VERRE = isLiquidGlassAvailable();
const LARGEUR_NOM_PAR_DEFAUT = 56; // avant la mesure du vrai nom
const BASE = 44; // un onglet fermé : 12 de marge + 20 d'icône + 12 de marge
const ECART = 4; // entre deux onglets
const MARGE_VERRE = 4; // marge de la capsule de verre autour des onglets
const DEPART_NOM = 8; // espace entre l'icône et le nom

export type { IconeOnglet } from './OngletsIcones.types';

function Icone({ nom, couleur }: { nom: IconeOnglet; couleur: string }) {
  const commun = { stroke: couleur, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      {nom === 'resume' ? (
        <>
          <Rect x={3} y={3} width={6} height={6} rx={1.5} {...commun} />
          <Rect x={11} y={3} width={6} height={6} rx={1.5} {...commun} />
          <Rect x={3} y={11} width={6} height={6} rx={1.5} {...commun} />
          <Rect x={11} y={11} width={6} height={6} rx={1.5} {...commun} />
        </>
      ) : nom === 'rythme' ? (
        <Path d="M2 11h3l2-6 3 10 2-7 1.5 3H18" {...commun} />
      ) : nom === 'progres' ? (
        <>
          <Path d="M2.5 14.5l4.5-4.5 3 3 7-7.5" {...commun} />
          <Path d="M12.5 5.5h4.5V10" {...commun} />
        </>
      ) : (
        <>
          <Path d="M6 3h8v5a4 4 0 0 1-8 0z" {...commun} />
          <Path d="M6 5H3v1.5A3 3 0 0 0 6 9.5M14 5h3v1.5A3 3 0 0 1 14 9.5M10 12v3M7 17h6" {...commun} />
        </>
      )}
    </Svg>
  );
}

/** Un onglet : son poids vaut 1 quand il est choisi, 0 sinon, et passe de l'un à l'autre en suivant `t`. */
function UnOnglet({ nom, icone, rang, t, onPress, actif, largeurNom, surMesure }: { nom: string; icone: IconeOnglet; rang: number; t: SharedValue<number>; onPress: () => void; actif: boolean; largeurNom: number; surMesure: (rang: number, largeur: number) => void }) {
  const p = usePalette();
  const couleurActive = VERRE ? p.texte : p.fond;
  const etiquette = useAnimatedStyle(() => {
    const poids = Math.min(1, Math.max(0, 1 - Math.abs(t.value - rang)));
    return { width: largeurNom * poids, opacity: poids, marginLeft: DEPART_NOM * poids };
  });
  const iconeActive = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, 1 - Math.abs(t.value - rang))) }));

  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: actif }} accessibilityLabel={nom} style={styles.onglet}>
      <View style={styles.icone}>
        <Icone nom={icone} couleur={p.texteMuet} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, iconeActive]}>
          <Icone nom={icone} couleur={couleurActive} />
        </Animated.View>
      </View>
      <Animated.View pointerEvents="none" style={[styles.etiquette, etiquette]}>
        <Text numberOfLines={1} style={[styles.nom, { color: couleurActive, width: largeurNom }]}>
          {nom}
        </Text>
      </Animated.View>
      {/* Copie invisible du nom, pour connaître sa vraie largeur */}
      <Text pointerEvents="none" onLayout={(e) => surMesure(rang, Math.ceil(e.nativeEvent.layout.width) + 1)} style={[styles.nom, styles.mesure]}>
        {nom}
      </Text>
    </Pressable>
  );
}

export function OngletsIconesJs<T extends string>({ onglets, actuel, onChoisir, etiquette }: PropsOngletsIcones<T>) {
  const p = usePalette();
  const reduit = useReducedMotion();
  const rangActuel = Math.max(0, onglets.findIndex((o) => o.cle === actuel));
  const t = useSharedValue(rangActuel);
  const [largeursNoms, setLargeursNoms] = useState<number[]>(() => onglets.map(() => LARGEUR_NOM_PAR_DEFAUT));
  const marge = VERRE ? MARGE_VERRE : 0;

  useEffect(() => {
    t.value = reduit ? rangActuel : withSpring(rangActuel, { damping: 15, stiffness: 190, mass: 0.9 });
  }, [rangActuel, reduit, t]);

  const surMesure = (rang: number, largeur: number) => setLargeursNoms((anciennes) => (anciennes[rang] === largeur ? anciennes : anciennes.map((l, i) => (i === rang ? largeur : l))));

  // La pastille : entre l'onglet `i0` et le suivant, elle glisse et change de largeur (le rebond du ressort peut la faire dépasser un peu)
  const etendues = largeursNoms.map((l) => DEPART_NOM + l); // ce qu'un onglet ajoute à sa largeur quand il est choisi
  const n = onglets.length;
  const pastille = useAnimatedStyle(() => {
    if (n < 2) return { left: marge, width: BASE + (etendues[0] ?? 0) };
    const i0 = Math.min(n - 2, Math.max(0, Math.floor(t.value)));
    const f = Math.min(1.25, Math.max(-0.25, t.value - i0));
    const largeurI0 = BASE + etendues[i0] * Math.min(1, Math.max(0, 1 - f));
    return { left: marge + i0 * (BASE + ECART) + f * (largeurI0 + ECART), width: (1 - f) * (BASE + etendues[i0]) + f * (BASE + etendues[i0 + 1]) };
  });

  // Glisser le doigt sur la rangée : l'onglet sous le doigt devient le choisi
  const rangeeRef = useRef<ComponentRef<typeof View>>(null);
  const departX = useRef(0);
  const positions = useRef<{ x: number; largeur: number }[]>([]);
  const choisirSousLeDoigt = useRef<(x: number) => void>(() => {});
  choisirSousLeDoigt.current = (x) => {
    const relatif = x - departX.current - marge;
    let trouve = 0;
    let ecartMin = Infinity;
    positions.current.forEach((pos, i) => {
      const centre = pos.x + pos.largeur / 2;
      if (Math.abs(relatif - centre) < ecartMin) {
        ecartMin = Math.abs(relatif - centre);
        trouve = i;
      }
    });
    const cle = onglets[trouve]?.cle;
    if (cle != null && cle !== actuel) onChoisir(cle);
  };
  const geste = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => rangeeRef.current?.measureInWindow((x) => (departX.current = x)),
        onPanResponderMove: (_, g) => choisirSousLeDoigt.current(g.moveX),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );

  // Le verre suit le thème choisi dans l'app, pas celui du téléphone
  const Cadre = VERRE ? GlassView : View;
  const proprietesVerre = VERRE ? { glassEffectStyle: 'regular' as const, isInteractive: true, colorScheme: p.fond === clair.fond ? ('light' as const) : ('dark' as const) } : {};
  return (
    <Cadre {...proprietesVerre} accessibilityRole="tablist" accessibilityLabel={etiquette} style={[styles.rangee, VERRE && styles.verre]}>
      <View ref={rangeeRef} collapsable={false} style={styles.rangeeInterne} {...geste.panHandlers}>
        {/* La pastille, derrière les icônes */}
        <Animated.View pointerEvents="none" style={[styles.pastille, { top: 0, backgroundColor: VERRE ? 'transparent' : p.texte }, pastille]}>
          {VERRE ? <GlassView glassEffectStyle="regular" tintColor={avecAlpha(p.texte, 0.14)} isInteractive colorScheme={p.fond === clair.fond ? 'light' : 'dark'} style={StyleSheet.absoluteFill} /> : null}
        </Animated.View>
        {onglets.map((o, i) => (
          <View
            key={o.cle}
            onLayout={(e) => (positions.current[i] = { x: e.nativeEvent.layout.x, largeur: e.nativeEvent.layout.width })}
          >
            <UnOnglet nom={o.nom} icone={o.icone} rang={i} t={t} actif={o.cle === actuel} largeurNom={largeursNoms[i] ?? LARGEUR_NOM_PAR_DEFAUT} surMesure={surMesure} onPress={() => onChoisir(o.cle)} />
          </View>
        ))}
      </View>
    </Cadre>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row' },
  verre: { borderRadius: 999, padding: MARGE_VERRE },
  rangeeInterne: { flexDirection: 'row', gap: ECART },
  pastille: { position: 'absolute', height: BASE, borderRadius: 999, overflow: 'hidden' },
  onglet: { minHeight: BASE, minWidth: BASE, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  icone: { width: 20, height: 20 },
  etiquette: { overflow: 'hidden', justifyContent: 'center' },
  nom: { fontFamily: police.texte600, fontSize: 14, lineHeight: 18 },
  mesure: { position: 'absolute', opacity: 0 },
});
