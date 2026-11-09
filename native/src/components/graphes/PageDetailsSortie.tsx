import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatCle } from '@/components/ui/StatCle';
import type { ChiffreSeance } from '@/data/calendrier/seance-detail';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page 2 d'une sortie (sans carte) : toutes les infos rangées par rubriques (Effort, Rythme, Cœur, Relief, Énergie), puis le reste (tours, notes, « compte dans mes calculs ») en `children`.
// Une rubrique sans aucun chiffre n'est pas affichée. Pas de chiffre inventé : tout vient de la sortie.
interface Props {
  chiffres: ChiffreSeance[];
  /** La donnée est écartée des calculs (chiffre barré). */
  ecarte: (cle: string) => boolean;
  altitude: { min: number; max: number } | null;
  couleur: string;
  children?: ReactNode;
}

interface Tuile {
  cle: string;
  libelle: string;
  valeur: string;
  unite?: string;
  ecarte?: boolean;
}

export function PageDetailsSortie({ chiffres, ecarte, altitude, couleur, children }: Props) {
  const p = usePalette();
  const parCle = (cle: string) => chiffres.find((c) => c.cle === cle);
  const tuile = (cle: string, libelle?: string): Tuile[] => {
    const c = parCle(cle);
    return c ? [{ cle, libelle: libelle ?? c.libelle, valeur: c.valeur, unite: c.unite, ecarte: ecarte(cle) }] : [];
  };
  const principaux = ['distance', 'duree'].map(parCle).filter((c): c is ChiffreSeance => !!c);
  // Le cardio max est la note du chiffre « Cardio moyen » (« max 181 ») : on en fait une tuile à part
  const fc = parCle('fc');
  const fcMax = /\d+/.exec(fc?.note ?? '')?.[0];
  const rubriques: { titre: string; tuiles: Tuile[] }[] = [
    { titre: 'EFFORT', tuiles: [...tuile('charge'), ...tuile('rpe', 'Effort ressenti')] },
    { titre: 'CŒUR', tuiles: [...tuile('fc', 'FC moyenne'), ...(fcMax ? [{ cle: 'fcmax', libelle: 'FC max', valeur: fcMax, unite: 'bpm' }] : [])] },
    { titre: 'RYTHME', tuiles: [...tuile('allure'), ...tuile('vitesse'), ...tuile('cadence')] },
    {
      titre: 'RELIEF',
      tuiles: [
        ...tuile('denivele', 'Dénivelé +'),
        ...(altitude ? [{ cle: 'haut', libelle: 'Plus haut', valeur: String(Math.round(altitude.max)), unite: 'm' }, { cle: 'bas', libelle: 'Plus bas', valeur: String(Math.round(altitude.min)), unite: 'm' }] : []),
      ],
    },
    { titre: 'ÉNERGIE', tuiles: [...tuile('watts'), ...tuile('energie')] },
  ];
  return (
    <>
      {principaux.length ? (
        <View style={styles.principaux}>
          {principaux.map((c) => (
            <View key={c.cle} accessible accessibilityLabel={`${c.libelle} ${c.valeur} ${c.unite ?? ''}`}>
              <Text style={[styles.grand, { color: p.texte }]}>
                {c.valeur}
                {c.unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {c.unite}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {rubriques.map((r) =>
        r.tuiles.length ? (
          <View key={r.titre} style={{ gap: espace.e2 }}>
            <Text style={[typo.micro, { color: p.texteDoux, letterSpacing: 1.2 }]}>{r.titre}</Text>
            <View style={styles.grille}>
              {r.tuiles.map((c) => (
                <View key={c.cle} style={[styles.tuile, { backgroundColor: p.surface }]}>
                  <StatCle etiquette={c.libelle} valeur={c.valeur} unite={c.unite} petit ecarte={c.ecarte} />
                </View>
              ))}
            </View>
            {/* Jauge de l'effort ressenti : dix segments, remplis jusqu'à la note */}
            {r.titre === 'EFFORT' && parCle('rpe') ? <JaugeRpe note={Number(parCle('rpe')!.valeur)} couleur={couleur} /> : null}
          </View>
        ) : null,
      )}
      {children}
    </>
  );
}

function JaugeRpe({ note, couleur }: { note: number; couleur: string }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={`Effort ressenti ${note} sur 10`} style={styles.jauge}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < note ? couleur : p.traitFort }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  principaux: { flexDirection: 'row', alignItems: 'baseline', gap: espace.e5, paddingHorizontal: 2 },
  grand: { fontFamily: police.titre700, fontSize: 34, lineHeight: 40, fontVariant: ['tabular-nums'] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.e2 },
  tuile: { flexGrow: 1, flexBasis: '30%', borderRadius: rayon.base, paddingVertical: 8, paddingHorizontal: espace.e3 },
  jauge: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
});
