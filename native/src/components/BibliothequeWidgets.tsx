import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { rangerBibliotheque } from '@/data/bibliotheque';
import { WIDGETS, type IdWidget } from '@/data/registre';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les widgets qu'on peut encore ajouter, comme une bibliothèque : une recherche, puis un rayon par sport (la couleur désigne le sport),
// puis ce qui vaut pour tous. Chaque widget : nom, description, bouton Ajouter.
const COULEUR_RAYON: Record<string, 'sportCourse' | 'sportVelo' | 'sportNatation' | 'sportMuscu' | 'sportHybride'> = {
  'Course à pied': 'sportCourse',
  Trail: 'sportCourse',
  Vélo: 'sportVelo',
  Natation: 'sportNatation',
  'Triathlon et duathlon': 'sportVelo',
  Musculation: 'sportMuscu',
  Hyrox: 'sportHybride',
};

export function BibliothequeWidgets({ ids, onAjouter }: { ids: string[]; onAjouter: (id: string) => void }) {
  const p = usePalette();
  const [requete, setRequete] = useState('');
  const rayons = useMemo(() => rangerBibliotheque(ids, requete), [ids, requete]);

  return (
    <Bloc titre="Ajouter un widget">
      {ids.length ? (
        <>
          <View style={[styles.recherche, { backgroundColor: p.surface2, borderColor: p.contourChamp }]}>
            <TextInput
              value={requete}
              onChangeText={setRequete}
              placeholder="Rechercher un widget ou un sport"
              placeholderTextColor={p.texteMuet}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Rechercher un widget ou un sport"
              style={[typo.corps, styles.champ, { color: p.texte }]}
            />
          </View>
          {rayons.length ? (
            rayons.map((r) => {
              const cle = COULEUR_RAYON[r.categorie];
              return (
                <View key={r.categorie} style={{ marginTop: espace.e4 }}>
                  <View accessible accessibilityRole="header" accessibilityLabel={`${r.categorie}, ${r.ids.length} widget${r.ids.length > 1 ? 's' : ''}`} style={styles.enteteRayon}>
                    <View style={[styles.point, { backgroundColor: cle ? p[cle] : p.sportNeutre }]} />
                    <Text style={[styles.nomRayon, { color: p.texte }]}>{r.categorie}</Text>
                    <Text style={[typo.petit, { color: p.texteDoux }]}>{r.ids.length}</Text>
                  </View>
                  {r.ids.map((id, i) => {
                    const def = WIDGETS[id as IdWidget];
                    return (
                      <View key={id} style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[typo.corpsFort, { color: p.texte }]}>{def.nom}</Text>
                          <Text style={[typo.petit, { color: p.texteDoux }]}>{def.description}</Text>
                        </View>
                        <View style={{ minWidth: 104 }}>
                          <Bouton variante="discret" onPress={() => onAjouter(id)} accessibilityLabel={`Ajouter ${def.nom}`}>
                            Ajouter
                          </Bouton>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          ) : (
            <Text accessibilityRole="alert" style={[typo.corps, { color: p.texteDoux, marginTop: espace.e4 }]}>
              Aucun widget ne correspond à « {requete.trim()} ».
            </Text>
          )}
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Tous les widgets sont déjà là.</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  recherche: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
  champ: { flex: 1, minHeight: 44 },
  enteteRayon: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  point: { width: 10, height: 10, borderRadius: 5 },
  nomRayon: { flex: 1, fontFamily: police.titre700, fontSize: 17, lineHeight: 22 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, paddingVertical: 10 },
});
