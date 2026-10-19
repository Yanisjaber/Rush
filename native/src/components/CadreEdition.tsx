import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TAILLES, WIDGETS, type IdWidget } from '@/data/registre';
import type { Taille } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'enveloppe d'un widget en mode édition : une barre d'outils (monter, descendre, taille, retirer) au-dessus d'un aperçu
// qu'on ne peut pas toucher. Tout se fait avec des boutons de 44 pt : pas besoin de glisser-déposer.
interface Props {
  id: string;
  taille: Taille;
  index: number;
  total: number;
  onDeplacer: (index: number, sens: -1 | 1) => void;
  onTaille: (id: string, taille: Taille) => void;
  onRetirer: (id: string) => void;
  children: ReactNode;
}

export function CadreEdition({ id, taille, index, total, onDeplacer, onTaille, onRetirer, children }: Props) {
  const p = usePalette();
  const def = WIDGETS[id as IdWidget];
  const nom = def?.nom ?? id;
  return (
    <View style={[styles.cadre, { borderColor: p.traitFort, backgroundColor: p.fond }]}>
      <View style={[styles.outils, { backgroundColor: p.surface, borderBottomColor: p.traitFort }]}>
        <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
          {nom}
        </Text>
        <Bouton etiquette={`Monter ${nom}`} desactive={index === 0} onPress={() => onDeplacer(index, -1)}>
          ↑
        </Bouton>
        <Bouton etiquette={`Descendre ${nom}`} desactive={index === total - 1} onPress={() => onDeplacer(index, 1)}>
          ↓
        </Bouton>
        <Bouton etiquette={`Retirer ${nom}`} danger onPress={() => onRetirer(id)}>
          ✕
        </Bouton>
      </View>
      {def && def.tailles.length > 1 ? (
        <View style={[styles.tailles, { borderBottomColor: p.traitFort }]} accessibilityRole="radiogroup" accessibilityLabel={`Taille de ${nom}`}>
          {(def.tailles as readonly Taille[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => onTaille(id, t)}
              accessibilityRole="radio"
              accessibilityState={{ selected: taille === t }}
              accessibilityLabel={TAILLES[t].nom}
              style={[styles.taille, { borderColor: taille === t ? p.texte : p.contourChamp, backgroundColor: taille === t ? p.surface2 : 'transparent' }]}
            >
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{TAILLES[t].court}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.apercu}>
        {children}
      </View>
    </View>
  );
}

function Bouton({ etiquette, onPress, desactive = false, danger = false, children }: { etiquette: string; onPress: () => void; desactive?: boolean; danger?: boolean; children: string }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="button"
      accessibilityLabel={etiquette}
      accessibilityState={{ disabled: desactive }}
      style={({ pressed }) => [styles.bouton, { opacity: desactive ? 0.3 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.glyphe, { color: danger ? p.danger : p.texte }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cadre: { borderWidth: 2, borderStyle: 'dashed', borderRadius: rayon.base, overflow: 'hidden' },
  outils: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 14, paddingRight: 4, borderBottomWidth: 2, borderStyle: 'dashed' },
  bouton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glyphe: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24 },
  tailles: { flexDirection: 'row', gap: 8, padding: 8, borderBottomWidth: 1 },
  taille: { minWidth: 44, minHeight: 36, borderWidth: 1.5, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  apercu: { padding: 8 },
});
