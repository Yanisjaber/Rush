import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { lisse, type Point } from '@/data/courbes';
import { usePalette } from '@/theme/usePalette';

// Barres empilées par période (par exemple la charge par sport et par semaine).
// series : [{ nom, couleur, valeurs }] · etiquettes : un libellé par période
// ligne (facultatif) : une série de valeurs tracée par-dessus, en trait clair (par ex. la condition).
// Port de components/charts/BarresEmpilees.svelte.
export interface SerieBarres {
  nom: string;
  couleur: string;
  valeurs: number[];
}
interface Props {
  series: SerieBarres[];
  etiquettes: string[];
  ligne?: number[];
  hauteur?: number;
  /** Phrase lue par VoiceOver à la place du dessin. */
  etiquette: string;
}

const ECART = 10;

export function BarresEmpilees({ series, etiquettes, ligne = [], hauteur = 200, etiquette }: Props) {
  const p = usePalette();
  const [largeur, setLargeur] = useState(0);
  const nb = etiquettes.length || (series[0] ? series[0].valeurs.length : 0);
  const totaux = Array.from({ length: nb }, (_, i) => series.reduce((s, serie) => s + (serie.valeurs[i] || 0), 0));
  const plafond = Math.max(1, ...totaux) * 1.1;

  // Courbe en superposition, en pixels : chaque point est au centre de sa colonne
  let trace = '';
  if (ligne.length && largeur && nb > 0) { // sans colonne, la largeur d'une colonne serait « … / 0 » : le tracé recevrait NaN et Infinity
    const haut = Math.max(...ligne);
    const colonne = (largeur - ECART * (nb - 1)) / nb;
    const pts: Point[] = ligne.map((v, i) => [i * (colonne + ECART) + colonne / 2, ((100 - (v / (haut * 1.15)) * 100 * 0.78 - 4) / 100) * hauteur]);
    trace = lisse(pts, 0.2);
  }

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={etiquette}>
      <View style={[styles.zone, { height: hauteur, borderBottomColor: p.trait }]} onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
        <View style={styles.barres}>
          {Array.from({ length: nb }, (_, i) => (
            <View key={i} style={[styles.colonne, { opacity: i === nb - 1 ? 1 : 0.55 }]}>
              {series.map((serie, k) => (
                <View
                  key={serie.nom}
                  style={{
                    height: `${((serie.valeurs[i] || 0) / plafond) * 100}%`,
                    backgroundColor: serie.couleur,
                    marginTop: 2,
                    ...(k === series.length - 1 ? { borderTopLeftRadius: 6, borderTopRightRadius: 6 } : null),
                  }}
                />
              ))}
            </View>
          ))}
        </View>
        {trace && largeur ? (
          <Svg width={largeur} height={hauteur} style={styles.courbe} pointerEvents="none">
            <Path d={trace} fill="none" stroke={p.texte} strokeWidth={3} strokeLinecap="round" />
          </Svg>
        ) : null}
      </View>
      {etiquettes.length ? (
        <View style={styles.axe}>
          {etiquettes.map((e, i) => {
            const derniere = i === nb - 1;
            // une étiquette sur deux est masquée pour éviter qu'elles se chevauchent (sauf la dernière)
            const cachee = !derniere && i % 2 === 0;
            return (
              // La colonne fait ~21 pt, l'étiquette ~30 : on la centre dans une boîte plus large qui déborde de chaque côté
              <View key={i} style={styles.casier} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text
                  numberOfLines={1}
                  ellipsizeMode="clip"
                  style={[styles.etiquette, { color: derniere ? p.texte : p.texteDoux, fontWeight: derniere ? '700' : '400', opacity: cachee ? 0 : 1 }]}
                >
                  {e}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { borderBottomWidth: StyleSheet.hairlineWidth },
  barres: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: ECART },
  colonne: { flex: 1, minWidth: 0, height: '100%', flexDirection: 'column-reverse' },
  courbe: { position: 'absolute', top: 0, left: 0 },
  axe: { flexDirection: 'row', gap: ECART, marginTop: 8 },
  // Le casier a la largeur de la colonne ; l'étiquette (plus large) est centrée dessus, à cheval sur les colonnes voisines
  casier: { flex: 1, minWidth: 0, height: 16 },
  etiquette: { position: 'absolute', top: 0, left: '50%', width: 44, marginLeft: -22, textAlign: 'center', fontSize: 12 },
});
