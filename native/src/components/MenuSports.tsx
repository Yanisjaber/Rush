import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { basculerSport, GROUPES_SPORTS } from '@/data/sports/sports-choisis';
import { useSportsChoisis } from '@/hooks/useSportsChoisis';
import { rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le menu du « + » : comme sur le site, un panneau qui descend sous la barre des sports (touche ailleurs pour le fermer).
// Chaque touche enregistre tout de suite. On garde toujours au moins un sport.
export function MenuSports({ ouvert, onFermer, haut }: { ouvert: boolean; onFermer: () => void; haut: number }) {
  const p = usePalette();
  const { choisis, erreur, envoi, appliquer } = useSportsChoisis();
  const [dernier, setDernier] = useState(false);

  const sport = (cle: string) => {
    if (!choisis) return;
    const suite = basculerSport(choisis, cle);
    setDernier(suite === null);
    if (suite) void appliquer(suite);
  };

  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} accessibilityLabel="Fermer le menu des sports" accessibilityRole="button" />
      <View accessibilityViewIsModal style={[styles.panneau, { top: haut + 46, backgroundColor: p.surface, borderColor: p.traitFort }]}>
        <ScrollView contentContainerStyle={{ padding: 10 }} showsVerticalScrollIndicator={false}>
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
                    return (
                      <Pressable
                        key={cle}
                        disabled={envoi}
                        onPress={() => sport(cle)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: actif }}
                        accessibilityLabel={nom}
                        style={({ pressed }) => [styles.ligne, pressed && { backgroundColor: p.surface2 }]}
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
  panneau: { position: 'absolute', right: 8, width: 300, maxHeight: '70%', borderWidth: 1, borderRadius: rayon.bloc, overflow: 'hidden' },
  ligne: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: 12 },
  point: { width: 10, height: 10, borderRadius: 5 },
  case: { width: 22, height: 22, borderWidth: 1.5, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  coche: { fontFamily: police.titre800, fontSize: 14, lineHeight: 16 },
});
