import { Pressable, StyleSheet, Text } from 'react-native';
import { AnneauJauge } from '@/components/AnneauJauge';
import { niveauDe, type Niveau } from '@/data/forme-sante';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La jauge ronde d'un pilier : un anneau coloré selon son niveau, son indice (0 à 100) au centre, son nom dessous. Sans phrase.
// L'anneau vide veut dire « pas de donnée ». Un appui ouvre le détail.
const MOT: Record<Niveau, string> = { bon: 'bon', moyen: 'moyen', faible: 'faible' };

interface Props {
  nom: string;
  indice: number | null;
  onPress: () => void;
}

export function JaugePilier({ nom, indice, onPress }: Props) {
  const p = usePalette();
  const niveau = niveauDe(indice);
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.traitFort;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${nom} : ${indice != null && niveau ? `${indice} sur 100, ${MOT[niveau]}` : 'pas de donnée'}`} accessibilityHint="Ouvre le détail" style={styles.cellule}>
      <AnneauJauge valeur={indice} taille={64} epaisseur={8} couleur={couleur} piste={p.surface2} etiquette={`${nom} ${indice ?? 'sans donnée'}`}>
        <Text style={[styles.chiffre, { color: indice != null ? p.texte : p.texteMuet }]}>{indice ?? '—'}</Text>
      </AnneauJauge>
      <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux, marginTop: 6 }]}>
        {nom}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cellule: { width: '25%', alignItems: 'center', paddingVertical: 8, minHeight: 44 },
  chiffre: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
});
