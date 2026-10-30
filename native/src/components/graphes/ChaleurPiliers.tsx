import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PILIERS, type NiveauGlobalAnnee } from '@/data/bilan/piliers-niveau';
import { rayon } from '@/theme/couleurs';
import { meilleurTexte, melanger } from '@/theme/contraste';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La carte de chaleur des piliers : une ligne par pilier, une colonne par année. Plus la case est bleue (la couleur du vélo), plus la note est haute.
// Les 4 dernières années tiennent à l'écran ; « Tout l'historique » ouvre toutes les années, qu'on fait défiler de côté (les noms des piliers restent à gauche).
interface Props {
  annees: NiveauGlobalAnnee[];
  couleur: string;
}

const ANNEES_VISIBLES = 4;
const LARGEUR_NOMS = 98;
const CASE = 48;
const HAUTEUR_CASE = 40;
const ECART = 4;

export function ChaleurPiliers({ annees, couleur }: Props) {
  const p = usePalette();
  const [toutes, setToutes] = useState(false);
  const montrees = toutes ? annees : annees.slice(-ANNEES_VISIBLES);
  const peutDeplier = annees.length > ANNEES_VISIBLES;
  const dernier = annees[annees.length - 1];

  const colonnes = (
    <View>
      <View style={styles.rangee}>
        {montrees.map((a) => (
          <Text key={a.an} style={[typo.petit, styles.annee, { color: a.an === dernier.an ? p.texte : p.texteMuet, fontFamily: a.an === dernier.an ? police.texte600 : police.texte400 }]}>{a.an}</Text>
        ))}
      </View>
      {PILIERS.map((pi) => (
        <View key={pi.cle} style={styles.rangee}>
          {montrees.map((a) => {
            const v = a.piliers[pi.cle];
            if (v === null) {
              return (
                <View key={a.an} accessible accessibilityLabel={`${pi.nom} en ${a.an} : pas mesuré`} style={[styles.case, { borderWidth: 1, borderColor: p.trait }]}>
                  <Text style={[styles.note, { color: p.texteMuet }]}>—</Text>
                </View>
              );
            }
            const fond = melanger(couleur, 0.1 + 0.9 * (v / 100), p.surface);
            return (
              <View key={a.an} accessible accessibilityLabel={`${pi.nom} en ${a.an} : ${Math.round(v)} sur 100`} style={[styles.case, { backgroundColor: fond }]}>
                <Text style={[styles.note, { color: meilleurTexte(fond, [p.texte, p.encreSurCouleur]) }]}>{Math.round(v)}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.tableau}>
        <View style={{ width: LARGEUR_NOMS }}>
          <View style={styles.rangee}><Text style={[typo.petit, styles.annee]}> </Text></View>
          {PILIERS.map((pi) => (
            <View key={pi.cle} style={[styles.rangee, { alignItems: 'center' }]}>
              <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>{pi.court}</Text>
            </View>
          ))}
        </View>
        {toutes ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>{colonnes}</ScrollView> : <View style={{ flex: 1 }}>{colonnes}</View>}
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
  tableau: { flexDirection: 'row' },
  rangee: { flexDirection: 'row', height: HAUTEUR_CASE + ECART, alignItems: 'center' },
  annee: { width: CASE + ECART, textAlign: 'center', fontVariant: ['tabular-nums'] },
  case: { width: CASE, height: HAUTEUR_CASE, marginRight: ECART, borderRadius: rayon.l, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: police.titre700, fontSize: 16, fontVariant: ['tabular-nums'] },
  bascule: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
