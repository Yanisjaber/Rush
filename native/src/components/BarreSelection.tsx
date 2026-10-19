import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAILLES, WIDGETS, type IdWidget } from '@/data/registre';
import type { Taille } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La barre fixe du mode édition, juste au-dessus du menu du bas : le widget sélectionné (nom, taille, monter, descendre) et « Retirer ».
interface Props {
  id: string;
  index: number;
  total: number;
  taille: Taille;
  onDeplacer: (index: number, sens: -1 | 1) => void;
  onTaille: (id: string, taille: Taille) => void;
  onRetirer: (id: string) => void;
}

export function BarreSelection({ id, index, total, taille, onDeplacer, onTaille, onRetirer }: Props) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const def = WIDGETS[id as IdWidget];
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Widget sélectionné"
      style={[styles.barre, { bottom: bas + 66, backgroundColor: p.surface, borderColor: p.traitFort }]}
    >
      {def ? (
        <>
          <View style={styles.ligne}>
            <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
              {def.nom}
            </Text>
            <Action etiquette={`Monter ${def.nom}`} desactive={index === 0} onPress={() => onDeplacer(index, -1)}>
              ↑
            </Action>
            <Action etiquette={`Descendre ${def.nom}`} desactive={index === total - 1} onPress={() => onDeplacer(index, 1)}>
              ↓
            </Action>
            <Pressable onPress={() => onRetirer(id)} accessibilityRole="button" accessibilityLabel={`Retirer ${def.nom}`} style={[styles.retirer, { borderColor: p.danger }]}>
              <Text style={[typo.corpsFort, { color: p.danger }]}>Retirer</Text>
            </Pressable>
          </View>
          {def.tailles.length > 1 ? (
            <View style={styles.ligne} accessibilityRole="radiogroup" accessibilityLabel={`Taille de ${def.nom}`}>
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
        </>
      ) : null}
    </View>
  );
}

function Action({ etiquette, onPress, desactive, children }: { etiquette: string; onPress: () => void; desactive: boolean; children: string }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} disabled={desactive} accessibilityRole="button" accessibilityLabel={etiquette} accessibilityState={{ disabled: desactive }} style={[styles.action, { opacity: desactive ? 0.3 : 1 }]}>
      <Text style={[styles.glyphe, { color: p.texte }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barre: { position: 'absolute', left: 12, right: 12, borderWidth: 1, borderRadius: rayon.base, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glyphe: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24 },
  retirer: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1.5, borderRadius: rayon.base, justifyContent: 'center' },
  taille: { minWidth: 44, minHeight: 36, borderWidth: 1.5, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
});
