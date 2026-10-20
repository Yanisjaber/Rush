import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateIsoLocale } from '@/data/format';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le jour qu'on saisit : « Aujourd'hui », « Hier » ou la date, avec une flèche pour reculer et une pour avancer (jamais après aujourd'hui).
// On peut corriger les jours passés.
const decaler = (iso: string, jours: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return dateIsoLocale(d);
};

export function SelecteurJour({ date, onChange }: { date: string; onChange: (iso: string) => void }) {
  const p = usePalette();
  const aujourdhui = dateIsoLocale(new Date());
  const libelle = date === aujourdhui ? "Aujourd'hui" : date === decaler(aujourdhui, -1) ? 'Hier' : new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const peutAvancer = date < aujourdhui;
  return (
    <View style={styles.ligne}>
      <Fleche sens={-1} libelle="Jour précédent" onPress={() => onChange(decaler(date, -1))} />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte, textTransform: 'capitalize' }]}>
          {libelle}
        </Text>
      </View>
      <Fleche sens={1} libelle="Jour suivant" desactive={!peutAvancer} onPress={() => onChange(decaler(date, 1))} />
    </View>
  );
}

function Fleche({ sens, libelle, onPress, desactive = false }: { sens: -1 | 1; libelle: string; onPress: () => void; desactive?: boolean }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} disabled={desactive} accessibilityRole="button" accessibilityLabel={libelle} accessibilityState={{ disabled: desactive }} style={[styles.fleche, { backgroundColor: p.surface, opacity: desactive ? 0.3 : 1 }]}>
      <View style={[styles.chevron, { borderColor: p.texte, transform: [{ rotate: sens === -1 ? '-135deg' : '45deg' }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e3 },
  fleche: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chevron: { width: 10, height: 10, borderTopWidth: 2, borderRightWidth: 2, marginLeft: 0 },
});
