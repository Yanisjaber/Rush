import { useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarteTrace } from '@/components/graphes/CarteTrace';
import { ProfilCurseur } from '@/components/graphes/ProfilCurseur';
import type { PointCarte, RegionCarte } from '@/data/calendrier/apercu-import';
import { pointAuFraction, regionPourZone } from '@/data/outils/trace';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'écran d'un parcours (maquette « Profil sur la carte ») : la carte en plein fond avec la trace entière visible, le retour et le titre flottants en haut,
// et une feuille en bas avec le profil d'altitude (on y glisse le doigt : un point suit sur la carte) et les chiffres clés.
interface Props {
  trace: PointCarte[];
  region: RegionCarte;
  profil: number[];
  altitudeMin: number;
  altitudeMax: number;
  km: number | null;
  couleur: string;
  /** Le titre flottant en haut, à côté du bouton retour. S'il est trop long pour la pastille, un appui l'affiche en entier dans une fenêtre. */
  titre: string;
  /** Sous le profil : les chiffres clés. */
  chiffres?: ReactNode;
  /** Le crayon en haut à droite : ouvre le formulaire de modification. */
  onModifier?: () => void;
}

const HAUT_ENTETE = 64; // la hauteur du retour et du titre flottants, sous la zone de sécurité

export function VueParcours({ trace, region, profil, altitudeMin, altitudeMax, km, couleur, titre, chiffres, onModifier }: Props) {
  const p = usePalette();
  const router = useRouter();
  const { top: haut, bottom: bas } = useSafeAreaInsets();
  const [dims, setDims] = useState({ page: 0, feuille: 0 });
  const [fraction, setFraction] = useState<number | null>(null);
  const [titreCoupe, setTitreCoupe] = useState(false); // le titre dépasse-t-il la pastille ? (mesuré par un texte invisible, sans limite de lignes)
  const [titreOuvert, setTitreOuvert] = useState(false);
  const curseur = useMemo(() => (fraction == null ? null : pointAuFraction(trace, fraction)), [trace, fraction]);
  // La trace doit rester entière dans la zone libre (sous l'en-tête, au-dessus de la feuille) : on décale la carte en conséquence
  const regionAffichee = useMemo(() => regionPourZone(region, { hauteur: dims.page, haut: haut + HAUT_ENTETE, bas: dims.feuille }), [region, dims, haut]);
  const verre = avecAlpha(p.fond, 0.88);

  return (
    <View style={styles.page} onLayout={(e: LayoutChangeEvent) => setDims((d) => ({ ...d, page: e.nativeEvent.layout.height }))}>
      <CarteTrace plein trace={trace} region={regionAffichee} couleur={couleur} curseur={curseur} />

      <View pointerEvents="box-none" style={[styles.entete, { top: haut + espace.e2 }]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={({ pressed }) => [styles.rondRetour, { backgroundColor: verre, borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d="M15 5l-7 7 7 7" stroke={p.texte} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.zoneTitre}>
          <Pressable
            disabled={!titreCoupe}
            onPress={() => setTitreOuvert(true)}
            accessibilityRole={titreCoupe ? 'button' : 'header'}
            accessibilityLabel={titre}
            accessibilityHint={titreCoupe ? 'Affiche le titre en entier' : undefined}
            style={[styles.pastilleTitre, { backgroundColor: verre }]}
          >
            <Text numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>
              {titre}
            </Text>
            <Text
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onTextLayout={(e) => setTitreCoupe(e.nativeEvent.lines.length > 1)}
              style={[typo.titre3, styles.mesure]}
            >
              {titre}
            </Text>
          </Pressable>
        </View>
        {onModifier ? (
          <Pressable
            onPress={onModifier}
            accessibilityRole="button"
            accessibilityLabel="Modifier"
            style={({ pressed }) => [styles.rondRetour, { backgroundColor: verre, borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke={p.texte} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        ) : null}
      </View>

      <View
        onLayout={(e: LayoutChangeEvent) => setDims((d) => ({ ...d, feuille: e.nativeEvent.layout.height }))}
        style={[styles.feuille, { backgroundColor: p.fond, borderColor: p.trait, paddingBottom: bas + espace.e4 }]}
      >
        <ProfilCurseur profil={profil} min={altitudeMin} max={altitudeMax} km={km} couleur={couleur} hauteur={110} onChange={setFraction} />
        {chiffres}
      </View>

      <Modal transparent animationType="fade" visible={titreOuvert} onRequestClose={() => setTitreOuvert(false)}>
        <Pressable onPress={() => setTitreOuvert(false)} accessibilityRole="button" accessibilityLabel="Fermer" style={styles.voile}>
          <View style={[styles.carteTitre, { backgroundColor: p.surface, borderColor: p.trait }]}>
            <Text accessibilityRole="header" selectable style={[typo.titre2, { color: p.texte }]}>
              {titre}
            </Text>
            <Text style={[typo.petit, { color: p.texteMuet }]}>Touche pour fermer</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  entete: { position: 'absolute', left: espace.e4, right: espace.e4, flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  rondRetour: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  zoneTitre: { flex: 1, alignItems: 'flex-start' },
  // Le texte de mesure : invisible, posé sur le vrai titre, sans limite de lignes (s'il passe sur 2 lignes, le titre est coupé)
  mesure: { position: 'absolute', left: espace.e3, right: espace.e3, top: 6, opacity: 0 },
  voile: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5, backgroundColor: 'rgba(0,0,0,0.55)' },
  carteTitre: { width: '100%', borderRadius: rayon.bloc, borderWidth: 1, padding: espace.e5, gap: espace.e3 },
  pastilleTitre: { flexShrink: 1, borderRadius: rayon.base, paddingHorizontal: espace.e3, paddingVertical: 6 },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, borderTopWidth: 1, padding: espace.e4, gap: espace.e3 },
});
