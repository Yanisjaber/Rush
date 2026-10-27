import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogoNote } from '@/components/LogoNote';
import { couleurNote } from '@/data/annotations';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La légende du calendrier : une petite phrase discrète sous la grille, qui ouvre le détail de toutes les marques (fait, prévu, compétition,
// repos, cycle, note). Mêmes formes que dans la grille (voir Case dans calendrier.tsx).
export function LegendeCalendrier() {
  const p = usePalette();
  const [ouvert, setOuvert] = useState(false);
  const couleur = p.sportCourse;

  const plein = <View style={[styles.point, { backgroundColor: couleur }]} />;
  const contour = <View style={[styles.point, { borderColor: couleur, borderWidth: 1.5 }]} />;
  const carre = <View style={[styles.carre, { backgroundColor: p.dossardFond, borderColor: p.texte }]} />;

  const exemples: { marque: ReactNode; titre: string; precision: string }[] = [
    { marque: plein, titre: 'Séance faite', precision: 'La couleur du point est celle du sport.' },
    { marque: contour, titre: 'Séance prévue', precision: 'Pas encore faite.' },
    { marque: carre, titre: 'Compétition', precision: '' },
    { marque: <View style={[styles.barre, { backgroundColor: p.traitFort }]} />, titre: 'Repos', precision: 'Un jour de repos posé, sans séance.' },
    { marque: <View style={[styles.bande, { backgroundColor: couleurNote(undefined) }]} />, titre: 'Cycle', precision: 'Une bande au bas de la case, de la couleur du cycle.' },
    { marque: <LogoNote type="texte" couleur={p.texteDoux} taille={12} />, titre: 'Note', precision: 'Un petit logo dans le coin de la case.' },
  ];

  return (
    <View style={styles.ligne}>
      <Pressable onPress={() => setOuvert(true)} accessibilityRole="button" accessibilityLabel="Que signifient les points ? Ouvrir la légende" hitSlop={{ top: 14, bottom: 14, left: 24, right: 24 }} style={styles.aide}>
        <Text style={[typo.micro, { color: p.texteMuet }]}>Que signifient les points ?</Text>
      </Pressable>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <Pressable style={[StyleSheet.absoluteFill, styles.voile]} onPress={() => setOuvert(false)} accessibilityRole="button" accessibilityLabel="Fermer la légende" />
        <View pointerEvents="box-none" style={styles.centre}>
          <View accessibilityViewIsModal style={[styles.panneau, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
            <Text accessibilityRole="header" style={[typo.titre2, { color: p.texte }]}>
              Lire le calendrier
            </Text>
            {exemples.map((e, i) => (
              <View key={e.titre} accessible style={[styles.exemple, i > 0 && { borderTopColor: p.trait, borderTopWidth: 1 }]}>
                <View style={styles.marque}>{e.marque}</View>
                <View style={{ flex: 1 }}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>{e.titre}</Text>
                  {e.precision ? <Text style={[typo.petit, { color: p.texteDoux }]}>{e.precision}</Text> : null}
                </View>
              </View>
            ))}
            <Pressable onPress={() => setOuvert(false)} accessibilityRole="button" style={styles.fermer}>
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Collée à la grille : on annule l'écart de la page (espace.e3) au-dessus et on en garde un tout petit
  ligne: { alignItems: 'center', marginTop: -espace.e3 + 3, marginBottom: -4 },
  point: { width: 6, height: 6, borderRadius: 3 },
  carre: { width: 6, height: 6, borderRadius: 1.5, borderWidth: 1 },
  barre: { width: 10, height: 3, borderRadius: 2 },
  bande: { width: 24, height: 4, borderRadius: 2 },
  aide: { paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center', justifyContent: 'center' },
  voile: { backgroundColor: 'rgba(0,0,0,0.45)' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  panneau: { width: '100%', maxWidth: 360, borderWidth: 1, borderRadius: rayon.bloc, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 6 },
  exemple: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  marque: { width: 36, alignItems: 'center', justifyContent: 'center' },
  fermer: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
