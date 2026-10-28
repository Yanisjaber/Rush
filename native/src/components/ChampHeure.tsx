import { useState } from 'react';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { ChampTexte } from '@/components/ChampTexte';
import { RepliSiErreur } from '@/components/RepliSiErreur';
import { dateDepuisHeure, heureDepuisDate, heureValide } from '@/data/outils/heure';
import { espace, rayon, sombre } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une heure à choisir avec le sélecteur du système : les roues d'Apple sur iPhone (dans une feuille du bas), la fenêtre d'horloge d'Android sur Samsung.
// Tant que l'app n'a pas été reconstruite avec le module natif, le champ retombe sur une saisie « HH:MM ».
// Le sélecteur de secours : une saisie « HH:MM »
function SecoursHeure({ valeur, etiquette, onValider }: { valeur: string; etiquette: string; onValider: (heure: string) => void }) {
  const [texte, setTexte] = useState(valeur);
  return (
    <View style={{ gap: espace.e3 }}>
      <ChampTexte etiquette={`${etiquette} (HH:MM)`} sur="surface" value={texte} onChangeText={setTexte} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="18:00" />
      <Bouton onPress={() => heureValide(texte) && onValider(texte)}>Valider</Bouton>
    </View>
  );
}

// `affichage` : le texte montré dans le champ à la place de « HH:MM » (par exemple « 4 h 37 min » pour une durée choisie sur les mêmes roues).
export function ChampHeure({ valeur, onChange, etiquette = 'Heure', affichage }: { valeur: string; onChange: (heure: string) => void; etiquette?: string; affichage?: string }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState(dateDepuisHeure(valeur));

  function ouvrir() {
    if (Platform.OS === 'android') {
      try {
        DateTimePickerAndroid.open({
          value: dateDepuisHeure(valeur),
          mode: 'time',
          is24Hour: true,
          // Android : appelé quand on valide (et jamais quand on annule)
          onValueChange: (_e, d) => onChange(heureDepuisDate(d)),
        });
        return;
      } catch {
        // module natif absent : la feuille de secours ci-dessous prend le relais
      }
    }
    setChoix(dateDepuisHeure(valeur));
    setOuvert(true);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{etiquette}</Text>
      <Pressable onPress={ouvrir} accessibilityRole="button" accessibilityLabel={`${etiquette} : ${affichage ?? valeur}. Changer`} style={[styles.champ, { backgroundColor: p.surface }]}>
        <Text style={[typo.corpsFort, { color: p.texte, fontSize: 16 }]}>{affichage ?? valeur}</Text>
      </Pressable>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable accessibilityLabel="Fermer" accessibilityRole="button" onPress={() => setOuvert(false)} style={styles.fond} />
        <View accessibilityViewIsModal style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4 }]}>
          <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
          <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
            {etiquette}
          </Text>
          <RepliSiErreur repli={<SecoursHeure valeur={valeur} etiquette={etiquette} onValider={(h) => { onChange(h); setOuvert(false); }} />}>
            <DateTimePicker value={choix} mode="time" display="spinner" is24Hour locale="fr-FR" themeVariant={p.fond === sombre.fond ? 'dark' : 'light'} onValueChange={(_e, d) => setChoix(d)} />
            <View style={styles.boutons}>
              <Bouton variante="discret" onPress={() => setOuvert(false)}>
                Annuler
              </Bouton>
              <Bouton
                onPress={() => {
                  onChange(heureDepuisDate(choix));
                  setOuvert(false);
                }}
              >
                OK
              </Bouton>
            </View>
          </RepliSiErreur>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  champ: { height: 48, borderRadius: rayon.rond, paddingHorizontal: 18, justifyContent: 'center' },
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  boutons: { flexDirection: 'row', gap: espace.e2, justifyContent: 'flex-end' },
});
