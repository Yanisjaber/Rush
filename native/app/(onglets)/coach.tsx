import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, type NativeScrollEvent, type NativeSyntheticEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HEURE_LARGEUR, MessageVue } from '@/components/coach/MessageVue';
import { SaisieCoach } from '@/components/coach/SaisieCoach';
import { BoutonReglages } from '@/components/ui/BoutonReglages';
import { FondDegrade } from '@/components/ui/FondDegrade';
import { ROUTE_ECRAN, type ActionApp } from '@/data/coach/actions';
import { afficherRepere, repereHeure } from '@/data/coach/libelles';
import { useCoach } from '@/hooks/useCoach';
import { useAuth } from '@/stores/auth';
import { useAccesCoach } from '@/stores/coach';
import { demanderJour } from '@/stores/jour-demande';
import { imposerFiltre } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const BARRE_ONGLETS = 24;

/** Le clavier est-il ouvert ? Quand il l'est, la barre d'onglets est cachée dessous : plus besoin de lui laisser de la place. */
function useClavierOuvert(): boolean {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const a = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setOuvert(true));
    const b = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOuvert(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return ouvert;
}

// Le Coach : une seule conversation (fil classique). Tu écris, le coach répond au fil de l'eau. Quand il propose une séance,
// elle arrive sous forme de carte : rien n'est ajouté au calendrier tant que tu n'as pas tapé sur « Ajouter ».
// Tout passe par la fonction serveur « coach-chat » (voir docs/ia/CADRAGE_IA.md) ; l'écran n'écrit jamais lui-même en base.
export default function Coach() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const acces = useAccesCoach();
  const router = useRouter();
  // Les actions sans danger que le coach fait exécuter (liste blanche : data/coach/actions.ts). Aucune ne change une donnée.
  const executer = (a: ActionApp) => {
    if (a.type === 'ecran') router.navigate(ROUTE_ECRAN[a.ecran]);
    else if (a.type === 'jour') {
      demanderJour(a.date);
      router.navigate('/calendrier');
    } else imposerFiltre(a.sport);
  };
  const c = useCoach(acces ? session?.user.id ?? null : null, executer);
  const clavier = useClavierOuvert();
  // Une liste NORMALE ancrée en bas (le plus récent en bas). Elle reste collée au bas tant que l'utilisateur n'a pas remonté ni déplié une carte :
