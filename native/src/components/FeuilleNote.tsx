import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { ChampsNote } from '@/components/ChampsNote';
import { LogoNote } from '@/components/LogoNote';
import { ZoneClavier } from '@/components/ZoneClavier';
import { TYPES_NOTE, validerNote, type FormulaireNote } from '@/data/ajouts';
import { couleurNote } from '@/data/annotations';
import { periodeCourte } from '@/data/format';
import { lignesDetail, nettoyerDetails, titreNote } from '@/data/sante-notes';
import { useAjouts } from '@/hooks/useAjouts';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
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
  details: nettoyerDetails(n.type, n.details) ?? {},
});

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
    Alert.alert(note ? `Supprimer « ${titreNote(note)} » ?` : 'Supprimer cette note ?', 'Elle disparaît du calendrier.', [
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

  return (
    <Modal visible={!!note} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      {note && mode === 'vue' ? (
        <View style={styles.centre} pointerEvents="box-none">
          <View accessibilityViewIsModal style={[styles.popup, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
            <View style={styles.popupTete}>
              <View style={[styles.popupLogo, { backgroundColor: avecAlpha(couleurNote(note.color), 0.22) }]}>
                <LogoNote type={note.type} couleur={couleurNote(note.color)} taille={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
                  {titreNote(note)}
                </Text>
                <Text style={[typo.petit, { color: p.texteDoux }]}>{periodeCourte(note.from_date, note.to_date)}</Text>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 280, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
              {/* Une simple note : son texte ; sinon une ligne « étiquette : valeur » par détail */}
              {note.type === 'texte' || !note.type ? (
                <Text selectable style={[typo.corps, { color: p.texte }]}>
                  {note.text || 'Note'}
                </Text>
              ) : (
                lignesDetail(note).map((l) => (
                  <View key={l.etiquette} style={[styles.detail, { borderTopColor: p.trait }]}>
                    <Text style={[typo.petit, { color: p.texteMuet }]}>{l.etiquette}</Text>
                    <Text selectable style={[typo.corpsFort, { color: p.texte, flexShrink: 1, textAlign: 'right' }]}>
                      {l.valeur}
                    </Text>
                  </View>
                ))
              )}
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
          <ZoneClavier modale style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas }]}>
            <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
            <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
              Modifier la note
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: espace.e3, paddingBottom: espace.e2 }}>
              <ChampsNote f={f} change={change} sur="surface" />
            </ScrollView>
            {erreur ? (
              <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                {erreur}
              </Text>
            ) : null}
            <Bouton disabled={enCours} onPress={() => void enregistrer()}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</Bouton>
            <Bouton variante="discret" onPress={confirmerSuppression}>
              Supprimer cette note
            </Bouton>
          </ZoneClavier>
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
  popupLogo: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth },
  feuille: { maxHeight: '92%', borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
