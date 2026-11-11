import { StyleSheet, Text, View } from 'react-native';
import type { Analyse } from '@/data/calendrier/analyse/constats';
import { espace, rayon, sombre } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page 4 d'une sortie : l'analyse, en lignes courtes. Une ligne = un fait qu'on ne lit pas à l'œil sur les autres pages, ou un écart à ce qui était prévu. Pas de récit.
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

      <View style={[styles.bloc, { backgroundColor: p.surface }]}>
        {analyse.lignes.map((l, i) => (
          <View key={`${l.label}-${i}`} accessible accessibilityLabel={`${l.label}. ${l.texte}`} style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[typo.micro, styles.etiquette, { color: couleurEtiquette }]}>{l.label.toUpperCase()}</Text>
            <Text style={[typo.corps, { color: p.texte }]}>{l.texte}</Text>
          </View>
        ))}
      </View>

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
  bloc: { borderRadius: rayon.base, paddingHorizontal: 14, paddingVertical: 4 },
  ligne: { paddingVertical: 12, gap: 4 },
  etiquette: { fontFamily: police.titre700, letterSpacing: 1 },
  afaire: { borderWidth: 1.5, borderRadius: rayon.bloc, padding: 14, gap: espace.e1 },
});
