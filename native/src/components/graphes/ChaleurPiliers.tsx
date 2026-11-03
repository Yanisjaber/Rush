import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PILIERS } from '@/data/bilan/piliers-niveau';
import { rayon } from '@/theme/couleurs';
import { meilleurTexte, melanger } from '@/theme/contraste';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La carte de chaleur des piliers : une ligne par année (la plus récente en haut), une colonne par pilier. Plus la case est bleue (la couleur du vélo), plus la note est haute ; un contour en pointillés dit que la note repose sur moins de sorties que demandé.
// L'année choisie en haut du Bilan et les 4 d'avant s'affichent ; « Tout l'historique » montre toutes les années (l'année choisie reste en gras). Les noms des piliers sont abrégés pour que les 4 colonnes tiennent
// sur la largeur d'un téléphone (VoiceOver lit le nom complet).
/** Une colonne de la carte : le vélo a les siennes (PILIERS), la course et la musculation donnent les leurs. */
export interface ColonnePilier {
  cle: string;
  nom: string;
  abrege: string;
}
/** Une année de la carte : une note et une preuve par pilier (le vélo, la course et la musculation les rendent toutes dans cette forme). */
export interface AnneePiliers {
  an: number;
  piliers: Record<string, number>;
  preuves: Record<string, number>;
}

interface Props {
  annees: readonly AnneePiliers[];
  /** Les colonnes, dans l'ordre ; par défaut les 4 piliers du vélo. */
  colonnes?: readonly ColonnePilier[];
  couleur: string;
  /** L'année choisie en haut du Bilan : la dernière ligne de la fenêtre, en gras. */
  annee: number;
}

const ANNEES_VISIBLES = 5;
const LARGEUR_ANNEE = 48;
const HAUTEUR_CASE = 40;
const ECART = 4;
const ABREGE: Record<string, string> = { puissance: 'Puiss.', endurance: 'Endur.', repetabilite: 'Répét.', charge: 'Charge' };
const COLONNES_VELO: readonly ColonnePilier[] = PILIERS.map((pi) => ({ cle: pi.cle, nom: pi.nom, abrege: ABREGE[pi.cle] }));

export function ChaleurPiliers({ annees, colonnes = COLONNES_VELO, couleur, annee }: Props) {
  const p = usePalette();
  const [toutes, setToutes] = useState(false);
  const debut = annee - ANNEES_VISIBLES + 1;
  const fenetre = annees.filter((a) => a.an >= debut && a.an <= annee);
  const montrees = (toutes ? annees : fenetre).slice().reverse();
  const peutDeplier = annees.length > fenetre.length;

  return (
    <View style={{ gap: 10 }}>
      <View>
        <View style={styles.rangee}>
          <View style={{ width: LARGEUR_ANNEE }} />
          {colonnes.map((pi) => (
            <Text key={pi.cle} accessibilityLabel={pi.nom} numberOfLines={1} style={[typo.petit, styles.entete, { color: p.texteDoux }]}>{pi.abrege}</Text>
          ))}
        </View>
        {montrees.map((a) => (
          <View key={a.an} style={styles.rangee}>
            <Text style={[typo.corpsFort, styles.annee, { color: a.an === annee ? p.texte : p.texteMuet, fontFamily: a.an === annee ? police.texte600 : police.texte400 }]}>{a.an}</Text>
            {colonnes.map((pi) => {
              const v = a.piliers[pi.cle];
              // Une note à preuve incomplète (moins de sorties que demandé) : contour en pointillés, et VoiceOver le dit
              const partielle = a.preuves[pi.cle] < 1;
              const fond = melanger(couleur, 0.1 + 0.9 * (v / 100), p.surface);
              return (
                <View
                  key={pi.cle}
                  accessible
                  accessibilityLabel={`${pi.nom} en ${a.an} : ${Math.round(v)} sur 100${partielle ? ', peu de mesures' : ''}`}
                  style={[styles.case, { backgroundColor: fond }, partielle && { borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.texteMuet }]}
                >
                  <Text style={[styles.note, { color: meilleurTexte(fond, [p.texte, p.encreSurCouleur]) }]}>{Math.round(v)}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {!montrees.length ? <Text style={[typo.corps, { color: p.texteDoux }]}>Pas de piliers mesurés de {debut} à {annee}.</Text> : null}
      {peutDeplier ? (
        <Pressable accessibilityRole="button" onPress={() => setToutes(!toutes)} style={styles.bascule}>
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{toutes ? `De ${debut} à ${annee}` : `Tout l'historique (${annees.length} ans)`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', alignItems: 'center', gap: ECART, marginBottom: ECART },
  annee: { width: LARGEUR_ANNEE, fontVariant: ['tabular-nums'] },
  entete: { flex: 1, textAlign: 'center' },
  case: { flex: 1, height: HAUTEUR_CASE, borderRadius: rayon.l, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
  bascule: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
