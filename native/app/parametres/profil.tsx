import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Bouton } from '@/components/ui/Bouton';
import { FormulaireSection } from '@/components/feuilles/FormulaireSection';
import { PhotoProfil } from '@/components/feuilles/PhotoProfil';
import { DetailDomaine } from '@/components/profil/DetailDomaine';
import { ModeleAthleteRealiste, type PointEcran } from '@/components/profil/ModeleAthleteRealiste';
import { ANCRES_DOMAINES, ANCRES_REGLE, NOM_COURT, PlancheAnatomique } from '@/components/profil/PlancheAnatomique';
import { dateIsoLocale } from '@/data/outils/format';
import { ageDepuis } from '@/data/profil/ecran-profil';
import type { DomaineCle } from '@/data/profil/reperes';
import { useEvaluation } from '@/hooks/useEvaluation';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Page Profil : la « planche anatomique », sur un seul écran (pas de défilement). En haut, l'identité, le niveau global
// et le crayon (modifier l'identité) ; au centre, le mannequin 3D avec sa règle et 8 points numérotés (un par domaine) ;
// en bas, les 8 notes. Toucher un point ou une note ouvre le détail du domaine. Le calcul : data/profil/evaluation.ts.
const Mannequin = memo(ModeleAthleteRealiste);
const ANCRES = { ...ANCRES_DOMAINES, ...ANCRES_REGLE };

