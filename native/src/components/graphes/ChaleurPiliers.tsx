import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PILIERS, type NiveauGlobalAnnee, type PilierCle } from '@/data/bilan/piliers-niveau';
import { rayon } from '@/theme/couleurs';
import { meilleurTexte, melanger } from '@/theme/contraste';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La carte de chaleur des piliers : une ligne par année (la plus récente en haut), une colonne par pilier. Plus la case est bleue (la couleur du vélo), plus la note est haute.
// Les 4 dernières années s'affichent ; « Tout l'historique » ajoute les autres en dessous. Les noms des piliers sont abrégés pour que les 5 colonnes tiennent
// sur la largeur d'un téléphone (VoiceOver lit le nom complet).
interface Props {
  annees: NiveauGlobalAnnee[];
  couleur: string;
}

const ANNEES_VISIBLES = 4;
const LARGEUR_ANNEE = 48;
const HAUTEUR_CASE = 40;
const ECART = 4;
const ABREGE: Record<PilierCle, string> = { puissance: 'Puiss.', endurance: 'Endur.', durabilite: 'Durab.', repetabilite: 'Répét.', charge: 'Charge' };

export function ChaleurPiliers({ annees, couleur }: Props) {
  const p = usePalette();
  const [toutes, setToutes] = useState(false);
  const montrees = (toutes ? annees : annees.slice(-ANNEES_VISIBLES)).slice().reverse();
  const peutDeplier = annees.length > ANNEES_VISIBLES;
  const dernier = annees[annees.length - 1];

  return (
    <View style={{ gap: 10 }}>
      <View>
        <View style={styles.rangee}>
          <View style={{ width: LARGEUR_ANNEE }} />
          {PILIERS.map((pi) => (
            <Text key={pi.cle} accessibilityLabel={pi.nom} numberOfLines={1} style={[typo.petit, styles.entete, { color: p.texteDoux }]}>{ABREGE[pi.cle]}</Text>
          ))}
        </View>
        {montrees.map((a) => (
          <View key={a.an} style={styles.rangee}>
            <Text style={[typo.corpsFort, styles.annee, { color: a.an === dernier.an ? p.texte : p.texteMuet, fontFamily: a.an === dernier.an ? police.texte600 : police.texte400 }]}>{a.an}</Text>
            {PILIERS.map((pi) => {
              const v = a.piliers[pi.cle];
              if (v === null) {
                return (
                  <View key={pi.cle} accessible accessibilityLabel={`${pi.nom} en ${a.an} : pas mesuré`} style={[styles.case, { borderWidth: 1, borderColor: p.trait }]}>
                    <Text style={[styles.note, { color: p.texteMuet }]}>—</Text>
                  </View>
                );
              }
              const fond = melanger(couleur, 0.1 + 0.9 * (v / 100), p.surface);
              return (
                <View key={pi.cle} accessible accessibilityLabel={`${pi.nom} en ${a.an} : ${Math.round(v)} sur 100`} style={[styles.case, { backgroundColor: fond }]}>
                  <Text style={[styles.note, { color: meilleurTexte(fond, [p.texte, p.encreSurCouleur]) }]}>{Math.round(v)}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {peutDeplier ? (
        <Pressable accessibilityRole="button" onPress={() => setToutes(!toutes)} style={styles.bascule}>
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{toutes ? `Les ${ANNEES_VISIBLES} dernières années` : `Tout l'historique (${annees.length} ans)`}</Text>
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
