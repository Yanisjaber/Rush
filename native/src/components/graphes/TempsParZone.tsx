import { StyleSheet, Text, View } from 'react-native';
import { COULEURS_ZONE, texteDuree } from '@/data/calendrier/structure';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le temps par zone d'une séance prévue (maquette 7 du 14 nov.) : une ligne par zone, une barre à la longueur de son temps, ses minutes écrites à droite.
// Z1 à Z5 toujours là (une zone vide reste lisible : 0 min), Z6 et Z7 seulement si la séance y passe.
export function TempsParZone({ minutes }: { minutes: number[] }) {
  const p = usePalette();
  const total = minutes.reduce((t, v) => t + v, 0);
  if (!(total > 0)) return null;
  const dernier = Math.max(4, ...minutes.map((v, i) => (v > 0 ? i : 0)));
  const plus = Math.max(...minutes);
  return (
    <View accessible accessibilityLabel={`Temps par zone. ${minutes.slice(0, dernier + 1).map((v, i) => `Zone ${i + 1}, ${texteDuree(v)}`).join(', ')}.`} style={{ gap: espace.e2 }}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>TEMPS PAR ZONE</Text>
      {minutes.slice(0, dernier + 1).map((v, i) => (
        <View key={i} style={styles.ligne}>
          <View style={[styles.etiquette, { backgroundColor: COULEURS_ZONE[i] }]}>
            <Text style={styles.texteEtiquette}>{`Z${i + 1}`}</Text>
          </View>
          <View style={styles.piste}>
            <View style={{ width: `${Math.max(v > 0 ? 2 : 0, (v / plus) * 100)}%`, height: 12, borderRadius: 3, backgroundColor: COULEURS_ZONE[i] }} />
          </View>
          <Text style={[styles.minutes, { color: v > 0 ? p.texte : p.texteMuet }]}>{v > 0 ? texteDuree(v) : '0 min'}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2, minHeight: 24 },
  etiquette: { minWidth: 30, height: 20, paddingHorizontal: 4, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  texteEtiquette: { fontFamily: police.texte600, fontSize: 11, letterSpacing: 0.4, color: '#0c0d10' },
  piste: { flex: 1 },
  minutes: { width: 62, textAlign: 'right', fontFamily: police.titre700, fontSize: 14, fontVariant: ['tabular-nums'] },
});
