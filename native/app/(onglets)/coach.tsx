import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageVue } from '@/components/coach/MessageVue';
import { SaisieCoach } from '@/components/coach/SaisieCoach';
import { BarreSports } from '@/components/graphes/BarreSports';
import { FondDegrade } from '@/components/ui/FondDegrade';
import { ROUTE_ECRAN, type ActionApp } from '@/data/coach/actions';
import { useCoach } from '@/hooks/useCoach';
import { useAuth } from '@/stores/auth';
import { useAccesCoach } from '@/stores/coach';
import { demanderJour } from '@/stores/jour-demande';
import { imposerFiltre } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const BARRE_ONGLETS = 72;

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
  // La liste est « inversée » (le plus récent en bas, le clavier ne la cache pas) : on lui donne les messages du plus récent au plus ancien
  const donnees = useMemo(() => [...c.messages].reverse(), [c.messages]);
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
      <BarreSports />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
        <View style={styles.entete}>
          {/* Mode développement : un appui long sur le titre pose une carte de plan d'exemple (sans serveur) pour voir l'écran */}
          <Pressable onLongPress={c.insererExemple} disabled={!c.insererExemple} accessible={false}>
            <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
              Lía
            </Text>
          </Pressable>
          {c.messages.length > 0 && !c.envoi ? (
            <Pressable onPress={confirmerEffacement} accessibilityRole="button" accessibilityLabel="Effacer la conversation" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.effacer}>
              <Text style={[typo.petit, { color: p.texteDoux }]}>Effacer</Text>
            </Pressable>
          ) : null}
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
          <FlatList
            inverted
            data={donnees}
            keyExtractor={(m) => m.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.liste}
            renderItem={({ item, index }) => (
              <MessageVue
                message={item}
                colle={index > 0 && donnees[index - 1].role === item.role && item.cartes.length === 0}
                occupees={c.occupees}
                erreursCarte={c.erreursCarte}
                peutReessayer={!c.sansReessai && !c.envoi}
                onReessayer={(texte) => void c.envoyer(texte)}
                onAjouter={(carte) => void c.ajouter(carte)}
                onAnnuler={(carte) => void c.annuler(carte)}
                onRefaire={() => void c.envoyer('Refais le plan : mon calendrier a changé.')}
                onVoirCalendrier={() => router.navigate('/calendrier')}
              />
            )}
          />
        )}

        {acces ? <SaisieCoach envoi={c.envoi} basse={clavier ? espace.e2 : insets.bottom + BARRE_ONGLETS} onEnvoyer={(t) => void c.envoyer(t)} /> : null}
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
  entete: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: espace.e4, paddingTop: espace.e2, paddingBottom: espace.e2, minHeight: 44 },
  effacer: { position: 'absolute', right: espace.e4, top: 0, bottom: 0, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  liste: { paddingHorizontal: espace.e4, paddingVertical: espace.e3 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: espace.e3, paddingHorizontal: espace.e5 },
  avis: { borderLeftWidth: 3, borderRadius: rayon.base, padding: espace.e3, alignSelf: 'stretch' },
  recharger: { minHeight: 44, paddingHorizontal: espace.e4, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
