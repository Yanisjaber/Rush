import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { decalerMois, grilleMois, JOURS_SEMAINE } from '@/data/calendrier';
import { dateIsoLocale } from '@/data/format';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une date à choisir, en une ligne arrondie : « ‹ lun. 26 oct. 2026 › ». Les flèches changent d'un jour ; toucher la date ouvre un petit calendrier pour choisir le jour.
// `max` : le dernier jour permis (par exemple aujourd'hui pour une sortie déjà faite) ; les jours après sont grisés et la flèche suivante s'arrête.
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const decaler = (iso: string, jours: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return dateIsoLocale(d);
};

export function ChampDate({ date, onChange, etiquette, max }: { date: string; onChange: (iso: string) => void; etiquette?: string; max?: string }) {
  const p = usePalette();
  const [ouvert, setOuvert] = useState(false);
  const [vue, setVue] = useState({ annee: Number(date.slice(0, 4)), mois: Number(date.slice(5, 7)) - 1 });
  const texte = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const suivantPossible = !max || decaler(date, 1) <= max;
  const nomChamp = etiquette ?? 'Date';

  const ouvrir = () => {
    setVue({ annee: Number(date.slice(0, 4)), mois: Number(date.slice(5, 7)) - 1 });
    setOuvert(true);
  };
  const semaines = grilleMois(vue.annee, vue.mois, {}, new Date()).semaines;

  return (
    <View style={{ gap: 6 }}>
      {etiquette ? <Text style={[typo.micro, { color: p.texteDoux }]}>{etiquette}</Text> : null}
      <View style={[styles.ligne, { backgroundColor: p.surface }]}>
        <Pressable onPress={() => onChange(decaler(date, -1))} accessibilityRole="button" accessibilityLabel={`${nomChamp} : la veille`} style={styles.fleche}>
          <Text style={{ color: p.texteDoux, fontSize: 26, lineHeight: 30 }}>‹</Text>
        </Pressable>
        <Pressable onPress={ouvrir} accessibilityRole="button" accessibilityLabel={`${nomChamp} : ${texte}. Choisir un autre jour`} style={styles.date}>
          <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
            {texte}
          </Text>
        </Pressable>
        <Pressable
          disabled={!suivantPossible}
          onPress={() => onChange(decaler(date, 1))}
          accessibilityRole="button"
          accessibilityLabel={`${nomChamp} : le lendemain`}
          style={[styles.fleche, !suivantPossible && { opacity: 0.3 }]}
        >
          <Text style={{ color: p.texteDoux, fontSize: 26, lineHeight: 30 }}>›</Text>
        </Pressable>
      </View>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOuvert(false)} accessibilityLabel="Fermer le calendrier" accessibilityRole="button" />
        <View style={styles.centre} pointerEvents="box-none">
          <View accessibilityViewIsModal style={[styles.carte, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
            <View style={styles.entete}>
              <Pressable onPress={() => setVue((v) => decalerMois(v.annee, v.mois, -1))} accessibilityRole="button" accessibilityLabel="Mois précédent" style={styles.fleche}>
                <Text style={{ color: p.texte, fontSize: 26, lineHeight: 30 }}>‹</Text>
              </Pressable>
              <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[typo.corpsFort, { color: p.texte }]}>{`${MOIS[vue.mois][0].toUpperCase()}${MOIS[vue.mois].slice(1)} ${vue.annee}`}</Text>
              <Pressable onPress={() => setVue((v) => decalerMois(v.annee, v.mois, 1))} accessibilityRole="button" accessibilityLabel="Mois suivant" style={styles.fleche}>
                <Text style={{ color: p.texte, fontSize: 26, lineHeight: 30 }}>›</Text>
              </Pressable>
            </View>
            <View style={styles.rangee} accessible={false} importantForAccessibility="no-hide-descendants">
              {JOURS_SEMAINE.map((n, i) => (
                <Text key={i} style={[typo.micro, styles.lettre, { color: p.texteMuet }]}>
                  {n.charAt(0)}
                </Text>
              ))}
            </View>
            {semaines.map((semaine) => (
              <View key={semaine[0].iso} style={styles.rangee}>
                {semaine.map((j) => {
                  const choisi = j.iso === date;
                  const interdit = !!max && j.iso > max;
                  return (
                    <Pressable
                      key={j.iso}
                      disabled={interdit}
                      onPress={() => {
                        onChange(j.iso);
                        setOuvert(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: choisi, disabled: interdit }}
                      accessibilityLabel={new Date(`${j.iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      style={styles.casePeriode}
                    >
                      <View style={[styles.jour, choisi && { backgroundColor: p.texte }]}>
                        <Text style={[typo.corpsFort, { color: choisi ? p.fond : interdit ? p.texteMuet : j.dansMois ? p.texte : p.texteMuet, opacity: interdit ? 0.4 : 1 }]}>{j.num}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderRadius: rayon.rond, paddingHorizontal: 4 },
  fleche: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  date: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  centre: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', paddingHorizontal: espace.e4 },
  carte: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: rayon.bloc, padding: espace.e3 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  rangee: { flexDirection: 'row' },
  lettre: { width: `${100 / 7}%`, textAlign: 'center', paddingBottom: 4 },
  casePeriode: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  jour: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
