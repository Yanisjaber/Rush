import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PeriodeEvolution } from '@/data/bilan/records';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'évolution d'un record : une barre par période (mois ou année), le meilleur de la période. On touche une barre pour lire sa valeur ; au départ, le sommet.
// La hauteur ne part pas de zéro : entre 255 W et 281 W, des barres depuis zéro auraient l'air identiques.
const HAUTEUR = 96;
const HAUTEUR_MIN = 14;

interface Props {
  periodes: PeriodeEvolution[];
  couleur: string;
  /** La valeur écrite avec son unité (« 6h03 », « 156,5 km »). */
  formater: (v: number) => string;
  etiquette: string;
}

export function BarresEvolution({ periodes, couleur, formater, etiquette }: Props) {
  const p = usePalette();
  const [choisie, setChoisie] = useState<number | null>(null);
  const valeurs = periodes.map((x) => x.valeur).filter((v): v is number => v !== null);
  if (!valeurs.length) return <Text style={[typo.petit, { color: p.texteDoux }]}>Rien à montrer sur cette période.</Text>;
  const haut = Math.max(...valeurs);
  const bas = Math.min(...valeurs) * 0.8;
  let sommet = periodes.findIndex((x) => x.valeur === haut);
  if (sommet < 0) sommet = 0;
  const actuelle = choisie !== null && periodes[choisie]?.valeur != null ? choisie : sommet;
  const lue = periodes[actuelle];
  const hauteurDe = (v: number): number => HAUTEUR_MIN + (haut > bas ? ((v - bas) / (haut - bas)) * (HAUTEUR - HAUTEUR_MIN) : HAUTEUR - HAUTEUR_MIN);

  return (
    <View accessible={false}>
      <Text accessibilityLiveRegion="polite" style={[typo.petit, styles.lecture, { color: p.texteDoux }]}>
        {lue.nom} : <Text style={[typo.corpsFort, { color: p.texte }]}>{lue.valeur != null ? formater(lue.valeur) : 'rien'}</Text>
        {actuelle === sommet ? ' · le sommet' : ''}
      </Text>
      <View accessibilityLabel={etiquette} style={styles.colonnes}>
        {periodes.map((x, i) => (
          <Pressable
            key={x.cle}
            onPress={() => x.valeur != null && setChoisie(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: i === actuelle }}
            accessibilityLabel={x.valeur != null ? `${x.nom}, ${formater(x.valeur)}` : `${x.nom}, rien`}
            style={styles.zone}
          >
            <View style={{ height: x.valeur != null ? hauteurDe(x.valeur) : 3, backgroundColor: couleur, opacity: x.valeur == null ? 0.25 : i === actuelle ? 1 : 0.55, borderRadius: 4 }} />
          </Pressable>
        ))}
      </View>
      <View style={styles.axe}>
        {periodes.map((x, i) => (
          <Text key={x.cle} numberOfLines={1} style={[styles.libelle, { color: i === actuelle ? p.texte : p.texteMuet }]}>
            {x.libelle}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lecture: { marginBottom: 6 },
  colonnes: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: HAUTEUR + 8 },
  zone: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  axe: { flexDirection: 'row', gap: 4, marginTop: 4 },
  libelle: { flex: 1, textAlign: 'center', fontFamily: police.texte600, fontSize: 10 },
});
