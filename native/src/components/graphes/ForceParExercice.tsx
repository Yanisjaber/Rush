import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CourbeLissee } from '@/components/graphes/CourbeLissee';
import { MenuMesure } from '@/components/menus/MenuMesure';
import { exercicesDuCarnet, rmParTrimestre } from '@/data/bilan/records-muscu';
import { texteRecordSimple } from '@/data/bilan/records-texte';
import type { SerieForce } from '@/data/types';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La courbe de ta force, exercice par exercice : le meilleur 1RM estimé (Epley) de chaque trimestre, pour l'exercice choisi dans le menu. Les mêmes séries que les records : voir data/bilan/records-muscu.ts.
// Un trimestre sans série est sauté (la courbe relie les trimestres qui ont des mesures).
interface Props {
  series: SerieForce[];
  /** L'année choisie en haut du Bilan : la courbe s'arrête à la fin de cette année. */
  annee: number;
}

export function ForceParExercice({ series, annee }: Props) {
  const p = usePalette();
  const couleur = couleurSport(p, 'muscu');
  const [choix, setChoix] = useState<string | null>(null);
  const exercices = useMemo(() => exercicesDuCarnet(series), [series]);
  const exercice = exercices.find((e) => e.cle === choix) ?? exercices[0] ?? null;
  const points = useMemo(() => (exercice ? rmParTrimestre(series, exercice.cle).filter((x) => x.an <= annee) : []), [series, exercice, annee]);
  if (!exercice) return null;

  const premier = points[0];
  const dernier = points[points.length - 1];
  const ecart = premier && dernier && premier.rm > 0 ? Math.round(((dernier.rm - premier.rm) / premier.rm) * 100) : null;
  const nomTrimestre = (cle: string): string => `T${cle.slice(-1)} ${cle.slice(0, 4)}`;

  return (
    <Bloc>
      <View style={styles.entete}>
        <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
          Force par exercice
        </Text>
        <MenuMesure etiquette="Exercice" valeur={exercice.cle} options={exercices.map((e) => ({ cle: e.cle, nom: e.nom }))} onChoisir={(c) => setChoix(c)} />
      </View>
      {points.length >= 2 ? (
        <>
          <Text style={[typo.petit, styles.lecture, { color: p.texteDoux }]}>
            1RM estimé : {texteRecordSimple(premier.rm, 'kg')} en {nomTrimestre(premier.cle)}, {texteRecordSimple(dernier.rm, 'kg')} en {nomTrimestre(dernier.cle)}
            {ecart !== null ? ` (${ecart > 0 ? '+' : ''}${ecart} %)` : ''}
          </Text>
          <CourbeLissee
            valeurs={points.map((x) => x.rm)}
            couleur={couleur}
            hauteur={110}
            etiquette={`1RM estimé au ${exercice.nom}, trimestre après trimestre, en kilos : ${points.map((x) => `${nomTrimestre(x.cle)} ${texteRecordSimple(x.rm, 'kg')}`).join(', ')}.`}
          />
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>
          {points.length === 1 ? `Un seul trimestre mesuré pour l'instant (${nomTrimestre(points[0].cle)} : ${texteRecordSimple(points[0].rm, 'kg')}). La courbe apparaît dès le deuxième.` : 'Pas de série de 1 à 12 répétitions pour cet exercice jusqu\'à cette année.'}
        </Text>
      )}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  lecture: { textAlign: 'center', marginBottom: 6 },
});
