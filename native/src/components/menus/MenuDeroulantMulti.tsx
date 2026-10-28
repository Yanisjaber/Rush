import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Comme MenuDeroulantChoix, mais on peut cocher plusieurs choix (les symptômes) : la liste reste ouverte tant qu'on ne la ferme pas.
// Le champ affiche les choix cochés, séparés par des virgules.
export function MenuDeroulantMulti({ etiquette, valeurs, options, onChange, vide = 'Aucun', sur = 'fond' }: { etiquette: string; valeurs: string[]; options: { cle: string; nom: string }[]; onChange: (cles: string[]) => void; vide?: string; sur?: 'fond' | 'surface' }) {
  const p = usePalette();
  const champRef = useRef<ComponentRef<typeof View>>(null);
  const [ouvert, setOuvert] = useState(false);
  const [zone, setZone] = useState({ haut: 0, bas: 0, gauche: 0, largeur: 0 });
  const hauteurEcran = useWindowDimensions().height;

  const ouvrir = () =>
    champRef.current?.measureInWindow((x, y, w, h) => {
      setZone({ haut: y, bas: y + h, gauche: x, largeur: w });
      setOuvert(true);
    });

  const placeDessous = hauteurEcran - zone.bas - 24;
  const placeDessus = zone.haut - 60;
  const versLeHaut = placeDessous < 380 && placeDessus > placeDessous;
  const placement = versLeHaut ? { bottom: hauteurEcran - zone.haut + 6, maxHeight: Math.max(160, placeDessus) } : { top: zone.bas + 6, maxHeight: Math.max(160, placeDessous) };

  const texte = options.filter((o) => valeurs.includes(o.cle)).map((o) => o.nom).join(', ');
  const basculer = (cle: string) => onChange(options.map((o) => o.cle).filter((c) => (c === cle ? !valeurs.includes(c) : valeurs.includes(c))));
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{etiquette}</Text>
      <Pressable
        ref={champRef}
        onPress={ouvrir}
        accessibilityRole="button"
        accessibilityLabel={`${etiquette} : ${texte || vide}. Changer`}
        accessibilityState={{ expanded: ouvert }}
        style={[styles.champ, { backgroundColor: sur === 'surface' ? p.surface2 : p.surface }]}
      >
        <Text numberOfLines={1} style={[typo.corpsFort, { color: texte ? p.texte : p.texteMuet, flex: 1 }]}>
          {texte || vide}
        </Text>
        <Text style={{ color: p.texteDoux, fontSize: 18 }}>⌄</Text>
      </Pressable>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOuvert(false)} accessibilityLabel="Fermer la liste" accessibilityRole="button" />
        <View accessibilityViewIsModal style={[styles.panneau, placement, { left: zone.gauche, width: Math.max(zone.largeur, 200), backgroundColor: p.surface, borderColor: p.traitFort }]}>
          <ScrollView contentContainerStyle={{ padding: 6 }} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const coche = valeurs.includes(o.cle);
              return (
                <Pressable
                  key={o.cle}
                  onPress={() => basculer(o.cle)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: coche }}
                  accessibilityLabel={o.nom}
                  style={({ pressed }) => [styles.ligne, (pressed || coche) && { backgroundColor: p.surface2 }]}
                >
                  <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>{o.nom}</Text>
                  <View style={[styles.case, { borderColor: coche ? p.sportHybride : p.contourChamp, backgroundColor: coche ? p.sportHybride : 'transparent' }]}>
                    {coche ? <Text style={{ color: p.encreSurCouleur, fontSize: 13, fontFamily: police.titre700 }}>✓</Text> : null}
                  </View>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setOuvert(false)} accessibilityRole="button" accessibilityLabel="Terminé" style={[styles.ligne, { justifyContent: 'center' }]}>
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}>Terminé</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  champ: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: rayon.rond, paddingHorizontal: 18 },
  panneau: { position: 'absolute', borderWidth: 1, borderRadius: rayon.bloc, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: 12 },
  case: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
