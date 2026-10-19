import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { WIDGETS, type IdWidget } from '@/data/registre';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les widgets qu'on peut encore ajouter : nom, description, bouton Ajouter.
export function BibliothequeWidgets({ ids, onAjouter }: { ids: string[]; onAjouter: (id: string) => void }) {
  const p = usePalette();
  return (
    <Bloc titre="Ajouter un widget">
      {ids.length ? (
        ids.map((id, i) => {
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
        })
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Tous les widgets sont déjà là.</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, paddingVertical: 10 },
});
