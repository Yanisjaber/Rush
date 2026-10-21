import { FondDegrade } from '@/components/FondDegrade';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { espace } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// Le cadre d'un écran de section (sous Paramètres) : défilement, clavier, espace pour la barre du bas.
export function EcranSection({ children }: { children: ReactNode }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'transparent' }}>
      <FondDegrade />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: espace.e4, paddingBottom: bas + 96 }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
