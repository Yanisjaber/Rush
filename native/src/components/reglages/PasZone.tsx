import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le réglage du début d'une zone : une flèche − et une flèche + (qui répètent quand on les garde appuyées, de plus en plus vite), et la valeur au milieu,
// qu'on peut aussi taper au clavier pour aller loin d'un coup. Aucune limite autre que l'ordre des zones, que l'écran garde.
interface Props {
  /** La valeur affichée (« 153 », « 5:30 »). */
  texte: string;
  nom: string;
  unite: string;
  /** Un cran vers le haut (+1) ou le bas (−1). `n` = nombre de crans quand la flèche répète. */
  onPas: (sens: 1 | -1, n: number) => void;
  /** Une valeur tapée ; renvoie false si elle est illisible. */
  onSaisie: (texte: string) => boolean;
  /** Mots pour les lecteurs d'écran, par exemple « plus lent » / « plus rapide » pour l'allure. */
  moins: string;
  plus: string;
}

function Fleche({ signe, sens, label, onPas }: { signe: string; sens: 1 | -1; label: string; onPas: Props['onPas'] }) {
  const p = usePalette();
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repete = useRef(false);
  const compte = useRef(0);
  const surPas = useRef(onPas);
  surPas.current = onPas;
  const arreter = () => {
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
  };
  useEffect(() => arreter, []);
  const boucle = () => {
    compte.current += 1;
    // De plus en plus vite : 1 cran, puis 2, puis 5, puis 10 par tic
    const n = compte.current > 30 ? 10 : compte.current > 15 ? 5 : compte.current > 6 ? 2 : 1;
    surPas.current(sens, n);
    minuterie.current = setTimeout(boucle, 90);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        repete.current = false;
        compte.current = 0;
        arreter();
        minuterie.current = setTimeout(() => {
          repete.current = true;
          boucle();
        }, 450);
      }}
      onPressOut={arreter}
      onPress={() => {
        if (!repete.current) onPas(sens, 1);
      }}
      style={({ pressed }) => [styles.fleche, { borderColor: p.traitFort, backgroundColor: pressed ? p.surface2 : 'transparent' }]}
    >
      <Text style={[typo.titre3, { color: p.texte }]}>{signe}</Text>
    </Pressable>
  );
}

export function PasZone({ texte, nom, unite, onPas, onSaisie, moins, plus }: Props) {
  const p = usePalette();
  const [saisie, setSaisie] = useState<string | null>(null);
  const valider = () => {
    if (saisie !== null && saisie.trim() !== '') onSaisie(saisie);
    setSaisie(null);
  };
  return (
    <View style={styles.pas}>
      <Fleche signe="−" sens={-1} label={`${nom} : début ${moins}`} onPas={onPas} />
      <TextInput
        value={saisie ?? texte}
        onFocus={() => setSaisie(texte)}
        onChangeText={setSaisie}
        onBlur={valider}
        onSubmitEditing={valider}
        selectTextOnFocus
        keyboardType={unite === '/km' ? 'numbers-and-punctuation' : 'number-pad'}
        returnKeyType="done"
        accessibilityLabel={`${nom} : début, en ${unite}. Tape une valeur.`}
        style={[styles.champ, { color: p.texte, borderColor: p.traitFort }]}
      />
      <Fleche signe="+" sens={1} label={`${nom} : début ${plus}`} onPas={onPas} />
    </View>
  );
}

const styles = StyleSheet.create({
  pas: { flexDirection: 'row', alignItems: 'center', gap: espace.e1 },
  fleche: { width: 44, height: 44, borderRadius: rayon.rond, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  champ: { width: 64, height: 44, borderRadius: rayon.rond, borderWidth: 1, textAlign: 'center', fontFamily: police.texte600, fontSize: 16, fontVariant: ['tabular-nums'] },
});
