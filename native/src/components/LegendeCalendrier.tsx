import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LogoNote } from '@/components/LogoNote';
import { couleurNote } from '@/data/annotations';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
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

  const cases = (fond: string | undefined, contour?: string) => (
    <View style={[styles.mini, fond ? { backgroundColor: fond } : null, contour ? { borderColor: contour, borderWidth: 1.5 } : null]} />
  );
  const logos = (
    <View style={styles.logos}>
      {['texte', 'maladie', 'blessure', 'indisponible'].map((t) => (
        <LogoNote key={t} type={t} couleur={couleurNote(undefined)} taille={11} />
      ))}
    </View>
  );
  const barres = (
    <View style={styles.barres}>
      {[10, 16, 6, 14].map((h, i) => (
        <View key={i} style={[styles.barreSem, { height: h, backgroundColor: p.sportNeutre, opacity: i === 3 ? 0.35 : 1 }]} />
      ))}
    </View>
  );

  type Exemple = { marque: ReactNode; titre: string; precision: string };
  const sections: { titre: string; exemples: Exemple[] }[] = [
    {
      titre: 'Dans les cases',
      exemples: [
        { marque: plein, titre: 'Séance faite', precision: 'La couleur du point est celle du sport.' },
        { marque: contour, titre: 'Séance prévue', precision: 'Pas encore faite.' },
        { marque: carre, titre: 'Compétition', precision: '' },
        { marque: <Text style={[typo.micro, { color: p.texteDoux }]}>+2</Text>, titre: 'Plus de 4 marques', precision: 'Trois points, puis « +2 » : le nombre qui reste.' },
        { marque: <View style={[styles.barre, { backgroundColor: p.traitFort }]} />, titre: 'Repos', precision: 'Un jour de repos posé, sans séance.' },
        { marque: <View style={[styles.bande, { backgroundColor: couleurNote(undefined) }]} />, titre: 'Cycle', precision: 'Une bande au bas de la case, de la couleur du cycle.' },
        { marque: logos, titre: 'Notes', precision: 'Note, maladie, blessure, indisponible : un logo dans le coin.' },
        {
          marque: (
            <View style={styles.logos}>
              {cases(avecAlpha(p.sportNeutre, 0.15))}
              {cases(avecAlpha(p.sportNeutre, 0.4))}
            </View>
          ),
          titre: 'Case grisée',
          precision: 'Plus elle est foncée, plus la charge du jour est forte.',
        },
        {
          marque: <View style={[styles.mini, { backgroundColor: p.texte }]} />,
          titre: 'Aujourd’hui',
          precision: 'Le chiffre est dans un carré clair.',
        },
        { marque: cases(undefined, p.texte), titre: 'Jour choisi', precision: 'Un contour : son détail s’affiche sous la grille.' },
        { marque: <Text style={[typo.micro, { color: p.texte, opacity: 0.5 }]}>30</Text>, titre: 'Jour d’un autre mois', precision: 'Atténué. Ses séances comptent dans la colonne « Sem. ».' },
      ],
    },
    {
      titre: 'Colonne « Sem. »',
      exemples: [
        { marque: <Text style={[typo.micro, { color: p.texteDoux }]}>5h40</Text>, titre: 'Le temps de la semaine', precision: 'Avec un sport choisi, sa distance ou ses séries s’ajoutent.' },
        { marque: barres, titre: 'Une barre par jour', precision: 'De lundi à dimanche, à la hauteur du temps. Pâle : prévu seulement. Grise sur « Tous », de la couleur du sport sinon.' },
      ],
    },
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
            <ScrollView style={styles.defile} showsVerticalScrollIndicator={false}>
              {sections.map((sec) => (
                <View key={sec.titre}>
                  <Text accessibilityRole="header" style={[typo.micro, styles.sousTitre, { color: p.texteMuet }]}>
                    {sec.titre.toUpperCase()}
                  </Text>
                  {sec.exemples.map((e, i) => (
                    <View key={e.titre} accessible style={[styles.exemple, i > 0 && { borderTopColor: p.trait, borderTopWidth: 1 }]}>
                      <View style={styles.marque}>{e.marque}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typo.corpsFort, { color: p.texte }]}>{e.titre}</Text>
                        {e.precision ? <Text style={[typo.petit, { color: p.texteDoux }]}>{e.precision}</Text> : null}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
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
  marque: { width: 52, alignItems: 'center', justifyContent: 'center' },
  defile: { maxHeight: 460 },
  sousTitre: { marginTop: 14, marginBottom: 2, letterSpacing: 0.8 },
  mini: { width: 14, height: 14, borderRadius: 4 },
  logos: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barres: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 16 },
  barreSem: { width: 4, borderRadius: 2 },
  fermer: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
