import { StyleSheet, Text, View } from 'react-native';
import type { Analyse } from '@/data/calendrier/analyse/constats';
import { espace, rayon, sombre } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page 4 d'une sortie : le compte rendu d'un coach (un titre, trois ou quatre phrases) puis la consigne à retenir.
// Tout est calculé par le code (aucun modèle de langage) : voir data/calendrier/analyse/constats.ts.
interface Props {
  couleur: string;
  analyse: Analyse;
  /** Le nom de la séance du calendrier contre laquelle la sortie est jugée, s'il y en a une. */
  nomPlan: string | null;
}

export function PageAnalyseSortie({ couleur, analyse, nomPlan }: Props) {
  const p = usePalette();
  // En thème clair la couleur du sport reste réservée aux aplats (contraste, voir IDENTITE.md) : les étiquettes y gardent la couleur du texte
  const couleurEtiquette = p.fond === sombre.fond ? couleur : p.texte;
  return (
    <>
      <View style={{ gap: 2 }}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>ANALYSE</Text>
        <Text style={[typo.petit, { color: p.texteMuet }]}>{nomPlan ? `Jugée contre ta séance prévue : ${nomPlan}` : 'Aucune séance prévue reliée à cette sortie'}</Text>
      </View>

      {analyse.compteRendu ? (
        <View accessible accessibilityLabel={`${analyse.compteRendu.titre}. ${analyse.compteRendu.phrases.join(' ')}`} style={[styles.bloc, { backgroundColor: p.surface }]}>
          <Text style={[typo.titre2, { color: p.texte }]}>{analyse.compteRendu.titre}</Text>
          {analyse.compteRendu.phrases.map((ph, i) => (
            <Text key={i} style={[typo.corps, { color: p.texte }]}>{ph}</Text>
          ))}
        </View>
      ) : null}

      {analyse.aFaire ? (
        <View accessible accessibilityLabel={`À faire. ${analyse.aFaire}`} style={[styles.afaire, { borderColor: couleur }]}>
          <Text style={[typo.micro, { color: couleurEtiquette }]}>À FAIRE</Text>
          <Text style={[typo.corpsFort, { color: p.texte }]}>{analyse.aFaire}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bloc: { borderRadius: rayon.base, paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  afaire: { borderWidth: 1.5, borderRadius: rayon.bloc, padding: 14, gap: espace.e1 },
});
