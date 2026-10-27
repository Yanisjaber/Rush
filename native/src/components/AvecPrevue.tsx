import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { usePrevue } from '@/hooks/usePrevue';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import type { PrevueComplete } from '@/data/types';

// Les écrans « séance prévue » et « compétition » servent à créer (sans paramètre) comme à modifier (paramètre « id ») : pour modifier, on charge d'abord la ligne
// (une roue d'attente, ou un message si elle n'existe plus), puis on rend le formulaire avec elle. Sans « id », le formulaire reçoit null et part de zéro.
export function AvecPrevue({ children }: { children: (prevue: PrevueComplete | null) => ReactNode }) {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const modif = id ? String(id) : '';
  const { prevue, chargement, erreur } = usePrevue(modif);
  if (modif && chargement) {
    return (
      <View accessible accessibilityLabel="Chargement" style={styles.centre}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (modif && !prevue) {
    return (
      <View style={styles.centre}>
        <Text accessibilityRole="alert" style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>
          {erreur || 'Séance introuvable.'}
        </Text>
      </View>
    );
  }
  return <>{children(modif ? prevue : null)}</>;
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
});
