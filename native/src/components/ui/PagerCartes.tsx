import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { usePalette } from '@/theme/usePalette';

// Des cartes qu'on fait glisser de côté, avec des points en bas. La hauteur suit la carte affichée : une carte courte ne laisse pas un grand vide
// (chaque carte mesure sa propre hauteur, le cadre prend celle de la carte visible).
interface Props {
  /** Le contenu d'une carte, ou une fonction qui reçoit `aller` pour qu'un lien de la carte mène à une autre carte. */
  pages: { nom: string; contenu: ReactNode | ((aller: (i: number) => void) => ReactNode) }[];
  /** Phrase lue par VoiceOver pour le groupe de cartes. */
  etiquette: string;
}

export function PagerCartes({ pages, etiquette }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const [index, setIndex] = useState(0);
  const [hauteurs, setHauteurs] = useState<number[]>([]);
  const defilement = useRef<ComponentRef<typeof ScrollView>>(null);

  const fini = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (largeur > 0) setIndex(Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / largeur))));
  };
  const aller = (i: number): void => {
    defilement.current?.scrollTo({ x: i * largeur, animated: true });
    setIndex(i);
  };

  return (
    <View accessibilityLabel={etiquette} onLayout={(e) => setLargeur(Math.round(e.nativeEvent.layout.width))}>
      {largeur > 0 ? (
        <ScrollView
          ref={defilement}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={fini}
          style={hauteurs[index] ? { height: hauteurs[index] } : undefined}
          contentContainerStyle={styles.contenu}
        >
          {pages.map((page, i) => (
            <View
              key={page.nom}
              style={{ width: largeur }}
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                setHauteurs((avant) => (avant[i] === h ? avant : Object.assign([...avant], { [i]: h })));
              }}
            >
              {typeof page.contenu === 'function' ? page.contenu(aller) : page.contenu}
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.points} accessibilityRole="tablist">
        {pages.map((page, i) => (
          <Pressable
            key={page.nom}
            onPress={() => aller(i)}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === index }}
            accessibilityLabel={`Carte ${i + 1} sur ${pages.length} : ${page.nom}`}
            hitSlop={8}
            style={styles.zone}
          >
            <View style={[styles.point, { backgroundColor: i === index ? p.texte : p.trait }]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: { alignItems: 'flex-start' },
  points: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  zone: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  point: { width: 8, height: 8, borderRadius: 4 },
});
