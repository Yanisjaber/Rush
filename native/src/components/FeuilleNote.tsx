import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { ChoixCouleur, PastillesChoix } from '@/components/ChampsFeuille';
import { ChampDate } from '@/components/ChampDate';
import { PALETTE_NOTE, TEXTE_MAX_NOTE, TYPES_NOTE, validerNote, type FormulaireNote } from '@/data/ajouts';
import { couleurNote, libelleNote } from '@/data/annotations';
import { periodeCourte } from '@/data/format';
import { useAjouts } from '@/hooks/useAjouts';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import type { Note } from '@/data/types';

// Ce qui s'ouvre en touchant une note du détail d'un jour. D'abord une petite fenêtre qui AFFICHE la note, avec « Modifier » et « Supprimer » (après confirmation) ;
// « Modifier » passe, dans la même fenêtre, à la feuille d'édition : type, texte, dates, couleur.
const versFormulaire = (n: Note): FormulaireNote => ({
  type: TYPES_NOTE.some((t) => t.cle === n.type) ? (n.type as FormulaireNote['type']) : 'texte',
  texte: n.text ?? '',
  couleur: couleurNote(n.color),
  de: String(n.from_date).slice(0, 10),
  a: String(n.to_date).slice(0, 10),
});

const NOM_TYPE: Record<string, string> = { texte: 'Note', maladie: 'Maladie', blessure: 'Blessure' };

export function FeuilleNote({ note, onFermer }: { note: Note | null; onFermer: () => void }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { modifierNote, supprimerNote } = useAjouts();
  const [mode, setMode] = useState<'vue' | 'edition'>('vue');
  const [f, setF] = useState<FormulaireNote | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  // À chaque ouverture, on commence par l'affichage, et le formulaire se remplit avec la note touchée
  useEffect(() => {
    setMode('vue');
    setF(note ? versFormulaire(note) : null);
    setErreur('');
    setEnCours(false);
  }, [note]);

  const change = (suite: FormulaireNote) => {
    setF(suite);
    setErreur('');
  };

  async function enregistrer() {
    if (!note || !f) return;
    const r = validerNote(f);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = await modifierNote(note.id, r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    onFermer();
  }

  function confirmerSuppression() {
    if (!note) return;
    Alert.alert('Supprimer cette note ?', 'Elle disparaît du calendrier.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setEnCours(true);
          const e = await supprimerNote(note.id);
          setEnCours(false);
          if (e) return setErreur(e);
          onFermer();
        },
      },
    ]);
  }

  const champ = [typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }];

  return (
    <Modal visible={!!note} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      {note && mode === 'vue' ? (
        <View style={styles.centre} pointerEvents="box-none">
          <View accessibilityViewIsModal style={[styles.popup, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
            <View style={styles.popupTete}>
              <View style={[styles.popupBarre, { backgroundColor: couleurNote(note.color) }]} />
              <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                {NOM_TYPE[note.type] ?? 'Note'}
              </Text>
            </View>
            <Text style={[typo.petit, { color: p.texteDoux }]}>{periodeCourte(note.from_date, note.to_date)}</Text>
            <ScrollView style={{ maxHeight: 220, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
              <Text selectable style={[typo.corps, { color: p.texte }]}>
                {libelleNote(note)}
              </Text>
            </ScrollView>
            {erreur ? (
              <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                {erreur}
              </Text>
            ) : null}
            {/* Deux petits boutons côte à côte, à droite : la fenêtre reste légère */}
            <View style={styles.popupBoutons}>
              <Bouton petit variante="discret" onPress={confirmerSuppression}>
                {enCours ? 'Suppression…' : 'Supprimer'}
              </Bouton>
              <Bouton petit onPress={() => setMode('edition')}>
                Modifier
              </Bouton>
            </View>
          </View>
        </View>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.conteneur} pointerEvents="box-none">
        {f && mode === 'edition' ? (
          <View accessibilityViewIsModal style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4 }]}>
            <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
            <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
              Modifier la note
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: espace.e3, paddingBottom: espace.e2 }}>
              <PastillesChoix
                valeurs={TYPES_NOTE.map((t) => ({ cle: t.cle, nom: t.nom }))}
                actuel={f.type}
                onChoisir={(v) => change({ ...f, type: v })}
                etiquette="Type de note"
              />
              <Text style={[typo.micro, { color: p.texteDoux }]}>{f.type === 'texte' ? 'Ta note' : 'Précision (facultatif)'}</Text>
              <TextInput
                value={f.texte}
                onChangeText={(t) => change({ ...f, texte: t })}
                maxLength={TEXTE_MAX_NOTE}
                multiline
                placeholder="Un mot sur ta journée…"
                placeholderTextColor={p.texteMuet}
                accessibilityLabel="Texte de la note"
                style={[...champ, { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }]}
              />
              <ChampDate etiquette="Du" date={f.de} onChange={(iso) => change({ ...f, de: iso, a: f.a < iso ? iso : f.a })} />
              <ChampDate etiquette="Au" date={f.a} onChange={(iso) => change({ ...f, a: iso, de: iso < f.de ? iso : f.de })} />
              <Text style={[typo.micro, { color: p.texteDoux }]}>Couleur</Text>
              <ChoixCouleur couleurs={PALETTE_NOTE.map((hex) => ({ hex, nom: hex }))} actuelle={f.couleur} onChoisir={(hex) => change({ ...f, couleur: hex })} />
            </ScrollView>
            {erreur ? (
              <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                {erreur}
              </Text>
            ) : null}
            <Bouton onPress={() => void enregistrer()}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
            <Bouton variante="discret" onPress={confirmerSuppression}>
              Supprimer cette note
            </Bouton>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  conteneur: { flex: 1, justifyContent: 'flex-end' },
  centre: { ...StyleSheet.absoluteFill, justifyContent: 'center', paddingHorizontal: espace.e4 },
  popup: { borderWidth: 1, borderRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  popupBoutons: { flexDirection: 'row', justifyContent: 'flex-end', gap: espace.e2 },
  popupTete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  popupBarre: { width: 6, height: 26, borderRadius: 3 },
  feuille: { maxHeight: '92%', borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
});
