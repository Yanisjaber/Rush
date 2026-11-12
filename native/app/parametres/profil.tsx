import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { FeuilleAthlete, type OuvertureFeuille } from '@/components/profil/FeuilleAthlete';
import { ModeleAthleteRealiste, type PointEcran, type ZoneAvatar } from '@/components/profil/ModeleAthleteRealiste';
import { PointsZones } from '@/components/profil/PointsZones';
import { FondDegrade } from '@/components/ui/FondDegrade';
import { POINTS_MODELE } from '@/data/avatar/ancrages';
import { zonesProfil, type OngletProfil, type ZoneProfil } from '@/data/profil/ecran-profil';
import { bilanAthlete } from '@/data/reglages/bilan-athlete';
import { useDonneesAccueil } from '@/hooks/useDonneesAccueil';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Page Profil : le mannequin 3D au centre (on le tourne, on le zoome, on touche une zone), des points reliés à leur note,
// et en bas une feuille à 4 onglets (Identité, Physio, Niveau, Forme) avec des cartes qu'on balaie.
const Mannequin = memo(ModeleAthleteRealiste);
const Feuille = memo(FeuilleAthlete);

/** Où se posent les points sur le mannequin de face (mètres), et à quelle hauteur on recentre la caméra pour chaque zone. */
const ANCRES: Record<ZoneProfil, { x: number; y: number }> = {
  tete: POINTS_MODELE.head,
  coeur: POINTS_MODELE.heart,
  torse: { x: -0.08, y: 1.1 },
  jambes: POINTS_MODELE.legs,
};
const FOCUS: Record<ZoneProfil, number> = { tete: 1.66, coeur: 1.3, torse: 1.18, jambes: 0.62 };
const PART_SURBRILLANCE: Partial<Record<ZoneProfil, ZoneAvatar>> = { torse: 'chest', jambes: 'legs', coeur: 'heart' };
const ZONE_DEPUIS_PART: Record<ZoneAvatar, ZoneProfil> = { heart: 'coeur', lungs: 'torse', chest: 'torse', arms: 'torse', legs: 'jambes', head: 'tete' };

export default function Profil() {
  const p = usePalette();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: hauteurEcran } = useWindowDimensions();
  const { donnees, recharger } = useDonneesAccueil();

  // Le geste « glisser depuis le bord » est coupé ici (il gêne la rotation du mannequin) : sur la pile de Profil
  // ET sur celle du dessus (le groupe Paramètres), sinon c'est elle qui ferme la page. On les remet en quittant.
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ gestureEnabled: false });
      return () => parent?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );

  const profil = donnees?.profil ?? null;
  const bilan = useMemo(
    () => bilanAthlete({ profil, seances: donnees?.seances, metriques: donnees?.metriques, seriesForce: donnees?.force.series }),
    [profil, donnees?.seances, donnees?.metriques, donnees?.force.series],
  );
  const zones = useMemo(() => zonesProfil(bilan, profil), [bilan, profil]);

  const [zoneActive, setZoneActive] = useState<ZoneProfil | null>(null);
  const [onglet, setOnglet] = useState<OngletProfil>('identite');
  const [vue, setVue] = useState<'face' | 'dos'>('face');
  const [points, setPoints] = useState<Record<string, PointEcran>>({});
  const [ouverture, setOuverture] = useState<OuvertureFeuille | null>(null);
  const [hauteurFeuille, setHauteurFeuille] = useState(0);
  const [zone3D, setZone3D] = useState({ w: 0, h: 0 });

  const surMesure = useCallback((e: LayoutChangeEvent) => setZone3D({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }), []);
  const hauteur3D = zone3D.h || hauteurEcran;

  const choisirZone = useCallback((cle: ZoneProfil) => {
    const info = zones.find((z) => z.cle === cle);
    if (!info) return;
    setZoneActive(cle);
    setOnglet(info.onglet);
    setOuverture((o) => ({ onglet: info.onglet, carte: info.carte, n: (o?.n ?? 0) + 1 }));
  }, [zones]);
  const surPart = useCallback((part: ZoneAvatar) => choisirZone(ZONE_DEPUIS_PART[part]), [choisirZone]);
  const changerOnglet = useCallback((o: OngletProfil) => { setOnglet(o); setZoneActive(null); }, []);
  const modifierPhysio = useCallback(() => router.push('/parametres/physiologie'), [router]);

  return (
    <View style={[styles.ecran, { backgroundColor: p.fond }]}>
      <FondDegrade />
      <View style={StyleSheet.absoluteFill} onLayout={surMesure}>
        <Mannequin
          maillot
          palette={p}
          accent={p.sportVelo}
          largeur="100%"
          hauteur={hauteur3D}
          selectedPart={zoneActive ? PART_SURBRILLANCE[zoneActive] : undefined}
          onPartSelect={surPart}
          focusY={zoneActive ? FOCUS[zoneActive] : null}
          decalageBas={hauteur3D > 0 ? Math.min(0.6, hauteurFeuille / hauteur3D) : 0}
          vue={vue}
          ancres={ANCRES}
          onProjection={setPoints}
        />
        <PointsZones palette={p} largeur={zone3D.w} hauteur={hauteur3D} zones={zones} points={points} active={zoneActive} onZone={choisirZone} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={8}
        style={({ pressed }) => [styles.retour, { top: insets.top + 8, backgroundColor: p.surface2, opacity: pressed ? 0.7 : 1 }]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d="M15 5l-7 7 7 7" stroke={p.texte} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <View style={[styles.vues, { top: insets.top + 8, backgroundColor: p.surface2 }]} accessibilityRole="tablist">
        {(['face', 'dos'] as const).map((v) => (
          <Pressable key={v} onPress={() => setVue(v)} accessibilityRole="tab" accessibilityState={{ selected: vue === v }} style={[styles.vue, vue === v && { backgroundColor: p.texte }]}>
            <Text style={[styles.vueTexte, { color: vue === v ? p.fond : p.texteDoux }]}>{v === 'face' ? 'Face' : 'Dos'}</Text>
          </Pressable>
        ))}
      </View>

      <Feuille
        bilan={bilan}
        profil={profil}
        onglet={onglet}
        onOnglet={changerOnglet}
        ouverture={ouverture}
        onHauteur={setHauteurFeuille}
        onModifierPhysio={modifierPhysio}
        onIdentiteEnregistree={() => void recharger()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  retour: { position: 'absolute', left: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  vues: { position: 'absolute', right: 16, height: 44, borderRadius: 22, flexDirection: 'row', padding: 4, gap: 2 },
  vue: { minWidth: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  vueTexte: { fontFamily: police.texte600, fontSize: 14 },
});
