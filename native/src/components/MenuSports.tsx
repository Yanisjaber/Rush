import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DISCIPLINES } from '@/data/disciplines';
import { basculerSport, GROUPES_SPORTS } from '@/data/sports-choisis';
import { useSportsChoisis } from '@/hooks/useSportsChoisis';
import { rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le menu du « + » : comme sur le site, un panneau qui descend sous la barre des sports (touche ailleurs pour le fermer).
// Chaque touche enregistre tout de suite. Athlétisme n'a pas de case d'office : une flèche déroule ses disciplines ; la coche
// n'apparaît que si au moins une est cochée, et la toucher les décoche toutes. On garde toujours au moins un sport.
export function MenuSports({ ouvert, onFermer, haut }: { ouvert: boolean; onFermer: () => void; haut: number }) {
  const p = usePalette();
  const { choisis, disciplines, erreur, envoi, appliquer } = useSportsChoisis();
  const [depliees, setDepliees] = useState<Record<string, boolean>>({});
  const [dernier, setDernier] = useState(false);

  const sport = (cle: string) => {
    if (!choisis) return;
    const suite = basculerSport(choisis, cle);
    setDernier(suite === null);
    if (suite) void appliquer(suite);
  };
  const discipline = (cle: string, d: string) => {
    if (!choisis) return;
    const actuelles = disciplines[cle] ?? [];
    const apres = actuelles.includes(d) ? actuelles.filter((c) => c !== d) : [...actuelles, d];
    // Une discipline cochée coche le sport ; décocher la dernière le retire
    const sports = apres.length ? (choisis.includes(cle) ? choisis : [...choisis, cle]) : choisis.filter((s) => s !== cle);
    setDernier(sports.length === 0);
    if (sports.length) void appliquer(sports, { ...disciplines, [cle]: apres });
  };
  const retirerAvecDisciplines = (cle: string) => {
    if (!choisis) return;
    const sports = choisis.filter((s) => s !== cle);
    setDernier(sports.length === 0);
    if (sports.length) void appliquer(sports, { ...disciplines, [cle]: [] });
  };

  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} accessibilityLabel="Fermer le menu des sports" accessibilityRole="button" />
      <View accessibilityViewIsModal style={[styles.panneau, { top: haut + 46, backgroundColor: p.surface, borderColor: p.traitFort }]}>
        <ScrollView contentContainerStyle={{ padding: 8 }} showsVerticalScrollIndicator={false}>
          {dernier ? (
            <Text accessibilityRole="alert" style={[typo.petit, { color: p.alerte, paddingHorizontal: 8, paddingBottom: 6 }]}>
              Garde au moins un sport.
            </Text>
          ) : null}
          {erreur ? (
            <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, paddingHorizontal: 8, paddingBottom: 6 }]}>
              {erreur}
            </Text>
          ) : null}
          {!choisis ? <Text style={[typo.petit, { color: p.texteDoux, padding: 8 }]}>Chargement…</Text> : null}
          {choisis
            ? GROUPES_SPORTS.map((g) => (
                <View key={g.titre} style={{ marginBottom: 4 }}>
                  <Text style={[typo.micro, { color: p.texteMuet, paddingHorizontal: 8, paddingTop: 8 }]}>{g.titre}</Text>
                  {g.sports.map((cle) => {
                    const nom = SPORTS[cle as CleSport]?.nom ?? cle;
                    const couleur = couleurSport(p, cle);
                    const actif = choisis.includes(cle);
                    if (Object.hasOwn(DISCIPLINES, cle)) {
                      const ouverte = !!depliees[cle];
                      return (
                        <View key={cle}>
                          <View style={styles.rang}>
                            <Pressable
                              style={styles.ligne}
                              onPress={() => setDepliees((d) => ({ ...d, [cle]: !d[cle] }))}
                              accessibilityRole="button"
                              accessibilityState={{ expanded: ouverte }}
                              accessibilityLabel={`${nom}, ${ouverte ? 'replier' : 'dérouler'} les disciplines`}
                            >
                              <View style={[styles.point, { backgroundColor: couleur }]} />
                              <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>{nom}</Text>
                            </Pressable>
                            {actif ? (
                              <Pressable
                                disabled={envoi}
                                onPress={() => retirerAvecDisciplines(cle)}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: true }}
                                accessibilityLabel={`Retirer ${nom} : décoche toutes ses disciplines`}
                                style={styles.zoneCase}
                              >
                                <Case coche couleur={couleur} />
                              </Pressable>
                            ) : null}
                            <Pressable
                              onPress={() => setDepliees((d) => ({ ...d, [cle]: !d[cle] }))}
                              accessibilityRole="button"
                              accessibilityLabel={ouverte ? 'Replier les disciplines' : 'Dérouler les disciplines'}
                              style={styles.zoneCase}
                            >
                              <View style={[styles.chevron, { borderColor: p.texteDoux, transform: [{ rotate: ouverte ? '-45deg' : '135deg' }] }]} />
                            </Pressable>
                          </View>
                          {ouverte
                            ? DISCIPLINES[cle].map((famille) => (
                                <View key={famille.titre}>
                                  <Text style={[typo.micro, { color: p.texteMuet, paddingLeft: 28, paddingTop: 8 }]}>{famille.titre}</Text>
                                  {famille.disciplines.map((d) => {
                                    const on = (disciplines[cle] ?? []).includes(d.cle);
                                    return (
                                      <Pressable
                                        key={d.cle}
                                        disabled={envoi}
                                        onPress={() => discipline(cle, d.cle)}
                                        accessibilityRole="checkbox"
                                        accessibilityState={{ checked: on }}
                                        style={[styles.ligne, { paddingLeft: 28 }]}
                                      >
                                        <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{d.nom}</Text>
                                        <Case coche={on} couleur={couleur} />
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ))
                            : null}
                        </View>
                      );
                    }
                    return (
                      <Pressable
                        key={cle}
                        disabled={envoi}
                        onPress={() => sport(cle)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: actif }}
                        accessibilityLabel={nom}
                        style={styles.ligne}
                      >
                        <View style={[styles.point, { backgroundColor: couleur }]} />
                        <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>{nom}</Text>
                        <Case coche={actif} couleur={couleur} />
                      </Pressable>
                    );
                  })}
                </View>
              ))
            : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Case({ coche, couleur }: { coche: boolean; couleur: string }) {
  const p = usePalette();
  return (
    <View style={[styles.case, coche ? { backgroundColor: couleur, borderColor: couleur } : { borderColor: p.contourChamp }]}>
      {coche ? <Text style={[styles.coche, { color: p.encreSurCouleur }]}>✓</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panneau: { position: 'absolute', right: 8, width: 300, maxHeight: '70%', borderWidth: 1, borderRadius: rayon.base, overflow: 'hidden' },
  rang: { flexDirection: 'row', alignItems: 'center' },
  ligne: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 8 },
  zoneCase: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  point: { width: 10, height: 10, borderRadius: 5 },
  case: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  coche: { fontFamily: police.titre800, fontSize: 14, lineHeight: 16 },
  chevron: { width: 9, height: 9, borderTopWidth: 2, borderRightWidth: 2 },
});
