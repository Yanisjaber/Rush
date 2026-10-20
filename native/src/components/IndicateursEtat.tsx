import { StyleSheet, Text, View } from 'react-native';
import { type Niveau } from '@/data/forme-sante';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les indicateurs du résumé (sommeil, récupération, forme) : un point de couleur ET un mot. La couleur ne se lit jamais seule (daltonisme).
const MOT: Record<Niveau, string> = { bon: 'Bon', moyen: 'Moyen', faible: 'Faible' };

export function IndicateursEtat({ indicateurs }: { indicateurs: { cle: string; nom: string; niveau: Niveau | null }[] }) {
  const p = usePalette();
  const couleur = (n: Niveau | null) => (n === 'bon' ? p.ok : n === 'moyen' ? p.alerte : n === 'faible' ? p.danger : p.texteMuet);
  return (
    <View style={styles.ligne}>
      {indicateurs.map((i) => (
        <View key={i.cle} accessible accessibilityLabel={`${i.nom} : ${i.niveau ? MOT[i.niveau] : 'pas de donnée'}`} style={styles.indicateur}>
          <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux }]}>
            {i.nom}
          </Text>
          <View style={styles.mot}>
            <View style={[styles.point, { backgroundColor: couleur(i.niveau) }]} />
            <Text numberOfLines={1} style={[styles.texte, { color: p.texte }]}>
              {i.niveau ? MOT[i.niveau] : '—'}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: 8, marginTop: 6 },
  indicateur: { flex: 1, minWidth: 0 },
  mot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  point: { width: 10, height: 10, borderRadius: 5 },
  texte: { fontFamily: police.texte600, fontSize: 16, lineHeight: 22 },
});
