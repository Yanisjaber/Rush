import { Pressable, StyleSheet, Text } from 'react-native';
import { AnneauJauge } from '@/components/AnneauJauge';
import { niveauDe, type Niveau } from '@/data/forme-sante';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La jauge ronde d'un pilier : un anneau coloré selon son niveau (l'arc suit l'indice de 0 à 100), la VRAIE valeur au centre (49 ms, 52 bpm…),
// son nom dessous. La note sur 100 ne s'affiche pas ici : on la voit dans l'écran État de forme. Sans phrase.
// L'anneau vide veut dire « pas de donnée ». Un appui ouvre le détail.
const MOT: Record<Niveau, string> = { bon: 'bon', moyen: 'moyen', faible: 'faible' };

interface Props {
  nom: string;
  indice: number | null;
  /** La valeur du jour en texte (« 49 », « +7 », « — » sans donnée). */
  valeur: string;
  /** Son unité (« ms », « bpm »…) ; vide, ou « /100 » pour un score : alors on ne l'écrit pas. */
  unite?: string;
  onPress: () => void;
  /** Combien de jauges tiennent sur une ligne (4 par défaut) : la jauge se réduit un peu à 5. */
  colonnes?: 3 | 4 | 5;
}

export function JaugePilier({ nom, indice, valeur, unite, onPress, colonnes = 4 }: Props) {
  const p = usePalette();
  const niveau = niveauDe(indice);
  const sansDonnee = valeur === '—';
  const uniteVisible = !sansDonnee && unite && unite !== '/100' ? unite : null;
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.traitFort;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${nom} : ${!sansDonnee ? `${valeur}${uniteVisible ? ` ${uniteVisible}` : ''}${niveau ? `, ${MOT[niveau]}` : ''}` : 'pas de donnée'}`} accessibilityHint="Ouvre le détail" style={[styles.cellule, { width: `${100 / colonnes}%` }]}>
      <AnneauJauge valeur={indice} taille={colonnes === 5 ? 58 : 64} epaisseur={colonnes === 5 ? 7 : 8} couleur={couleur} piste={p.surface2} etiquette={`${nom} ${sansDonnee ? 'sans donnée' : valeur}`}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.chiffre, { color: sansDonnee ? p.texteMuet : p.texte }]}>
          {valeur}
        </Text>
        {uniteVisible ? <Text style={[styles.unite, { color: p.texteDoux }]}>{uniteVisible}</Text> : null}
      </AnneauJauge>
      <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux, marginTop: 6 }]}>
        {nom}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cellule: { alignItems: 'center', paddingVertical: 8, minHeight: 44 },
  chiffre: { fontFamily: police.titre700, fontSize: 17, lineHeight: 20, maxWidth: 46, textAlign: 'center', fontVariant: ['tabular-nums'] },
  unite: { fontFamily: police.texte600, fontSize: 9, lineHeight: 11 },
});
