import { StyleSheet, Text, View } from 'react-native';
import { reperesRonds } from '@/data/outils/echelle';
import { formatNum } from '@/data/outils/format';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'échelle d'un graphique en barres, comme dans le cumul sur 3 ans : des traits fins à des valeurs rondes (500, 1 000, 1 500…), et le 0 sur la ligne de base,
// avec leur valeur (et son unité) écrite dans une marge à gauche des barres, jamais sous une barre. À poser derrière les barres, dans un conteneur de la même hauteur
// que la zone des barres, dont le contenu est décalé de `largeurGouttiere` vers la droite.
interface Props {
  /** Haut de l'échelle (voir echelleRonde) : 0 ou moins, et rien n'est dessiné. */
  maximum: number;
  /** Unité écrite après chaque valeur (« km », « TSS »…), vide si le titre la dit déjà. */
  unite?: string;
  /** Marges entre le conteneur et la zone des barres (une valeur écrite au-dessus, des lettres dessous). */
  haut?: number;
  bas?: number;
}

/** Les valeurs des repères : les multiples d'un pas rond jusqu'au haut de l'échelle (voir echelleRonde). */
export const graduationsBarres = reperesRonds;

const texteRepere = (v: number, unite: string): string => (unite ? `${formatNum(v, 0)} ${unite}` : formatNum(v, 0));

/** La largeur de la marge de gauche : celle de la plus longue valeur écrite (corps 9,5 ≈ 5,4 pt par caractère), 0 quand il n'y a pas d'échelle. */
export function largeurGouttiere(maximum: number, unite = ''): number {
  const longueur = Math.max(0, ...graduationsBarres(maximum).map((v) => texteRepere(v, unite).length));
  return longueur === 0 ? 0 : Math.ceil(Math.max(longueur, 1) * 5.4) + 10;
}

export function EchelleBarres({ maximum, unite = '', haut = 0, bas = 0 }: Props) {
  const p = usePalette();
  if (!(maximum > 0)) return null;
  const gouttiere = largeurGouttiere(maximum, unite);
  return (
    <View pointerEvents="none" style={[styles.zone, { top: haut, bottom: bas }]}>
      {[0, ...graduationsBarres(maximum)].map((v) => (
        <View key={v} style={[styles.repere, { bottom: `${Math.min(100, (v / maximum) * 100)}%` }]}>
          <View style={[styles.trait, { left: gouttiere - 2, backgroundColor: p.trait }]} />
          {/* Centrée sur son trait, alignée à droite contre les barres */}
          <Text numberOfLines={1} style={[styles.valeur, { width: gouttiere - 6, color: p.texteMuet, fontFamily: police.texte400 }]}>
            {texteRepere(v, v === 0 ? '' : unite)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: 0, right: 0 },
  repere: { position: 'absolute', left: 0, right: 0, height: 0 },
  trait: { position: 'absolute', right: 0, height: 1 }, // 1 pt comme dans le cumul sur 3 ans : un filet plus fin disparaît sur le fond
  valeur: { position: 'absolute', left: 0, bottom: -6, textAlign: 'right', fontSize: 9.5, lineHeight: 12, fontVariant: ['tabular-nums'] },
});
