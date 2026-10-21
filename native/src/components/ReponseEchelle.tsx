import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DefMesure } from '@/data/sante-catalogue';
import { avecAlpha, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une question de 1 à 5 en cinq pastilles de couleur, du moins bon (rouge) au meilleur (vert) : on répond d'un coup d'œil, sans lire.
// Seul le mot de la réponse choisie s'écrit, à droite du nom. Retoucher la réponse choisie l'efface.
// La phrase d'aide du catalogue n'est plus affichée : elle reste lue par VoiceOver.
interface Props {
  def: DefMesure;
  valeur: number | undefined;
  onChange: (valeur: number | null) => void;
}

export function ReponseEchelle({ def, valeur, onChange }: Props) {
  const p = usePalette();
  const valeurs = Array.from({ length: def.max - def.min + 1 }, (_, i) => def.min + i);
  // 0 = le moins bon, 1 = le meilleur, selon le sens de la question (la fatigue forte est mauvaise, l'humeur forte est bonne)
  const qualite = (v: number) => (def.sens === 'haut_mieux' ? (v - def.min) / (def.max - def.min) : (def.max - v) / (def.max - def.min));
  const couleurDe = (v: number) => (qualite(v) < 0.34 ? p.danger : qualite(v) < 0.67 ? p.alerte : p.ok);
  const mot = valeur != null ? (def.libelles?.[valeur - def.min] ?? '') : '';
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={def.nom} accessibilityHint={def.aide}>
      <View style={styles.entete}>
        <Text style={[typo.corpsFort, { color: p.texte }]}>{def.nom}</Text>
        <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux, flexShrink: 1 }]}>
          {mot}
        </Text>
      </View>
      <View style={styles.pastilles}>
        {valeurs.map((v) => {
          const actif = valeur === v;
          const c = couleurDe(v);
          return (
            <Pressable
              key={v}
              onPress={() => onChange(actif ? null : v)}
              accessibilityRole="radio"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={`${def.nom} : ${def.libelles?.[v - def.min] ?? v}`}
              style={[styles.pastille, { backgroundColor: actif ? c : avecAlpha(c, 0.22), borderColor: actif ? p.texte : 'transparent' }]}
            >
              {actif ? <Text style={[styles.chiffre, { color: p.fond }]}>{v}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  pastilles: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pastille: { flex: 1, minHeight: 44, borderWidth: 2, borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center' },
  chiffre: { fontFamily: police.titre800, fontSize: 18, lineHeight: 22 },
});
