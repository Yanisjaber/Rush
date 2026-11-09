import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { descriptionCarte, dureeMinutes, jourCarte, MOT_ETAT, nomType, sportDeCarte } from '@/data/coach/libelles';
import type { CarteSeance } from '@/data/coach/types';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { BoutonCompact } from '@/components/ui/BoutonCompact';
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
  /** Appelé juste AVANT qu'on déplie ou replie la carte : l'écran garde alors son haut en place (le contenu s'ouvre vers le bas) */
  onBascule?: () => void;
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

export function CarteSeanceCoach({ carte, occupee, erreur, onAjouter, onAnnuler, onBascule }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, sportDeCarte(carte));
  const prop = carte.proposition;
  const etat = occupee && carte.etat === 'proposee' ? 'en_cours' : carte.etat;
  /** Une fois ajoutée, la séance se réduit à une ligne ; « Voir la séance » rouvre le ticket */
  const [deplie, setDeplie] = useState(false);
  const compact = etat === 'ajoutee' && !deplie;

  // Annulée : un bandeau discret en pointillés, plus de ticket
  if (etat === 'annulee') {
    return (
      <View accessible accessibilityLabel={`${MOT_ETAT.annulee} : ${nomType(prop.sport, prop.type)}, ${jourCarte(prop.date)}`} style={[styles.annule, { borderColor: p.traitFort }]}>
        <Text numberOfLines={2} style={[typo.petit, { color: p.texteMuet }]}>
          <Text style={{ fontFamily: police.texte600, color: p.texteDoux }}>Séance annulée</Text> · {nomType(prop.sport, prop.type)}, {jourCarte(prop.date)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.carte, { backgroundColor: p.surface, borderColor: p.trait }]}>
      <View accessible accessibilityLabel={descriptionCarte(carte)}>
        {compact ? (
          <View style={styles.compact}>
            <View style={[styles.repere, { backgroundColor: couleur }]} />
            <View style={{ flex: 1 }}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>{nomType(prop.sport, prop.type)}</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                {jourCarte(prop.date)} · {dureeMinutes(prop.minutes)}
              </Text>
            </View>
          </View>
        ) : (
          <TicketSeance couleur={couleur} jour={jourCarte(prop.date)} titre={nomType(prop.sport, prop.type)} minutes={prop.minutes} blocs={carte.blocs} sport={prop.sport} raison={carte.justification} />
        )}
      </View>

      <View style={[styles.etat, { borderTopColor: p.trait }]}>
        {etat === 'proposee' ? (
          <BoutonCompact
            style="principal"
            teinte={couleur}
            libelle="Ajouter"
            accessibilityLabel={`Ajouter la séance ${nomType(prop.sport, prop.type)}, ${jourCarte(prop.date)}, à mon calendrier`}
            onPress={onAjouter}
          />
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
            <BoutonCompact libelle="Annuler" accessibilityLabel="Annuler : retirer cette séance de mon calendrier" desactive={occupee} onPress={onAnnuler} />
            <BoutonCompact
              largeur={96}
              libelle={deplie ? 'Masquer' : 'Voir'}
              deplie={deplie}
              accessibilityLabel={deplie ? 'Masquer le détail de la séance' : 'Revoir le détail de la séance'}
              onPress={() => {
                onBascule?.();
                setDeplie((d) => !d);
              }}
            />
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
  annule: { borderWidth: 1, borderStyle: 'dashed', borderRadius: rayon.carte, paddingHorizontal: espace.e3, paddingVertical: espace.e3 },
  carte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: rayon.carte, overflow: 'hidden' },
  etat: { borderTopWidth: StyleSheet.hairlineWidth, padding: espace.e3, gap: espace.e2 },
  ajouter: { minHeight: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, padding: espace.e3 },
  repere: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  revoir: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  annuler: { minHeight: 44, paddingHorizontal: espace.e4, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
