import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { repereHeure } from '@/data/coach/libelles';
import { estPlanning } from '@/data/coach/types';
import type { Carte, MessageCoach } from '@/data/coach/types';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { CartePlanningCoach } from './CartePlanningCoach';
import { CarteSeanceCoach } from './CarteSeanceCoach';

// Un message du fil (façon Messages d'iOS, variante « sans queue, serré ») : des capsules rondes. Toi à droite en couleur de sport (course),
// le coach à gauche sur une surface neutre. Les cartes de séance du coach se posent sous son message, en pleine largeur.
// Le texte s'affiche tel quel (jamais interprété comme du HTML ou du lien).
/** Largeur de la colonne d'heures qui apparaît quand on glisse le fil vers la gauche */
export const HEURE_LARGEUR = 44;

interface Props {
  message: MessageCoach;
  occupees: Record<string, boolean>;
  erreursCarte: Record<string, string>;
  /** Proposer « Réessayer » sous un message en échec */
  peutReessayer: boolean;
  onReessayer: (texte: string) => void;
  /** « Ajouter » (une séance) ou « Valider le plan » (un plan) */
  onAjouter: (c: Carte) => void;
  /** Faux dès qu'un message a suivi celui-ci : plus de bouton « Annuler » sur ses cartes */
  peutAnnuler: boolean;
  onAnnuler: (c: Carte) => void;
  /** « Refaire le plan » : redemande au coach de recalculer */
  onRefaire: () => void;
  onVoirCalendrier: () => void;
  /** Une carte va se déplier ou se replier : l'écran compense pour que son haut reste en place */
  onBascule?: () => void;
  /** Le message suivant (plus récent) est du même auteur : on le colle contre celui-ci */
  colle?: boolean;
  /** De combien le fil est tiré vers la gauche (0 au repos, négatif quand on glisse) : l'heure de chaque message apparaît à droite, comme dans Messages */
  decalage?: SharedValue<number>;
}

export function MessageVue({ message, occupees, erreursCarte, peutReessayer, onReessayer, onAjouter, peutAnnuler, onAnnuler, onRefaire, onVoirCalendrier, onBascule, colle, decalage }: Props) {
  const p = usePalette();
  const heure = message.date ? repereHeure(message.date)?.heure : undefined;
  const glisse = useAnimatedStyle(() => ({ transform: [{ translateX: decalage ? decalage.value : 0 }] }));
  const moi = message.role === 'user';
  const attente = message.enCours && !message.texte;

  return (
    <Animated.View style={[styles.ligne, moi ? styles.droite : styles.gauche, { marginBottom: colle ? espace.e1 / 2 : espace.e3 }, glisse]}>
      {heure && !message.enCours ? (
        <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[typo.micro, styles.heure, { color: p.texteMuet }]}>
          {heure}
        </Text>
      ) : null}
      {moi || message.texte || attente ? (
        <View
          style={[
            styles.bloc,
            moi
              ? { backgroundColor: p.sportCourse, maxWidth: '82%' }
              : { backgroundColor: p.surface2, maxWidth: '86%' },
          ]}
        >
          {attente ? (
            <View accessible accessibilityLabel="Le coach écrit" style={styles.attente}>
              <ActivityIndicator color={p.texteDoux} />
            </View>
          ) : (
            <Text selectable accessibilityLabel={`${moi ? 'Toi' : 'Coach'} : ${message.texte}`} style={[typo.corps, { color: moi ? p.encreSurCouleur : p.texte }]}>
              {message.texte}
            </Text>
          )}
        </View>
      ) : null}

      {message.cartes.map((c) => (
        <View key={c.id} style={styles.carte}>
          {estPlanning(c) ? (
            <CartePlanningCoach carte={c} occupee={!!occupees[c.id]} erreur={erreursCarte[c.id]} onValider={() => onAjouter(c)} onAnnuler={peutAnnuler ? () => onAnnuler(c) : undefined} onRefaire={onRefaire} onVoirCalendrier={onVoirCalendrier} onBascule={onBascule} />
          ) : (
            <CarteSeanceCoach carte={c} occupee={!!occupees[c.id]} erreur={erreursCarte[c.id]} onAjouter={() => onAjouter(c)} onAnnuler={peutAnnuler ? () => onAnnuler(c) : undefined} onBascule={onBascule} />
          )}
        </View>
      ))}

      {message.echec ? (
        <View accessibilityRole="alert" style={styles.echec}>
          <Text style={[typo.petit, { color: p.texte, flexShrink: 1 }]}>
            <Text style={{ fontFamily: police.texte600, color: p.danger }}>Pas envoyé.</Text> {message.echec}
          </Text>
          {peutReessayer ? (
            <Pressable
              onPress={() => onReessayer(message.texte)}
              accessibilityRole="button"
              accessibilityLabel="Réessayer d'envoyer ce message"
              style={({ pressed }) => [styles.reessayer, { borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Réessayer</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ligne: { gap: espace.e2 },
  heure: { position: 'absolute', right: -(HEURE_LARGEUR + espace.e4), top: 9, width: HEURE_LARGEUR, textTransform: 'none', letterSpacing: 0 },
  droite: { alignItems: 'flex-end' },
  gauche: { alignItems: 'flex-start' },
  bloc: { borderRadius: rayon.bulle, paddingHorizontal: 14, paddingVertical: 9 },
  attente: { minHeight: 24, minWidth: 40, justifyContent: 'center' },
  carte: { alignSelf: 'stretch' },
  echec: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: espace.e2, flexWrap: 'wrap' },
  reessayer: { minHeight: 44, paddingHorizontal: espace.e3, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
