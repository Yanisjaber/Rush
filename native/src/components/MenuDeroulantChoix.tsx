import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un choix dans une liste de textes, en menu déroulant : un champ (comme les autres pastilles) et une liste qui s'ouvre juste dessous, comme le menu des sports.
// `options` : la clé est ce qui est enregistré (« » = rien choisi), le nom est ce qui s'affiche.
export function MenuDeroulantChoix({ etiquette, valeur, options, onChoisir, vide = 'Non précisé' }: { etiquette: string; valeur: string; options: { cle: string; nom: string }[]; onChoisir: (cle: string) => void; vide?: string }) {
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

  // La liste s'ouvre sous le champ ; s'il n'y a pas assez de place dessous et plus dessus, elle s'ouvre vers le haut
  const placeDessous = hauteurEcran - zone.bas - 24;
  const placeDessus = zone.haut - 60;
  const versLeHaut = placeDessous < 300 && placeDessus > placeDessous;
  const placement = versLeHaut ? { bottom: hauteurEcran - zone.haut + 6, maxHeight: Math.max(160, placeDessus) } : { top: zone.bas + 6, maxHeight: Math.max(160, placeDessous) };

  const choisi = options.find((o) => o.cle === valeur);
  const liste = [{ cle: '', nom: vide }, ...options.filter((o) => o.cle !== '')];
  return (
    <View style={{ gap: 6 }}>
      <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{etiquette}</Text>
      <Pressable
        ref={champRef}
        onPress={ouvrir}
        accessibilityRole="button"
        accessibilityLabel={`${etiquette} : ${choisi?.nom ?? vide}. Changer`}
        accessibilityState={{ expanded: ouvert }}
        style={[styles.champ, { backgroundColor: p.surface }]}
      >
        <Text numberOfLines={1} style={[typo.corpsFort, { color: choisi && choisi.cle ? p.texte : p.texteMuet, flex: 1 }]}>
          {choisi && choisi.cle ? choisi.nom : vide}
        </Text>
        <Text style={{ color: p.texteDoux, fontSize: 18 }}>⌄</Text>
      </Pressable>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOuvert(false)} accessibilityLabel="Fermer la liste" accessibilityRole="button" />
        <View accessibilityViewIsModal style={[styles.panneau, placement, { left: zone.gauche, width: Math.max(zone.largeur, 200), backgroundColor: p.surface, borderColor: p.traitFort }]}>
          <ScrollView contentContainerStyle={{ padding: 6 }} showsVerticalScrollIndicator={false}>
            {liste.map((o) => {
              const actif = valeur === o.cle;
              return (
                <Pressable
                  key={o.cle || 'aucun'}
                  onPress={() => {
                    onChoisir(o.cle);
                    setOuvert(false);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: actif }}
                  accessibilityLabel={o.nom}
                  style={({ pressed }) => [styles.ligne, (pressed || actif) && { backgroundColor: p.surface2 }]}
                >
                  <Text style={[typo.corpsFort, { color: o.cle ? p.texte : p.texteDoux, flex: 1 }]}>{o.nom}</Text>
                  {actif ? <Text style={[typo.corpsFort, { color: p.texte }]}>✓</Text> : null}
                </Pressable>
              );
            })}
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
});
