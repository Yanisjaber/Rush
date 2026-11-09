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

const RUBRIQUES: { titre: string; cles: string[] }[] = [
  { titre: 'EFFORT', cles: ['charge', 'rpe'] },
  { titre: 'RYTHME', cles: ['allure', 'vitesse', 'cadence'] },
  { titre: 'CŒUR', cles: ['fc'] },
  { titre: 'RELIEF', cles: ['denivele'] },
  { titre: 'ÉNERGIE', cles: ['watts', 'energie'] },
];

export function PageDetailsSortie({ chiffres, ecarte, altitude, couleur, children }: Props) {
  const p = usePalette();
  const parCle = (cle: string) => chiffres.find((c) => c.cle === cle);
  const principaux = ['distance', 'duree'].map(parCle).filter((c): c is ChiffreSeance => !!c);
  return (
    <>
      {principaux.length ? (
        <View style={styles.principaux}>
          {principaux.map((c) => (
            <View key={c.cle} accessible accessibilityLabel={`${c.libelle} ${c.valeur} ${c.unite ?? ''}`}>
              <Text style={[typo.micro, { color: p.texteDoux }]}>{c.libelle.toUpperCase()}</Text>
              <Text style={[styles.grand, { color: p.texte }]}>
                {c.valeur}
                {c.unite ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {c.unite}</Text> : null}
              </Text>
              {c.note ? <Text style={[typo.petit, { color: p.texteDoux }]}>{c.note}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {RUBRIQUES.map((r) => {
        const tuiles = r.cles.map(parCle).filter((c): c is ChiffreSeance => !!c);
        const reliefExtra = r.titre === 'RELIEF' && altitude;
        if (!tuiles.length && !reliefExtra) return null;
        return (
          <View key={r.titre} style={[styles.carte, { backgroundColor: p.surface }]}>
            <Text style={[typo.micro, { color: p.texteDoux }]}>{r.titre}</Text>
            <View style={styles.grille}>
              {tuiles.map((c) => (
                <View key={c.cle} style={styles.tuile}>
                  <StatCle etiquette={c.libelle} valeur={c.valeur} unite={c.unite} note={c.note} petit ecarte={ecarte(c.cle)} />
                </View>
              ))}
              {reliefExtra ? (
                <>
                  <View style={styles.tuile}>
                    <StatCle etiquette="Point le plus haut" valeur={String(Math.round(altitude.max))} unite="m" petit />
                  </View>
                  <View style={styles.tuile}>
                    <StatCle etiquette="Point le plus bas" valeur={String(Math.round(altitude.min))} unite="m" petit />
                  </View>
                </>
              ) : null}
            </View>
            {/* Jauge de l'effort ressenti : dix segments, remplis jusqu'à la note */}
            {r.titre === 'EFFORT' && parCle('rpe') ? <JaugeRpe note={Number(parCle('rpe')!.valeur)} couleur={couleur} /> : null}
          </View>
        );
      })}
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
  principaux: { flexDirection: 'row', gap: espace.e5, paddingHorizontal: 2 },
  grand: { fontFamily: police.titre700, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] },
  carte: { borderRadius: rayon.base, padding: espace.e3, gap: espace.e2 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espace.e3 },
  tuile: { width: '50%', paddingRight: espace.e2 },
  jauge: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
});