export default function Profil() {
  const p = usePalette();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: largeurEcran } = useWindowDimensions();
  const { evaluation, profil, enregistrer, recharger } = useEvaluation();
  const { mesures } = useMesuresSante();

  // Le geste « glisser depuis le bord » est coupé ici (il gêne la rotation du mannequin), sur la pile du dessus aussi ; on le remet en quittant
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ gestureEnabled: false });
      return () => parent?.setOptions({ gestureEnabled: true });
    }, [navigation]),
  );

  const extras = (profil?.extras ?? {}) as Record<string, unknown>;
  const prenom = typeof extras.first_name === 'string' ? extras.first_name.trim() : '';
  const tailleCm = Number(extras.height) || 0;
  const poids = Number(profil?.weight) || 0;
  const age = ageDepuis(extras.birth_date);
  const sousTitre = [tailleCm > 0 ? `${(tailleCm / 100).toFixed(2).replace('.', ',')} m` : null, poids > 0 ? `${String(Math.round(poids * 10) / 10).replace('.', ',')} kg` : null, age !== null ? `${age} ans` : null].filter(Boolean).join(' · ');

  const accent = p.sportVelo;
  const [active, setActive] = useState<DomaineCle | null>(null);
  const [points, setPoints] = useState<Record<string, PointEcran>>({});
  const [zone3D, setZone3D] = useState({ w: largeurEcran, h: 0 });
  const [edition, setEdition] = useState(false);
  const surMesure = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setZone3D((z) => (Math.abs(z.w - width) < 1 && Math.abs(z.h - height) < 1 ? z : { w: width, h: height }));
  }, []);

  const choisie = useMemo(() => evaluation.domaines.findIndex((d) => d.domaine.cle === active), [evaluation.domaines, active]);
  const aujourdhui = dateIsoLocale(new Date());
  const saisir = useCallback((metric: string, valeur: number | null) => void enregistrer(aujourdhui, metric, valeur), [enregistrer, aujourdhui]);

  return (
    <View style={[styles.ecran, { backgroundColor: p.fond, paddingTop: insets.top + 4, paddingBottom: insets.bottom + espace.e2 }]}>
      <View style={styles.entete}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          hitSlop={8}
          style={({ pressed }) => [styles.rond, { backgroundColor: p.surface2, opacity: pressed ? 0.7 : 1 }]}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d="M15 5l-7 7 7 7" stroke={p.texte} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.identite}>
          <Text numberOfLines={1} style={[typo.titre2, { color: p.texte }]}>{prenom || 'Athlète'}</Text>
          {sousTitre ? <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>{sousTitre}</Text> : null}
        </View>
        <View accessible accessibilityLabel={evaluation.niveau === null ? 'Niveau : pas encore de mesure' : `Niveau ${evaluation.niveau} sur 100`} style={styles.niveau}>
          <Text style={[styles.niveauChiffre, { color: evaluation.niveau === null ? p.texteMuet : p.texte }]}>{evaluation.niveau ?? '—'}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>/100</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Modifier mon identité"
          onPress={() => setEdition(true)}
          hitSlop={8}
          style={({ pressed }) => [styles.rond, { backgroundColor: p.surface2, opacity: pressed ? 0.7 : 1 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d="M4 20h4L19 9l-4-4L4 16v4z" stroke={p.texte} strokeWidth={2} strokeLinejoin="round" />
            <Path d="M13.5 6.5l4 4" stroke={p.texte} strokeWidth={2} />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.zone3D} onLayout={surMesure}>
        {zone3D.h > 0 ? (
          <>
            <Mannequin maillot palette={p} accent={accent} largeur="100%" hauteur={zone3D.h} selectedPart={undefined} ancres={ANCRES} onProjection={setPoints} />
            <PlancheAnatomique palette={p} accent={accent} largeur={zone3D.w} hauteur={zone3D.h} points={points} domaines={evaluation.domaines} active={active} onDomaine={setActive} tailleCm={tailleCm} />
          </>
        ) : null}
      </View>

      <View style={styles.notes}>
        {evaluation.domaines.map((d, i) => (
          <Pressable
            key={d.domaine.cle}
            onPress={() => setActive(d.domaine.cle)}
            accessibilityRole="button"
            accessibilityLabel={`${i + 1}. ${d.domaine.nom} : ${d.note === null ? 'pas encore de mesure' : `${d.note} sur 100`}`}
            style={({ pressed }) => [styles.case, { backgroundColor: p.surface, borderColor: p.trait, opacity: pressed ? 0.75 : 1 }]}
          >
            <View style={styles.caseHaut}>
              <View style={[styles.mini, { backgroundColor: accent }]}>
                <Text style={[styles.miniNumero, { color: p.encreSurCouleur }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.caseNote, { color: d.note === null ? p.texteMuet : p.texte }]}>{d.note ?? '—'}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.caseNom, { color: p.texteDoux }]}>
              {NOM_COURT[d.domaine.cle]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Le détail d'un domaine : chaque repère, sa note, et la saisie des tests */}
      <Modal visible={choisie >= 0} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActive(null)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: p.fond }} contentContainerStyle={{ padding: espace.e4, paddingBottom: 320, gap: espace.e3 }}>
          <View style={styles.titreFeuille}>
            <Bouton variante="discret" petit onPress={() => setActive(null)}>
              Fermer
            </Bouton>
          </View>
          {choisie >= 0 ? (
            <DetailDomaine palette={p} accent={accent} numero={choisie + 1} note={evaluation.domaines[choisie]} sexe={evaluation.sexe} mesures={mesures} aujourdhui={aujourdhui} onSaisie={saisir} />
          ) : null}
        </ScrollView>
      </Modal>

      <Modal visible={edition} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEdition(false)}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ backgroundColor: p.fond }} contentContainerStyle={{ padding: espace.e4, paddingBottom: 320, gap: espace.e4 }}>
          <View style={styles.titreEdition}>
            <Text style={[typo.titre3, { color: p.texte }]}>Modifier mon identité</Text>
            <Bouton variante="discret" petit onPress={() => { setEdition(false); void recharger(); }}>
              Terminé
            </Bouton>
          </View>
          <PhotoProfil />
          <FormulaireSection id="identite" />
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, paddingHorizontal: espace.e4 },
  rond: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  identite: { flex: 1, minWidth: 0 },
  niveau: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  niveauChiffre: { fontFamily: police.titre800, fontSize: 36, lineHeight: 40, fontVariant: ['tabular-nums'] },
  zone3D: { flex: 1 },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.e2, paddingHorizontal: espace.e4 },
  case: { width: '22.9%', minHeight: 56, borderWidth: 1, borderRadius: rayon.l, paddingVertical: 6, paddingHorizontal: espace.e2, justifyContent: 'center' },
  caseHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mini: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miniNumero: { fontFamily: police.titre700, fontSize: 12, lineHeight: 14 },
  caseNote: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  caseNom: { fontFamily: police.texte500, fontSize: 12, lineHeight: 16, marginTop: 2 },
  titreFeuille: { flexDirection: 'row', justifyContent: 'flex-end' },
  titreEdition: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
