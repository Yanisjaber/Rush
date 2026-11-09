import { StyleSheet, Text, View } from 'react-native';
import { dureeProfil, profilSeance, resumeBlocs } from '@/data/coach/profil-seance';
import { dureeMinutes } from '@/data/coach/libelles';
import type { BlocStructure } from '@/data/coach/types';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le « ticket » d'une séance : le jour et la durée, le nom, le profil d'intensité en barres (largeur = durée, hauteur = effort), la phrase de structure. Sert seul pour une séance proposée, et dans un plan (derrière le bouton « Détail » de chaque séance).
// Le liseré du haut porte la couleur du sport. Tout vient du serveur (structure construite par le code) : l'écran ne calcule rien d'autre que le dessin.
interface Props {
  couleur: string;
  /** « jeu. 12 nov. » */
  jour: string;
  titre: string;
  minutes: number;
  blocs?: BlocStructure[];
  /** La structure en une phrase, si le serveur l'a envoyée ; sinon on la tire des blocs */
  resume?: string;
  /** Pourquoi le coach la propose */
  raison?: string;
  /** Sans liseré (quand le ticket est déjà dans une carte qui a le sien) */
  sansLisere?: boolean;
}

const HAUTEUR_PROFIL = 44;

export function TicketSeance({ couleur, jour, titre, minutes, blocs, resume, raison, sansLisere }: Props) {
  const p = usePalette();
  const segments = profilSeance(blocs);
  const total = dureeProfil(segments);
  const phrase = resume || resumeBlocs(blocs);

  return (
    <View>
      {sansLisere ? null : <View style={[styles.lisere, { backgroundColor: couleur }]} />}
      <View style={styles.corps}>
        <Text style={[typo.micro, { color: p.texteMuet }]}>
          {jour ? `${jour} · ` : ''}
          {dureeMinutes(minutes)}
        </Text>
        <Text style={[typo.titre2, { color: p.texte }]}>{titre}</Text>

        {segments.length > 0 && total > 0 ? (
          <View
            accessible
            accessibilityLabel={phrase ? `Profil de la séance : ${phrase}` : 'Profil de la séance'}
            style={[styles.profil, { height: HAUTEUR_PROFIL }]}
          >
            {segments.map((s, i) => (
              <View
                key={i}
                style={{ flex: s.min, height: `${Math.round(s.niveau * 100)}%`, backgroundColor: s.effort ? couleur : p.traitFort, borderRadius: 3 }}
              />
            ))}
          </View>
        ) : null}
        {phrase ? <Text style={[typo.petit, { color: p.texteDoux }]}>{phrase}</Text> : null}

        {raison ? <Text style={[typo.petit, { color: p.texteDoux, fontFamily: police.texte400 }]}>{raison}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lisere: { height: 4 },
  corps: { padding: espace.e3, gap: espace.e2 },
  profil: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
});
