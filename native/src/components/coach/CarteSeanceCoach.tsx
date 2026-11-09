import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { descriptionCarte, jourCarte, MOT_ETAT, nomType, sportDeCarte } from '@/data/coach/libelles';
import type { CarteSeance } from '@/data/coach/types';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { TicketSeance } from './TicketSeance';

// La carte d'une séance proposée par le coach : le ticket (jour, nom, profil d'intensité, chiffres) puis le bouton. Elle n'ajoute RIEN toute seule :
// c'est « Ajouter » qui écrit au calendrier (le serveur revérifie alors toutes les règles). Le liseré du haut porte la couleur du sport ;
// chaque état se dit avec un mot ET une icône.
interface Props {
  carte: CarteSeance;
  /** Une action est en cours sur cette carte */
  occupee: boolean;
  /** Le message d'erreur de la dernière action (réseau, règle refusée au moment du tap…) */
  erreur?: string;
  onAjouter: () => void;
  onAnnuler: () => void;
}

function Picto({ nom, couleur, taille = 18 }: { nom: 'plus' | 'ok' | 'alerte'; couleur: string; taille?: number }) {
  const trace = { plus: 'M12 5v14M5 12h14', ok: 'M5 12l5 5 9-10', alerte: 'M12 7v6M12 16.5v.5' }[nom];
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {nom === 'alerte' ? <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" stroke={couleur} strokeWidth={2} /> : null}
      <Path d={trace} stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CarteSeanceCoach({ carte, occupee, erreur, onAjouter, onAnnuler }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, sportDeCarte(carte));
  const prop = carte.proposition;
  const etat = occupee && carte.etat === 'proposee' ? 'en_cours' : carte.etat;

  return (
    <View style={[styles.carte, { backgroundColor: p.surface, borderColor: p.trait }]}>
      <View accessible accessibilityLabel={descriptionCarte(carte)}>
        <TicketSeance couleur={couleur} jour={jourCarte(prop.date)} titre={nomType(prop.sport, prop.type)} minutes={prop.minutes} blocs={carte.blocs} charge={carte.tss_estime} raison={carte.justification} />
      </View>

      <View style={[styles.etat, { borderTopColor: p.trait }]}>
        {etat === 'proposee' ? (
          <Pressable
            onPress={onAjouter}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter la séance ${nomType(prop.sport, prop.type)}, ${jourCarte(prop.date)}, à mon calendrier`}
            style={({ pressed }) => [styles.ajouter, { backgroundColor: couleur, opacity: pressed ? 0.8 : 1 }]}
          >
            <Picto nom="plus" couleur={p.encreSurCouleur} />
            <Text style={[typo.corpsFort, { color: p.encreSurCouleur }]}>Ajouter</Text>
          </Pressable>
        ) : null}

        {etat === 'en_cours' ? (
          <View accessible accessibilityLabel={MOT_ETAT.en_cours} style={styles.ligne}>
            <ActivityIndicator color={p.texteDoux} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>{MOT_ETAT.en_cours}</Text>
          </View>
        ) : null}

        {etat === 'ajoutee' ? (
          <View style={styles.ligne}>
            <Picto nom="ok" couleur={p.ok} />
            <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>{MOT_ETAT.ajoutee}</Text>
            <Pressable
              onPress={onAnnuler}
              disabled={occupee}
              accessibilityRole="button"
              accessibilityLabel="Annuler : retirer cette séance de mon calendrier"
              style={({ pressed }) => [styles.annuler, { borderColor: p.contourChamp, opacity: occupee ? 0.5 : pressed ? 0.7 : 1 }]}
            >
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Annuler</Text>
            </Pressable>
          </View>
        ) : null}

        {etat === 'refusee' ? (
          <View accessible accessibilityLabel={`${MOT_ETAT.refusee}. ${carte.motif ?? ''}`} style={styles.ligne}>
            <Picto nom="alerte" couleur={p.danger} />
            <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>
              <Text style={{ fontFamily: police.texte600, color: p.danger }}>{MOT_ETAT.refusee}.</Text> {carte.motif ?? 'Cette séance ne respecte pas tes règles.'}
            </Text>
          </View>
        ) : null}

        {etat === 'annulee' ? <Text style={[typo.petit, { color: p.texteMuet }]}>{MOT_ETAT.annulee}</Text> : null}

        {erreur ? (
          <View accessibilityRole="alert" style={styles.ligne}>
            <Picto nom="alerte" couleur={p.danger} />
            <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>{erreur}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: rayon.carte, overflow: 'hidden' },
  etat: { borderTopWidth: StyleSheet.hairlineWidth, padding: espace.e3, gap: espace.e2 },
  ajouter: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  annuler: { minHeight: 44, paddingHorizontal: espace.e4, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
