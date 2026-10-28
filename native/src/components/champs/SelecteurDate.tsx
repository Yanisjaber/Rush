import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dateIsoLocale } from '@/data/outils/format';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une date à choisir, passée ou future : la date écrite en entier au milieu, une flèche pour reculer ou avancer d'un jour, et « −7 » / « +7 » pour sauter d'une semaine.
// (SelecteurJour, lui, sert à saisir un jour passé : il n'avance jamais après aujourd'hui.)
const decaler = (iso: string, jours: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return dateIsoLocale(d);
};

export function SelecteurDate({ etiquette, date, onChange }: { etiquette: string; date: string; onChange: (iso: string) => void }) {
  const p = usePalette();
  // « jeu. 22 oct. 2026 » : assez court pour tenir sur une ligne entre les boutons
  const texte = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const bouton = (libelle: string, jours: number, accessibilite: string, large = false) => (
    <Pressable
      onPress={() => onChange(decaler(date, jours))}
      accessibilityRole="button"
      accessibilityLabel={`${etiquette} : ${accessibilite}`}
      style={({ pressed }) => [styles.bouton, large && styles.large, { backgroundColor: p.surface2, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[typo.corpsFort, { color: p.texte }]}>{libelle}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>{etiquette}</Text>
      <View style={styles.ligne}>
        {bouton('−7', -7, 'une semaine plus tôt', true)}
        {bouton('‹', -1, 'la veille')}
        <View accessible accessibilityLabel={`${etiquette} : ${texte}`} style={{ flex: 1, alignItems: 'center' }}>
          <Text numberOfLines={2} style={[typo.corpsFort, { color: p.texte, textAlign: 'center' }]}>
            {texte}
          </Text>
        </View>
        {bouton('›', 1, 'le lendemain')}
        {bouton('+7', 7, 'une semaine plus tard', true)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  bouton: { minWidth: 44, minHeight: 44, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  large: { minWidth: 48 },
});
