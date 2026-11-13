import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
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

// Page Profil : la « planche anatomique ». En haut, l'identité et le niveau global ; au centre, le mannequin 3D avec une règle
// de hauteur et 8 points numérotés (un par domaine) reliés à leur note ; en dessous, la légende des 8 domaines, puis le détail
// du domaine choisi (chaque repère, d'où vient sa valeur, sa note, et la saisie des tests). Le calcul : data/profil/evaluation.ts.
const Mannequin = memo(ModeleAthleteRealiste);
const ANCRES = { ...ANCRES_DOMAINES, ...ANCRES_REGLE };

export default function Profil() {
  const p = usePalette();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: hauteurEcran } = useWindowDimensions();
  const { evaluation, profil, chargement, erreur, enregistrer, recharger } = useEvaluation();
  const { mesures } = useMesuresSante();
  const defilement = useRef<ScrollViewInstance>(null);
  const [yDetail, setYDetail] = useState(0);

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
  const [largeur, setLargeur] = useState(0);
  const [edition, setEdition] = useState(false);
  const [actualisation, setActualisation] = useState(false);
  const hauteur3D = Math.round(Math.min(580, Math.max(420, hauteurEcran * 0.62)));
  const surMesure = useCallback((e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width), []);

  const choisir = useCallback(
    (cle: DomaineCle) => {
      setActive((a) => (a === cle ? null : cle));
      // On descend jusqu'au détail (il s'affiche sous la légende)
      requestAnimationFrame(() => defilement.current?.scrollTo({ y: Math.max(0, yDetail - 80), animated: true }));
    },
    [yDetail],
  );
  const choisie = useMemo(() => evaluation.domaines.findIndex((d) => d.domaine.cle === active), [evaluation.domaines, active]);
  const aujourdhui = dateIsoLocale(new Date());
  const saisir = useCallback((metric: string, valeur: number | null) => void enregistrer(aujourdhui, metric, valeur), [enregistrer, aujourdhui]);
  const actualiser = useCallback(async () => {
    setActualisation(true);
    try {
      await recharger();
    } finally {
      setActualisation(false);
    }
  }, [recharger]);

  return (
    <View style={[styles.ecran, { backgroundColor: p.fond }]}>
      <ScrollView
        ref={defilement}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + espace.e6 }}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void actualiser()} tintColor={p.texteDoux} />}
      >
        <View style={styles.barre}>
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
          <Bouton variante="discret" petit onPress={() => setEdition(true)} accessibilityLabel="Modifier mon identité">
            Modifier
          </Bouton>
        </View>

        <View style={styles.entete}>
          <Text style={[typo.micro, { color: p.texteDoux }]}>Fiche athlète</Text>
          <Text style={[typo.titre2, { color: p.texte }]}>{prenom || 'Athlète'}</Text>
          {sousTitre ? <Text style={[typo.corps, { color: p.texteDoux }]}>{sousTitre}</Text> : null}
        </View>

        <View accessible accessibilityLabel={evaluation.niveau === null ? 'Niveau global : pas encore de mesure' : `Niveau global ${evaluation.niveau} sur 100, ${evaluation.mesures} repères mesurés sur ${evaluation.total}`} style={[styles.niveau, { borderColor: p.trait }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typo.micro, { color: p.texteDoux }]}>Niveau global</Text>
            <Text style={[typo.petit, { color: p.texteDoux }]}>
              {chargement ? 'Calcul en cours…' : `${evaluation.mesures} repères mesurés sur ${evaluation.total}`}
              {!evaluation.sexeConnu ? ' · sexe non renseigné : comparé aux hommes' : ''}
            </Text>
          </View>
          <Text style={[styles.niveauChiffre, { color: evaluation.niveau === null ? p.texteMuet : p.texte }]}>{evaluation.niveau ?? '—'}</Text>
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>/100</Text>
        </View>
        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}

        <View style={{ height: hauteur3D }} onLayout={surMesure}>
          <Mannequin maillot defilable palette={p} accent={accent} largeur="100%" hauteur={hauteur3D} selectedPart={undefined} ancres={ANCRES} onProjection={setPoints} />
          <PlancheAnatomique palette={p} accent={accent} largeur={largeur} hauteur={hauteur3D} points={points} domaines={evaluation.domaines} active={active} onDomaine={choisir} tailleCm={tailleCm} />
        </View>
        <View style={[styles.sol, { backgroundColor: p.traitFort }]} />

        <View style={styles.legende}>
          {evaluation.domaines.map((d, i) => {
            const choisi = d.domaine.cle === active;
            return (
              <Pressable
                key={d.domaine.cle}
                onPress={() => choisir(d.domaine.cle)}
                accessibilityRole="button"
                accessibilityState={{ selected: choisi }}
                accessibilityLabel={`${i + 1}. ${d.domaine.nom} : ${d.note === null ? 'pas encore de mesure' : `${d.note} sur 100`}`}
                style={({ pressed }) => [styles.case, { backgroundColor: p.surface, borderColor: choisi ? accent : p.trait, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux }]}>
                  {i + 1} · {NOM_COURT[d.domaine.cle]}
                </Text>
                <View style={styles.caseBas}>
                  <Text style={[styles.caseNote, { color: d.note === null ? p.texteMuet : p.texte }]}>{d.note ?? '—'}</Text>
                  <Text style={[typo.petit, { color: p.texteMuet }]}>
                    {d.mesures}/{d.reperes.filter((r) => !r.def.aVenir).length}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View onLayout={(e) => setYDetail(e.nativeEvent.layout.y)} style={styles.detail}>
          {choisie >= 0 ? (
            <DetailDomaine palette={p} accent={accent} numero={choisie + 1} note={evaluation.domaines[choisie]} sexe={evaluation.sexe} mesures={mesures} aujourdhui={aujourdhui} onSaisie={saisir} />
          ) : (
            <Text style={[typo.petit, { color: p.texteDoux }]}>Touche un point ou une case pour voir le détail d’un domaine et saisir tes tests.</Text>
          )}
          <Bouton variante="discret" onPress={() => router.push('/parametres/physiologie')}>
            Mes repères physiologiques (FC, FTP, VMA…)
          </Bouton>
        </View>
      </ScrollView>

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
  barre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: espace.e4 },
  rond: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  entete: { paddingHorizontal: espace.e4, marginTop: espace.e3 },
  niveau: { flexDirection: 'row', alignItems: 'baseline', gap: espace.e2, marginHorizontal: espace.e4, marginTop: espace.e3, paddingVertical: espace.e3, borderTopWidth: 1, borderBottomWidth: 1 },
  niveauChiffre: { fontFamily: police.titre800, fontSize: 44, lineHeight: 48, fontVariant: ['tabular-nums'] },
  avis: { marginHorizontal: espace.e4, marginTop: espace.e3, padding: espace.e3, borderLeftWidth: 3, borderRadius: rayon.base },
  sol: { height: 1, marginHorizontal: espace.e6 },
  legende: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.e2, paddingHorizontal: espace.e4, marginTop: espace.e4 },
  case: { width: '48.5%', minHeight: 56, borderWidth: 1, borderRadius: rayon.l, paddingVertical: 10, paddingHorizontal: espace.e3 },
  caseBas: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 2 },
  caseNote: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  detail: { paddingHorizontal: espace.e4, marginTop: espace.e4, gap: espace.e4 },
  titreEdition: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
