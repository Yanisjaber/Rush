import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { CourbeLissee } from '@/components/CourbeLissee';
import { ListeCompacte } from '@/components/ListeCompacte';
import { MiniBarres } from '@/components/MiniBarres';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import { formatDateCourte } from '@/data/outils/format';
import { ecrireTemps, formatEcart } from '@/data/sports/hyrox';
import { deriveParTest, deriveRuns } from '@/data/sports/hyrox-suivi';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// De combien tu ralentis sur les runs : les 2 derniers kilomètres comparés aux 2 premiers. Plus c'est bas, mieux tu tiens ta course.
//  - XS : la dérive en % ; S : + l'écart de chaque run au plus rapide, en barres ; M : + la courbe des 8 runs et les deux repères ;
//  - L : + les trois chiffres et la dérive de tes derniers tests, pour voir si tu la réduis.
const pourcent = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toString().replace('.', ',')} %`;

export function WidgetHyroxDerive({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const tests = contexte.hyrox.tests;
  const d = deriveRuns(tests[0] ?? null);
  const note = d ? `${d.ecart >= 0 ? '+' : '−'}${Math.abs(d.ecart)} s par km en fin de course` : 'Pas de test complet';

  if (taille !== 'l') {
    const plusRapide = d ? Math.min(...d.runs) : 0;
    return (
      <Tuile titre="Dérive des runs" valeur={d ? pourcent(d.pct) : '—'} note={note} large>
        {!d ? null : taille === 's' ? (
          <MiniBarres valeurs={d.runs.map((r) => r - plusRapide)} couleur={p.sportHybride} etiquette="Écart de chacun des 8 runs au plus rapide du dernier test" />
        ) : taille === 'm' ? (
          <View style={{ gap: 6 }}>
            <CourbeLissee valeurs={d.runs} couleur={p.sportHybride} largeur={220} hauteur={60} etiquette={`Temps des 8 runs, de ${ecrireTemps(d.runs[0])} à ${ecrireTemps(d.runs[7])}`} />
            <ListeCompacte
              lignes={[
                { cle: 'debut', nom: 'Début (runs 1-2)', valeur: ecrireTemps(d.debut) },
                { cle: 'fin', nom: 'Fin (runs 7-8)', valeur: ecrireTemps(d.fin) },
              ]}
            />
          </View>
        ) : null}
      </Tuile>
    );
  }

  const parTest = deriveParTest(tests);
  const recents = [...parTest].reverse().slice(0, 5);
  return (
    <CadreWidget titre="Dérive des runs">
      {d ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>{pourcent(d.pct)}</Text>
            <View style={[styles.badge, { backgroundColor: d.pct <= 0 ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
              <Text style={[typo.petit, styles.badgeTexte, { color: d.pct <= 0 ? p.ok : p.texteDoux }]}>{d.pct <= 0 ? 'Tu accélères' : 'Tu ralentis'}</Text>
            </View>
          </View>
          <CourbeLissee valeurs={d.runs} couleur={p.sportHybride} hauteur={92} etiquette={`Temps des 8 runs, de ${ecrireTemps(d.runs[0])} à ${ecrireTemps(d.runs[7])}`} />
          <View style={styles.reperes}>
            <StatCle etiquette="Début" valeur={ecrireTemps(d.debut)} petit />
            <StatCle etiquette="Fin" valeur={ecrireTemps(d.fin)} petit />
            <StatCle etiquette="Écart" valeur={formatEcart(d.ecart)} unite="/km" petit />
          </View>
          {recents.length > 1 ? (
            <View style={{ marginTop: 12 }}>
              <ListeCompacte lignes={recents.map((t, i) => ({ cle: t.id, nom: formatDateCourte(t.date), valeur: pourcent(t.derive.pct), couleur: i === 0 ? undefined : p.texteDoux }))} />
            </View>
          ) : null}
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Les 2 derniers kilomètres comparés aux 2 premiers, sur le dernier test. En dessous, la dérive de tes tests : plus elle baisse, mieux tu tiens.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Il faut un test avec ses 8 runs pour mesurer ta dérive. Enregistre une simulation ou une course Hyrox.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  reperes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
});
