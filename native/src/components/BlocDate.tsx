import { StyleSheet, Text, View } from 'react-native';
import { nomJour } from '@/data/calendrier';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le bloc de date d'une ligne de liste : le nom du jour et son numéro. Aujourd'hui est en couleurs inversées.
// Largeur fixe (52 pt) pour que les contenus s'alignent d'un jour à l'autre.
interface Props {
  iso: string;
  aujourdhui?: boolean;
}

export function BlocDate({ iso, aujourdhui = false }: Props) {
  const p = usePalette();
  return (
    <View style={[styles.date, aujourdhui && { backgroundColor: p.texte }]}>
      <Text style={[typo.micro, { color: aujourdhui ? p.fond : p.texteDoux }]}>{nomJour(iso)}</Text>
      <Text style={[styles.num, { color: aujourdhui ? p.fond : p.texte }]}>{Number(iso.slice(8, 10))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  date: { width: 52, alignItems: 'center', borderRadius: rayon.base, paddingVertical: 4 },
  num: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28 },
});