// un message qui arrive ou s'écrit reste visible, et une carte qu'on déplie s'ouvre vers le bas (son haut ne bouge pas), sans aucun décalage à rattraper.
  const liste = useRef<FlatList<(typeof c.messages)[number]>>(null);
  const colleAuBas = useRef(true);
  /** Vrai pendant que l'utilisateur fait glisser la liste : lui seul peut la « décoller » du bas (un défilement automatique en cours ne compte pas) */
  const glisse = useRef(false);
  const mesurerBas = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    colleAuBas.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 80;
  };
  /** Les hauteurs réelles (contenu et zone visible) : `scrollToEnd` se fie à une estimation, fausse tant que les cartes ne sont pas toutes mesurées */
  const tailles = useRef({ contenu: 0, vue: 0 });
  const descendre = () => {
    if (!colleAuBas.current) return;
    const { contenu, vue } = tailles.current;
    liste.current?.scrollToOffset({ offset: Math.max(0, contenu - vue), animated: false });
  };
  // Glisser le fil vers la gauche montre l'heure de chaque message à droite (comme Messages) ; on lâche, il revient
  const decalage = useSharedValue(0);
  const glissement = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-12, 10000],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      decalage.value = Math.max(-(HEURE_LARGEUR + espace.e4), Math.min(0, e.translationX));
    },
    onFinalize: () => {
      decalage.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
    },
  });
  const vide = !c.chargement && !c.erreur && c.messages.length === 0;

  function confirmerEffacement() {
    Alert.alert('Effacer la conversation ?', 'Tes messages et ce que le coach a retenu de vos échanges sont supprimés. Les séances déjà ajoutées à ton calendrier restent.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: () => void c.effacer() },
    ]);
  }

  return (
    <View style={styles.page}>
      <FondDegrade />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
        <View style={[styles.entete, { paddingTop: insets.top + espace.e2 }]}>
          {/* Mode développement : un appui long sur le titre pose une carte de plan d'exemple (sans serveur) pour voir l'écran */}
          <Pressable onLongPress={c.insererExemple} disabled={!c.insererExemple} accessible={false}>
            <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
              Coach
            </Text>
          </Pressable>
          <View style={styles.droite}>
            {c.messages.length > 0 && !c.envoi ? (
              <Pressable onPress={confirmerEffacement} accessibilityRole="button" accessibilityLabel="Effacer la conversation" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.effacer}>
                <Text style={[typo.petit, { color: p.texteDoux }]}>Effacer</Text>
              </Pressable>
            ) : null}
            {/* Comme Santé : pas de barre des sports, la roue des Paramètres est ici, en haut à droite */}
            <BoutonReglages />
          </View>
        </View>

        {!acces ? (
          <Etat titre="Le coach n'est pas encore ouvert" texte="Ton compte n'y a pas encore accès. Il arrive bientôt." />
        ) : c.chargement && c.messages.length === 0 ? (
          <View accessible accessibilityLabel="Chargement de la conversation" style={styles.centre}>
            <ActivityIndicator color={p.texteDoux} />
          </View>
        ) : c.erreur ? (
          <View style={styles.centre}>
            <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
              <Text style={[typo.petit, { color: p.texte }]}>{c.erreur}</Text>
            </View>
            <Pressable onPress={() => void c.recharger()} accessibilityRole="button" style={[styles.recharger, { borderColor: p.contourChamp }]}>
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Recharger</Text>
            </Pressable>
          </View>
        ) : vide ? (
          <Etat titre="Ton coach" texte="Pose une question sur ton entraînement, ta récupération ou ta semaine. Pour une séance, demande-la : elle apparaîtra ici sous forme de carte, et c'est toi qui l'ajoutes à ton calendrier." />
        ) : (
          <GestureDetector gesture={glissement}>
          <FlatList
            ref={liste}
            data={c.messages}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            // iOS natif : si de la hauteur change au-dessus de ce que tu regardes (carte dépliée plus haut), le contenu visible ne bouge pas
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            contentContainerStyle={styles.liste}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              glisse.current = true;
            }}
            onScroll={(e) => {
              if (glisse.current) mesurerBas(e);
            }}
            onScrollEndDrag={(e) => {
              mesurerBas(e);
              glisse.current = false;
            }}
            onMomentumScrollEnd={mesurerBas}
            onContentSizeChange={(_, hauteur) => {
              tailles.current.contenu = hauteur;
              descendre();
            }}
            onLayout={(e) => {
              tailles.current.vue = e.nativeEvent.layout.height;
              descendre();
            }}
            renderItem={({ item, index }) => {
              const repere = afficherRepere(c.messages[index - 1]?.date, item.date) ? repereHeure(item.date ?? '') : null;
              return (
              <View>
                {repere ? (
                  <Text accessibilityLabel={`${repere.jour} à ${repere.heure}`} style={[typo.micro, styles.repere, { color: p.texteMuet }]}>
                    <Text style={{ fontFamily: police.texte600 }}>{repere.jour}</Text> {repere.heure}
                  </Text>
                ) : null}
                <MessageVue
                  message={item}
                  colle={index < c.messages.length - 1 && c.messages[index + 1].role === item.role && item.cartes.length === 0}
                  occupees={c.occupees}
                  erreursCarte={c.erreursCarte}
                  peutReessayer={!c.sansReessai && !c.envoi}
                  onReessayer={(texte) => void c.envoyer(texte)}
                  onAjouter={(carte) => void c.ajouter(carte)}
                  peutAnnuler={index === c.messages.length - 1}
                  onAnnuler={(carte) => void c.annuler(carte)}
                  onRefaire={() => void c.envoyer('Refais le plan : mon calendrier a changé.')}
                  decalage={decalage}
                  onVoirCalendrier={() => router.navigate('/calendrier')}
                  onBascule={() => {
                    // L'utilisateur déplie ou replie : on ne tire plus la liste vers le bas, le haut de la carte reste en place
                    colleAuBas.current = false;
                  }}
                />
              </View>
              );
            }}
          />
          </GestureDetector>
        )}

        {acces ? <SaisieCoach envoi={c.envoi} basse={clavier ? espace.e2 : insets.bottom + BARRE_ONGLETS} onEnvoyer={(t) => {
            colleAuBas.current = true;
            void c.envoyer(t);
          }} /> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function Etat({ titre, texte }: { titre: string; texte: string }) {
  const p = usePalette();
  return (
    <View style={styles.centre}>
      <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte, textAlign: 'center' }]}>
        {titre}
      </Text>
      <Text style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espace.e4, paddingBottom: espace.e2 },
  droite: { flexDirection: 'row', alignItems: 'center', gap: espace.e1, marginRight: -espace.e3 },
  effacer: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  repere: { textAlign: 'center', textTransform: 'none', letterSpacing: 0, marginTop: espace.e2, marginBottom: espace.e2 },
  liste: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: espace.e4, paddingVertical: espace.e3 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace.e3, paddingHorizontal: espace.e5 },
  avis: { borderLeftWidth: 3, borderRadius: rayon.base, padding: espace.e3, alignSelf: 'stretch' },
  recharger: { minHeight: 44, paddingHorizontal: espace.e4, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
