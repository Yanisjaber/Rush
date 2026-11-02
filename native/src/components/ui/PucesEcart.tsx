import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import type { PuceEcart } from '@/data/calendrier/donnees-ecartees';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// « Compte dans mes calculs » (maquette 3 de claude.ai/artifact/Nth5tKUEcoxCC4Y6rAmBTT, choisie par Yanis le 2 nov. 2026) : une puce par donnée de l'activité.
// Cochée (✓) : la donnée compte partout. Décochée et barrée : elle est écartée de tous les calculs (forme, niveau, records, charge, totaux), mais gardée en base.
interface Props {
  puces: PuceEcart[];
  /** La couleur du sport de l'activité. */
  couleur: string;
  /** Touche d'une puce : écarte la donnée, ou la remet. */
  onBasculer: (puce: PuceEcart) => void;
  erreur?: string;
}

export function PucesEcart({ puces, couleur, onBasculer, erreur }: Props) {
  const p = usePalette();
  return (
    <Bloc titre="Compte dans mes calculs">
      <View style={styles.puces}>
        {puces.map((puce) => (
          <Pressable
            key={puce.cle}
            onPress={() => onBasculer(puce)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !puce.ecartee }}
            accessibilityLabel={`${puce.libelle}, ${puce.ecartee ? 'écartée de tes calculs' : 'compte dans tes calculs'}`}
            style={[styles.puce, puce.ecartee ? { backgroundColor: p.surface2, borderColor: p.traitFort } : { backgroundColor: avecAlpha(couleur, 0.18), borderColor: couleur }]}
          >
            {puce.ecartee ? null : <Text style={[styles.coche, { color: couleur }]}>✓</Text>}
            <Text style={[typo.corpsFort, puce.ecartee ? { color: p.texteMuet, textDecorationLine: 'line-through' } : { color: p.texte }]}>{puce.libelle}</Text>
          </Pressable>
        ))}
      </View>
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, marginTop: espace.e2 }]}>
          {erreur}
        </Text>
      ) : (
        <Text style={[typo.petit, { color: p.texteDoux, marginTop: espace.e2 }]}>Touche une puce pour écarter ou remettre la donnée.</Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.rond, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  coche: { fontFamily: police.texte600, fontSize: 15 },
});
