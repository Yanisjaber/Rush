import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { CarteTrace } from '@/components/CarteTrace';
import { Dossard } from '@/components/Dossard';
import { IconeSport } from '@/components/IconeSport';
import { ProfilAltitude } from '@/components/ProfilAltitude';
import { StatCle } from '@/components/StatCle';
import type { ApercuImport as Apercu } from '@/data/calendrier/apercu-import';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La fenêtre qui s'ouvre quand un fichier vient d'être lu : le sport et le jour en bandeau (avec le dessin du sport), la carte, le profil d'altitude et les chiffres principaux.
// Un pop-up (carte centrée sur fond assombri) avec trois choix : Enregistrer tel quel, Modifier (ouvre le formulaire rempli) ou Annuler. Rien n'est écrit tant qu'on n'a pas touché « Enregistrer ».
interface Props {
  ouvert: boolean;
  apercu: Apercu;
  /** Clé du sport (course, velo…) : la couleur de la trace et du liseré. */
  sport: string;
  nomSport: string;
  /** Le jour et l'heure, déjà mis en forme (« sam. 16 mai · 09:56 »). */
  quand: string;
  km: number | null;
  enCours: boolean;
  erreur: string;
  onEnregistrer: () => void;
  onModifier: () => void;
  onAnnuler: () => void;
}

export function ApercuImport({ ouvert, apercu, sport, nomSport, quand, km, enCours, erreur, onEnregistrer, onModifier, onAnnuler }: Props) {
  const p = usePalette();
  const { top, bottom } = useSafeAreaInsets();
  const hauteurEcran = useWindowDimensions().height;
  const couleur = couleurSport(p, sport);
  // Un pop-up : une carte au centre, le fond assombri derrière. Pas de fermeture en touchant à côté (ça jetterait l'import par erreur) : il faut un des trois boutons.
  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onAnnuler}>
      <View style={[styles.voile, { paddingTop: top + espace.e4, paddingBottom: bottom + espace.e4 }]}>
        <View accessibilityViewIsModal style={[styles.carte, { backgroundColor: p.surface, borderColor: p.traitFort, maxHeight: hauteurEcran - top - bottom - espace.e6 }]}>
          <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
            <Dossard taille="m" sport={sport} etiquette="Activité importée" nom={nomSport} detail={quand} icone={<IconeSport sport={sport} taille={sport === 'velo' ? 84 : 60} epais />} />
            {apercu.region && apercu.trace.length > 1 ? <CarteTrace trace={apercu.trace} region={apercu.region} couleur={couleur} hauteur={150} /> : null}
            {apercu.profil.length > 1 && apercu.altitudeMin != null && apercu.altitudeMax != null ? (
              <ProfilAltitude profil={apercu.profil} min={apercu.altitudeMin} max={apercu.altitudeMax} km={km} couleur={couleur} hauteur={56} />
            ) : null}
            <View style={styles.stats}>
              {apercu.stats.map((s) => (
                <View key={s.libelle} style={styles.stat}>
                  <StatCle petit etiquette={s.libelle} valeur={s.valeur} />
                </View>
              ))}
            </View>
            {erreur ? (
              <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                {erreur}
              </Text>
            ) : null}
            <View style={styles.boutons}>
              <View style={{ flex: 1 }}>
                <Bouton variante="discret" onPress={onAnnuler}>
                  Annuler
                </Bouton>
              </View>
              <View style={{ flex: 1 }}>
                <Bouton variante="discret" onPress={onModifier}>
                  Modifier
                </Bouton>
              </View>
              <View style={{ flex: 1.3 }}>
                <Bouton onPress={onEnregistrer}>{enCours ? 'Envoi…' : 'Enregistrer'}</Bouton>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: espace.e4 },
  carte: { borderRadius: rayon.bloc, borderWidth: 1, overflow: 'hidden' },
  contenu: { padding: espace.e3, gap: espace.e3 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espace.e3 },
  stat: { width: '33.33%' },
  boutons: { flexDirection: 'row', gap: espace.e2 },
});
