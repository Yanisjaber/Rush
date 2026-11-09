import { StyleSheet, Text, View } from 'react-native';
import { ProfilSeance } from '@/components/graphes/ProfilSeance';
import { resumeBlocs } from '@/data/coach/profil-seance';
import { dureeMinutes } from '@/data/coach/libelles';
import type { BlocStructure } from '@/data/coach/types';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le « ticket » d'une séance : le jour et la durée, le nom, le profil par zones (le même graphe que l'écran Séance prévue : largeur = durée, hauteur et couleur = zone), la phrase de structure. Sert seul pour une séance proposée, et dans un plan (derrière le bouton « Détail » de chaque séance).
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

        {blocs && blocs.length > 0 ? (
          <View accessible accessibilityLabel={phrase ? `Profil de la séance : ${phrase}` : 'Profil de la séance'}>
            <ProfilSeance blocs={blocs} hauteur={HAUTEUR_PROFIL} />
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
});
