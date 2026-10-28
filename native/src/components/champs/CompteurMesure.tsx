import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un petit compteur (− 2 +) pour un nombre entier de verres : on ne tape rien. À zéro, la mesure est effacée.
interface Props {
  nom: string;
  unite: string;
  aide?: string;
  valeur: number;
  max: number;
  onChange: (valeur: number) => void;
}

export function CompteurMesure({ nom, unite, aide, valeur, max, onChange }: Props) {
  const p = usePalette();
  return (
    <View style={styles.ligne}>
      <View style={{ flex: 1 }}>
        <Text style={[typo.corpsFort, { color: p.texte }]}>{nom}</Text>
        {aide ? <Text style={[typo.petit, { color: p.texteDoux }]}>{aide}</Text> : null}
      </View>
      <Bouton signe="−" libelle={`Un ${unite.replace(/s$/, '')} de moins`} desactive={valeur <= 0} onPress={() => onChange(valeur - 1)} />
      <Text accessibilityLabel={`${valeur} ${unite}`} style={[styles.valeur, { color: p.texte }]}>
        {valeur}
      </Text>
      <Bouton signe="+" libelle={`Un ${unite.replace(/s$/, '')} de plus`} desactive={valeur >= max} onPress={() => onChange(valeur + 1)} />
    </View>
  );
}

function Bouton({ signe, libelle, onPress, desactive }: { signe: string; libelle: string; onPress: () => void; desactive: boolean }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} disabled={desactive} accessibilityRole="button" accessibilityLabel={libelle} accessibilityState={{ disabled: desactive }} style={[styles.bouton, { borderColor: p.contourChamp, opacity: desactive ? 0.35 : 1 }]}>
      <Text style={[styles.signe, { color: p.texte }]}>{signe}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 6 },
  bouton: { width: 44, height: 44, borderWidth: 1.5, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  signe: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26 },
  valeur: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
