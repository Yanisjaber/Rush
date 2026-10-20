import { StyleSheet, View } from 'react-native';
import type { PhaseNuit } from '@/data/sommeil';

// Les phases d'une nuit (profond, léger, paradoxal, éveillé) en une barre : chaque tronçon est large comme le temps passé dans la phase.
// Mêmes couleurs que l'écran Sommeil et que le site.
export const COULEURS_PHASE: Record<string, string> = { profond: '#3b82f6', leger: '#93c5fd', rem: '#fbbf24', eveille: '#f87171' };

export function BarrePhases({ phases, hauteur = 12 }: { phases: PhaseNuit[]; hauteur?: number }) {
  if (!phases.length) return null;
  const libelle = phases.map((p) => `${p.nom} ${Math.round(p.part * 100)} %`).join(', ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Phases de la nuit : ${libelle}`} style={[styles.barre, { height: hauteur }]}>
      {phases.map((p) => (
        <View key={p.cle} style={{ flexGrow: p.secondes, flexBasis: 0, backgroundColor: COULEURS_PHASE[p.cle] ?? '#888' }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', gap: 2, borderRadius: 6, overflow: 'hidden' },
});
