import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CarteSeance, MessageCoach } from '@/data/coach/types';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { CarteSeanceCoach } from './CarteSeanceCoach';

// Un message du fil (maquette « fil classique ») : des blocs sobres, pas de grosses bulles. Toi à droite sur une surface pleine,
// le coach à gauche sur une surface avec un trait fin. Les cartes de séance du coach se posent sous son message, en pleine largeur.
// Le texte s'affiche tel quel (jamais interprété comme du HTML ou du lien).
interface Props {
  message: MessageCoach;
  occupees: Record<string, boolean>;
  erreursCarte: Record<string, string>;
  /** Proposer « Réessayer » sous un message en échec */
  peutReessayer: boolean;
  onReessayer: (texte: string) => void;
  onAjouter: (c: CarteSeance) => void;
  onAnnuler: (c: CarteSeance) => void;
}

export function MessageVue({ message, occupees, erreursCarte, peutReessayer, onReessayer, onAjouter, onAnnuler }: Props) {
  const p = usePalette();
  const moi = message.role === 'user';
  const attente = message.enCours && !message.texte;

  return (
    <View style={[styles.ligne, moi ? styles.droite : styles.gauche]}>
      {moi || message.texte || attente ? (
        <View
          style={[
            styles.bloc,
            moi
              ? { backgroundColor: p.surface2, maxWidth: '86%' }
              : { backgroundColor: p.surface, borderColor: p.trait, borderWidth: StyleSheet.hairlineWidth, maxWidth: '92%' },
          ]}
        >
          {attente ? (
            <View accessible accessibilityLabel="Le coach écrit" style={styles.attente}>
              <ActivityIndicator color={p.texteDoux} />
            </View>
          ) : (
            <Text selectable accessibilityLabel={`${moi ? 'Toi' : 'Coach'} : ${message.texte}`} style={[typo.corps, { color: p.texte }]}>
              {message.texte}
            </Text>
          )}
        </View>
      ) : null}

      {message.cartes.map((c) => (
        <View key={c.id} style={styles.carte}>
          <CarteSeanceCoach carte={c} occupee={!!occupees[c.id]} erreur={erreursCarte[c.id]} onAjouter={() => onAjouter(c)} onAnnuler={() => onAnnuler(c)} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { gap: espace.e2 },
  droite: { alignItems: 'flex-end' },
  gauche: { alignItems: 'flex-start' },
  bloc: { borderRadius: rayon.l, paddingHorizontal: espace.e3, paddingVertical: espace.e2 },
  attente: { minHeight: 24, minWidth: 40, justifyContent: 'center' },
  carte: { alignSelf: 'stretch' },
  echec: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: espace.e2, flexWrap: 'wrap' },
  reessayer: { minHeight: 44, paddingHorizontal: espace.e3, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
