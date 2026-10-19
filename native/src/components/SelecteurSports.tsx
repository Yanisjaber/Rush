import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { DISCIPLINES, type DisciplinesChoisies } from '@/data/disciplines';
import { GROUPES_SPORTS } from '@/data/sports-choisis';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les sports à cocher, rangés par thème : une pastille par sport, aplat de sa couleur quand il est coché.
interface Props {
  choisis: string[];
  onBasculer: (cle: string) => void;
  /** Disciplines cochées par sport (athlétisme) et leur bascule : sans elles, pas de rubrique de disciplines. */
  disciplines?: DisciplinesChoisies;
  onBasculerDiscipline?: (sport: string, cle: string) => void;
  desactive?: boolean;
}

export function SelecteurSports({ choisis, onBasculer, disciplines = {}, onBasculerDiscipline, desactive = false }: Props) {
  const p = usePalette();
  return (
    <View style={{ gap: espace.e4 }}>
      {GROUPES_SPORTS.map((g) => (
        <View key={g.titre} style={{ gap: espace.e4 }}>
        <Bloc titre={g.titre}>
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
        {/* Les disciplines d'un sport coché se déplient juste sous son groupe */}
        {onBasculerDiscipline
          ? g.sports
              .filter((sport) => Object.hasOwn(DISCIPLINES, sport) && choisis.includes(sport))
              .map((sport) => {
                const couleur = couleurSport(p, sport);
                return (
                  <Bloc key={sport} titre={`Tes disciplines : ${(SPORTS[sport as CleSport]?.nom ?? sport).toLowerCase()}`}>
                    {DISCIPLINES[sport].map((groupe) => (
                      <View key={groupe.titre} style={{ marginTop: espace.e2 }}>
                        <Text style={[typo.micro, { color: p.texteDoux, marginBottom: 6 }]}>{groupe.titre}</Text>
                        <View style={styles.puces}>
                          {groupe.disciplines.map((d) => {
                            const actif = (disciplines[sport] ?? []).includes(d.cle);
                            return (
                              <Pressable
                                key={d.cle}
                                disabled={desactive}
                                onPress={() => onBasculerDiscipline(sport, d.cle)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: actif, disabled: desactive }}
                                accessibilityLabel={d.nom}
                                style={[styles.puce, actif ? { backgroundColor: couleur, borderColor: couleur } : { borderColor: p.contourChamp }, desactive && { opacity: 0.6 }]}
                              >
                                <Text style={[typo.petit, { color: actif ? p.encreSurCouleur : p.texte }]}>{d.nom}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </Bloc>
                );
              })
          : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14, justifyContent: 'center' },
});
