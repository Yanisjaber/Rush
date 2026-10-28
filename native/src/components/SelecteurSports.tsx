import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { GROUPES_SPORTS } from '@/data/sports/sports-choisis';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les sports à cocher, rangés par thème : une pastille par sport, aplat de sa couleur quand il est coché.
interface Props {
  choisis: string[];
  onBasculer: (cle: string) => void;
  desactive?: boolean;
}

export function SelecteurSports({ choisis, onBasculer, desactive = false }: Props) {
  const p = usePalette();
  return (
    <View style={{ gap: espace.e4 }}>
      {GROUPES_SPORTS.map((g) => (
        <Bloc key={g.titre} titre={g.titre}>
          <View style={styles.puces}>
            {g.sports.map((cle) => {
              const actif = choisis.includes(cle);
              const couleur = couleurSport(p, cle);
              return (
                <Pressable
                  key={cle}
                  disabled={desactive}
                  onPress={() => onBasculer(cle)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: actif, disabled: desactive }}
                  accessibilityLabel={SPORTS[cle as CleSport]?.nom ?? cle}
                  style={[styles.puce, actif ? { backgroundColor: couleur, borderColor: couleur } : { borderColor: p.contourChamp }, desactive && { opacity: 0.6 }]}
                >
                  <Text style={[typo.corpsFort, { color: actif ? p.encreSurCouleur : p.texte }]}>{SPORTS[cle as CleSport]?.nom ?? cle}</Text>
                </Pressable>
              );
            })}
          </View>
        </Bloc>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.rond, paddingHorizontal: 16, justifyContent: 'center' },
});
