import { useRef, useState, type ComponentRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une petite pastille qui montre le choix en cours (« Temps ⌄ ») et ouvre la liste juste dessous, alignée à droite.
// Faite pour un en-tête de bloc, à côté du titre : prend la place de son texte, pas toute la largeur.
// `grand` : le choix est écrit en grand, sans contour (comme le choix de l'année en haut du Bilan), et la liste s'ouvre alignée à gauche ; elle défile s'il y a beaucoup de choix.
interface Props {
  options: { cle: string; nom: string }[];
  valeur: string;
  onChoisir: (cle: string) => void;
  /** Ce que la pastille choisit (« Mesure »), lu par VoiceOver. */
  etiquette: string;
  grand?: boolean;
}

const LARGEUR_LISTE = 230;
const LARGEUR_LISTE_GRANDE = 170;
const HAUTEUR_MAX_LISTE = 330; // un peu plus de sept lignes : au-delà, la liste défile

export function MenuMesure({ options, valeur, onChoisir, etiquette, grand = false }: Props) {
  const p = usePalette();
  const pastilleRef = useRef<ComponentRef<typeof View>>(null);
  const [ouvert, setOuvert] = useState(false);
  const [zone, setZone] = useState({ bas: 0, droite: 0, gauche: 0 });
  const choisi = options.find((o) => o.cle === valeur) ?? options[0];

  const ouvrir = () =>
    pastilleRef.current?.measureInWindow((x, y, w, h) => {
      setZone({ bas: y + h, droite: x + w, gauche: x });
      setOuvert(true);
    });

  return (
    <View>
      <Pressable
        ref={pastilleRef}
        onPress={ouvrir}
        accessibilityRole="button"
        accessibilityLabel={`${etiquette} : ${choisi?.nom}. Changer`}
        accessibilityState={{ expanded: ouvert }}
        style={[styles.pastille, grand ? styles.pastilleGrande : { borderColor: p.contourChamp, borderWidth: 1 }]}
      >
        <Text numberOfLines={1} style={grand ? [styles.texteGrand, { color: p.texte }] : [typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>
          {choisi?.nom}
        </Text>
        <Text style={{ color: p.texteDoux, fontSize: 16, marginTop: -2 }}>⌄</Text>
      </Pressable>
      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOuvert(false)} accessibilityLabel="Fermer la liste" accessibilityRole="button" />
        <View accessibilityViewIsModal style={[styles.panneau, { top: zone.bas + 6, left: grand ? Math.max(16, zone.gauche) : Math.max(16, zone.droite - LARGEUR_LISTE), width: grand ? LARGEUR_LISTE_GRANDE : LARGEUR_LISTE, backgroundColor: p.surface, borderColor: p.traitFort }]}>
          <ScrollView style={{ maxHeight: HAUTEUR_MAX_LISTE }} showsVerticalScrollIndicator={false}>
          {options.map((o) => {
            const actif = o.cle === valeur;
            return (
              <Pressable
                key={o.cle}
                onPress={() => {
                  onChoisir(o.cle);
                  setOuvert(false);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: actif }}
                style={[styles.ligne, actif && { backgroundColor: p.surface2 }]}
              >
                <Text style={[typo.corps, { color: p.texte, fontFamily: actif ? police.texte600 : police.texte400, flex: 1 }]}>{o.nom}</Text>
                {actif ? <Text style={{ color: p.texte, fontSize: 16 }}>✓</Text> : null}
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
  pastilleGrande: { paddingHorizontal: 4 },
  texteGrand: { fontFamily: police.titre800, fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums'] },
  pastille: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  panneau: { position: 'absolute', borderRadius: 24, borderWidth: 1, padding: 8 },
  ligne: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 16 },
});
