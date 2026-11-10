import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/ui/Bouton';
import { morceauxLettre } from '@/data/calendrier/lettre-coach';
import type { EtatAnalyse } from '@/hooks/useAnalyseSortie';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page 4 d'une sortie : le retour du coach, écrit comme une lettre. Les chiffres qui comptent sont surlignés dans les phrases (le texte les entoure de [[ ]]).
// Le texte vient d'une IA qui ne connaît que les chiffres de la sortie, et chaque chiffre est contrôlé par le serveur : on le dit en bas de page.
interface Props {
  couleur: string;
  etat: EtatAnalyse;
  onDemander: () => void;
}

export function PageCoachSortie({ couleur, etat, onDemander }: Props) {
  const p = usePalette();
  const paragraphes = etat.etape === 'ok' ? etat.paragraphes : etat.etape === 'ecriture' || etat.etape === 'erreur' ? etat.ancien : null;

  return (
    <>
      <Text style={[typo.micro, { color: p.texteDoux }]}>ANALYSE DE TA SORTIE</Text>

      {paragraphes ? (
        <View accessible accessibilityLabel={paragraphes.map((x) => x.replace(/\[\[|\]\]/g, '')).join(' ')} style={[styles.lettre, { backgroundColor: p.surface }]}>
          {paragraphes.map((par, i) => (
            <Text key={i} style={[typo.corps, { color: p.texte }]}>
              {morceauxLettre(par).map((m, k) => (
                <Text key={k} style={m.chiffre ? { fontFamily: police.texte600, backgroundColor: avecAlpha(couleur, 0.2) } : undefined}>
                  {m.chiffre ? ` ${m.texte} ` : m.texte}
                </Text>
              ))}
            </Text>
          ))}
          <Text style={[typo.petit, { color: p.texteMuet, fontStyle: 'italic' }]}>— Ton coach</Text>
        </View>
      ) : null}

      {etat.etape === 'lecture' ? (
        <View accessible accessibilityLabel="Lecture de l'analyse" style={styles.attente}>
          <ActivityIndicator color={p.texteDoux} />
        </View>
      ) : null}

      {etat.etape === 'vide' ? (
        <View style={[styles.carte, { backgroundColor: p.surface }]}>
          <Text style={[typo.titre3, { color: p.texte }]}>Le retour du coach</Text>
          <Text style={[typo.corps, { color: p.texteDoux }]}>Le coach lit les chiffres de ta sortie (allure, cœur, dérive, temps par zone) et t'écrit ce qui compte pour ce type de séance.</Text>
          <Bouton onPress={onDemander}>Demander l'analyse</Bouton>
        </View>
      ) : null}

      {etat.etape === 'ecriture' ? (
        <View accessible accessibilityLiveRegion="polite" accessibilityLabel="Le coach regarde ta sortie" style={styles.attente}>
          <ActivityIndicator color={p.texteDoux} />
          <Text style={[typo.petit, { color: p.texteDoux }]}>Le coach regarde ta sortie…</Text>
        </View>
      ) : null}

      {etat.etape === 'erreur' ? (
        <View style={{ gap: espace.e2 }}>
          <Text accessibilityRole="alert" style={[typo.corps, { color: p.danger }]}>
            {etat.message}
          </Text>
          {etat.reessayer ? <Bouton variante="discret" onPress={onDemander}>Réessayer</Bouton> : null}
        </View>
      ) : null}

      {etat.etape === 'ok' ? (
        <View style={{ gap: espace.e2 }}>
          <Bouton variante="discret" petit onPress={onDemander} accessibilityLabel="Actualiser l'analyse avec les chiffres actuels">
            Actualiser l'analyse
          </Bouton>
        </View>
      ) : null}

      {paragraphes ? <Text style={[typo.petit, { color: p.texteMuet }]}>Retour écrit par une IA à partir des chiffres de ta sortie. Chaque chiffre cité est contrôlé. Ça ne remplace pas l'avis d'un professionnel de santé.</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  lettre: { borderRadius: rayon.base, padding: 16, gap: 12 },
  carte: { borderRadius: rayon.bloc, padding: 16, gap: 12 },
  attente: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
});
