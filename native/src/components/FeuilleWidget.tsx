import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { TAILLES, WIDGETS, type IdWidget } from '@/data/registre';
import type { Taille } from '@/data/types';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La fenêtre de modification d'un widget (ouverte par son crayon) : sa taille, ou sa suppression.
interface Props {
  id: string | null;
  taille: Taille;
  onTaille: (id: string, taille: Taille) => void;
  onSupprimer: (id: string) => void;
  onFermer: () => void;
}

export function FeuilleWidget({ id, taille, onTaille, onSupprimer, onFermer }: Props) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const def = id ? WIDGETS[id as IdWidget] : null;
  return (
    <Modal visible={!!id && !!def} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      {id && def ? (
        <View accessibilityViewIsModal style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4 }]}>
          <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
            {def.nom}
          </Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>Taille</Text>
          <View style={styles.tailles} accessibilityRole="radiogroup" accessibilityLabel={`Taille de ${def.nom}`}>
            {(def.tailles as readonly Taille[]).map((t) => (
              <Pressable
                key={t}
                onPress={() => onTaille(id, t)}
                accessibilityRole="radio"
                accessibilityState={{ selected: taille === t }}
                accessibilityLabel={`${TAILLES[t].nom}, ${TAILLES[t].description}`}
                style={[styles.taille, { borderColor: taille === t ? p.texte : p.contourChamp, backgroundColor: taille === t ? p.surface2 : 'transparent' }]}
              >
                <Text style={[typo.corpsFort, { color: p.texte, fontFamily: police.texte600 }]}>{TAILLES[t].court}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => onSupprimer(id)} accessibilityRole="button" accessibilityLabel={`Supprimer ${def.nom}`} style={[styles.supprimer, { borderColor: p.danger }]}>
            <Text style={[typo.corpsFort, { color: p.danger }]}>Supprimer</Text>
          </Pressable>
          <Bouton variante="discret" onPress={onFermer}>
            Fermer
          </Bouton>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  tailles: { flexDirection: 'row', gap: 8 },
  taille: { flex: 1, minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  supprimer: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
