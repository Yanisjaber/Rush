import { FondDegrade } from '@/components/FondDegrade';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { espace } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// Le cadre d'un écran de section (sous Paramètres) : défilement, clavier.
// Pas de grande marge en bas : iOS ajoute déjà tout seul la place de la barre d'onglets (contentInsetAdjustmentBehavior), il ne reste qu'une petite respiration.
export function EcranSection({ children }: { children: ReactNode }) {
  const p = usePalette();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'transparent' }}>
      <FondDegrade />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: espace.e4, paddingBottom: espace.e3 + 2 }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
