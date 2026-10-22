import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le calendrier des mois : un panneau sous le titre du calendrier, avec l'année (flèches pour la changer) et les douze mois à toucher.
// Toucher un mois l'ouvre et ferme le panneau ; toucher ailleurs le ferme sans rien changer.
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const ANNEE_MIN = 2000;
const ANNEE_MAX = 2100;

export function SelecteurMois({
  ouvert,
  onFermer,
  affiche,
  aujourdhui,
  onChoisir,
  haut,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /** Le mois actuellement affiché dans le calendrier. */
  affiche: { annee: number; mois: number };
  /** Le mois d'aujourd'hui (marqué d'un point). */
  aujourdhui: { annee: number; mois: number };
  onChoisir: (annee: number, mois: number) => void;
  /** La position du bas du titre dans la fenêtre : le panneau se pose juste dessous. */
  haut: number;
}) {
  const p = usePalette();
  // L'année que le panneau montre : elle part de celle du calendrier à chaque ouverture
  const [annee, setAnnee] = useState(affiche.annee);
  useEffect(() => {
    if (ouvert) setAnnee(affiche.annee);
  }, [ouvert, affiche.annee]);

  const fleche = (sens: -1 | 1, libelle: string) => {
    const bloque = annee + sens < ANNEE_MIN || annee + sens > ANNEE_MAX;
    return (
      <Pressable
        disabled={bloque}
        onPress={() => setAnnee((a) => a + sens)}
        accessibilityRole="button"
        accessibilityLabel={libelle}
        style={({ pressed }) => [styles.fleche, { opacity: bloque ? 0.3 : pressed ? 0.6 : 1 }]}
      >
        <Text style={{ color: p.texte, fontSize: 30, lineHeight: 34 }}>{sens < 0 ? '‹' : '›'}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} accessibilityLabel="Fermer le calendrier des mois" accessibilityRole="button" />
      <View accessibilityViewIsModal style={[styles.panneau, { top: haut + 6, backgroundColor: p.surface, borderColor: p.traitFort }]}>
        <View style={styles.annee}>
          {fleche(-1, 'Année précédente')}
          <Text accessibilityRole="header" style={[typo.titre2, { color: p.texte }]}>
            {annee}
          </Text>
          {fleche(1, 'Année suivante')}
        </View>
        <View style={styles.grille}>
          {MOIS_COURTS.map((nom, m) => {
            const choisi = annee === affiche.annee && m === affiche.mois;
            const estAujourdhui = annee === aujourdhui.annee && m === aujourdhui.mois;
            return (
              <View key={nom} style={styles.emplacement}>
                <Pressable
                  onPress={() => onChoisir(annee, m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: choisi }}
                  accessibilityLabel={`${nom.replace('.', '')} ${annee}${estAujourdhui ? ', mois en cours' : ''}`}
                  style={({ pressed }) => [styles.mois, { backgroundColor: choisi ? p.texte : p.surface2, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[typo.corpsFort, { color: choisi ? p.fond : p.texte }]}>{nom}</Text>
                  {estAujourdhui ? <View style={[styles.point, { backgroundColor: choisi ? p.fond : p.texteDoux }]} /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panneau: { position: 'absolute', alignSelf: 'center', width: 300, borderWidth: 1, borderRadius: rayon.bloc, padding: 10 },
  annee: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fleche: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grille: { flexDirection: 'row', flexWrap: 'wrap' },
  emplacement: { width: '25%', padding: 3 },
  mois: { minHeight: 44, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  point: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2 },
});
