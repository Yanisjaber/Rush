import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DefMesure } from '@/data/sante-catalogue';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une question de 1 à 5 (ou un choix de quelques valeurs) : une pastille par réponse, le libellé de la réponse écrit dessous.
// Retoucher la réponse choisie l'efface. Les libellés viennent du catalogue des mesures.
interface Props {
  def: DefMesure;
  valeur: number | undefined;
  onChange: (valeur: number | null) => void;
}

export function SelecteurEchelle({ def, valeur, onChange }: Props) {
  const p = usePalette();
  const valeurs = Array.from({ length: def.max - def.min + 1 }, (_, i) => def.min + i);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={def.nom}>
      <Text style={[typo.corpsFort, { color: p.texte }]}>{def.nom}</Text>
      {def.aide ? <Text style={[typo.petit, { color: p.texteDoux }]}>{def.aide}</Text> : null}
      <View style={styles.pastilles}>
        {valeurs.map((v) => {
          const actif = valeur === v;
          const nom = def.libelles?.[v - def.min] ?? String(v);
          return (
            <Pressable
              key={v}
              onPress={() => onChange(actif ? null : v)}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={`${def.nom} : ${nom}`}
              style={[styles.pastille, { borderColor: actif ? p.texte : p.contourChamp, backgroundColor: actif ? p.texte : 'transparent' }]}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit style={[def.type === 'echelle' ? styles.chiffre : styles.mot, { color: actif ? p.fond : p.texte }]}>
                {def.type === 'echelle' ? v : nom}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[typo.petit, { color: p.texteDoux, minHeight: 20 }]}>{valeur != null ? (def.libelles?.[valeur - def.min] ?? '') : ''}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pastilles: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4 },
  pastille: { flex: 1, minHeight: 44, borderWidth: 1.5, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  chiffre: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22 },
  mot: { fontFamily: police.texte600, fontSize: 12, lineHeight: 16 },
});
