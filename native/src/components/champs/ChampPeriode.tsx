import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/ui/Bouton';
import { CalendrierPeriode } from '@/components/calendrier/CalendrierPeriode';
import { joursDuCycle } from '@/data/calendrier/cycles';
import { periodeCourte } from '@/data/outils/format';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La période d'une note, en une ligne : « du ven. 23 oct. au lun. 26 oct. » et sa durée. On la touche et une feuille s'ouvre avec le calendrier :
// un toucher pose le début, le suivant pose la fin. « Valider » enregistre le choix, fermer la feuille l'annule.
export function ChampPeriode({ de, a, couleur, onChange, sur = 'fond' }: { de: string; a: string; couleur: string; onChange: (de: string, a: string) => void; sur?: 'fond' | 'surface' }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState({ de, a });
  const jours = joursDuCycle({ from_date: de, to_date: a });
  const nbChoix = joursDuCycle({ from_date: choix.de, to_date: choix.a });
  const texte = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;

  const ouvrir = () => {
    setChoix({ de, a });
    setOuvert(true);
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>Période</Text>
      <Pressable
        onPress={ouvrir}
        accessibilityRole="button"
        accessibilityLabel={`Période : ${periodeCourte(de, a)}, ${texte(jours)}. Changer`}
        style={[styles.champ, { backgroundColor: sur === 'surface' ? p.surface2 : p.surface }]}
      >
        <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
          {periodeCourte(de, a)}
        </Text>
        <View style={[styles.duree, { backgroundColor: avecAlpha(couleur, 0.25) }]}>
          <Text style={[typo.petit, { color: p.texte, fontFamily: police.titre700 }]}>{texte(jours)}</Text>
        </View>
        <Text style={{ color: p.texteDoux, fontSize: 18 }}>⌄</Text>
      </Pressable>
      <Modal visible={ouvert} transparent animationType="slide" onRequestClose={() => setOuvert(false)}>
        <Pressable style={styles.voile} onPress={() => setOuvert(false)} accessibilityRole="button" accessibilityLabel="Fermer sans changer" />
        <View accessibilityViewIsModal style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4 }]}>
          <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
          <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
            Choisis la période
          </Text>
          <CalendrierPeriode debut={choix.de} fin={choix.a} couleur={couleur} onChange={(d, f) => setChoix({ de: d, a: f })} />
          <Text style={[typo.petit, { color: p.texteDoux, textAlign: 'center' }]}>
            {periodeCourte(choix.de, choix.a)} · {texte(nbChoix)}
          </Text>
          <Bouton
            onPress={() => {
              onChange(choix.de, choix.a);
              setOuvert(false);
            }}
          >
            Valider
          </Bouton>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  champ: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: rayon.rond, paddingLeft: 18, paddingRight: 14 },
  duree: { borderRadius: rayon.rond, paddingHorizontal: 10, paddingVertical: 4 },
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  feuille: { borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
