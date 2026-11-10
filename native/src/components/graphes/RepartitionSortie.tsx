import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Rect, Text as TexteSvg } from 'react-native-svg';
import { SelecteurSegments } from '@/components/ui/SelecteurSegments';
import { formatDureePrecise } from '@/data/outils/format';
import type { MesureZones } from '@/data/outils/repartition-zones';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le temps passé dans chaque zone pendant la sortie : un histogramme (une colonne par zone, les bornes dessous) et trois onglets Cœur / Puissance / Allure (le contrôle segmenté natif sur iPhone).
// Seules les mesures qu'on sait calculer (flux présents ET référence dans le profil) ont un onglet. Les zones sont recalculées depuis le profil, jamais stockées.
interface Props {
  mesures: MesureZones[];
  /** La couleur du sport : chaque zone en est une teinte, de plus en plus soutenue. */
  couleur: string;
}

const HAUT = 150;
const BAS = 40; // la place des noms de zone et de leurs bornes sous les colonnes
const HAUT_LABEL = 16; // la place du temps au-dessus de la colonne la plus haute

/** 45 → « 45" » ; 860 → « 14'20" » ; 5400 → « 1h30 ». */
const texteTemps = (s: number): string => (s < 1 ? '0' : formatDureePrecise(s));

export function RepartitionSortie({ mesures, couleur }: Props) {
  const p = usePalette();
  const [choix, setChoix] = useState(mesures[0]?.cle);
  const [largeur, setLargeur] = useState(0);
  if (!mesures.length) return null;
  const mesure = mesures.find((m) => m.cle === choix) ?? mesures[0];
  const n = mesure.zones.length;
  const manque = mesure.manque;
  const total = mesure.zones.reduce((a, z) => a + z.secondes, 0);
  const max = Math.max(0, ...mesure.zones.map((z) => z.secondes));
  const dominante = mesure.zones.findIndex((z) => z.secondes === max);
  // Les teintes : celles des bandes derrière les courbes (la couleur du sport, de plus en plus soutenue de la zone 1 à la dernière), pour que la légende soit la même partout
  const teinte = (i: number) => {
    const alpha = Math.round((0.25 + (i * 0.75) / Math.max(1, n - 1)) * 255).toString(16).padStart(2, '0');
    return couleur + alpha;
  };
  const pas = largeur > 0 ? (largeur - 2 * espace.e3) / n : 0;
  const colonne = Math.min(40, pas * 0.74);

  return (
    <View style={{ gap: espace.e2 }}>
      {mesures.length > 1 ? <SelecteurSegments options={mesures.map((m) => ({ cle: m.cle, libelle: m.titre }))} choix={mesure.cle} onChoix={(c) => setChoix(c as MesureZones['cle'])} /> : null}
      <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} style={[styles.carte, { backgroundColor: p.surface }]}>
        {manque ? (
          <>
            <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2, paddingHorizontal: espace.e3 }]}>{`TEMPS PAR ZONE · ${mesure.titre.toUpperCase()}`}</Text>
            <Text style={[typo.corps, { color: p.texteDoux, paddingHorizontal: espace.e3 }]}>{manque}</Text>
          </>
        ) : null}
        {manque ? null : <View style={styles.titre}>
          <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2 }]}>{`TEMPS PAR ZONE · ${mesure.titre.toUpperCase()} (${mesure.unite})`}</Text>
        </View>}
        {manque ? null : largeur > 0 ? (
          <Svg width={largeur} height={HAUT + BAS} accessible accessibilityLabel={`Temps par zone, ${mesure.titre}. Zone dominante ${mesure.zones[dominante].court}, ${Math.round((100 * max) / total)} pour cent.`}>
            {mesure.zones.map((z, i) => {
              const x = espace.e3 + i * pas + (pas - colonne) / 2;
              const h = max > 0 ? Math.max(3, ((HAUT - HAUT_LABEL) * z.secondes) / max) : 3;
              const centre = x + colonne / 2;
              return (
                <G key={z.court}>
                  <Rect x={x} y={HAUT - h} width={colonne} height={h} rx={5} fill={z.secondes > 0 ? teinte(i) : p.trait} />
                  <TexteSvg x={centre} y={HAUT - h - 5} textAnchor="middle" fontSize={11} fontFamily={police.texte600} fill={p.texte}>
                    {texteTemps(z.secondes)}
                  </TexteSvg>
                  <TexteSvg x={centre} y={HAUT + 15} textAnchor="middle" fontSize={12} fontFamily={police.texte600} fill={i === dominante ? p.texte : p.texteDoux}>
                    {z.court}
                  </TexteSvg>
                  <TexteSvg x={centre} y={HAUT + 29} textAnchor="middle" fontSize={9} fontFamily={police.texte400} fill={p.texteMuet}>
                    {z.borne}
                  </TexteSvg>
                </G>
              );
            })}
          </Svg>
        ) : (
          <View style={{ height: HAUT + BAS }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: rayon.base, paddingVertical: espace.e3, paddingHorizontal: 0, gap: espace.e2 },
  titre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: espace.e3, gap: espace.e2 },
});
