import { StyleSheet, Text, View } from 'react-native';
import { BarresEmpilees } from '@/components/BarresEmpilees';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatHeuresMinutes } from '@/data/format';
import { minutesParSemaineTypes, mixEntrainement, type TypeEntrainement } from '@/data/crossfit';
import type { WidgetProps } from '@/data/types';
import type { Palette } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le mix de ton entraînement : WOD (CrossFit, HIIT), force (musculation) et endurance (course, vélo, natation, aviron), sur 4 semaines.
//  - XS : les trois parts en % ; S : + la barre ; M : + le temps de chacun ; L : + le temps de chaque semaine, empilé, sur 8 semaines.
const NOM: Record<TypeEntrainement, string> = { wod: 'WOD', force: 'Force', endurance: 'Endurance' };
const COURT: Record<TypeEntrainement, string> = { wod: 'WOD', force: 'Force', endurance: 'Endu.' };
const couleurDe = (p: Palette, t: TypeEntrainement) => (t === 'wod' ? p.sportHybride : t === 'force' ? p.sportMuscu : p.sportVelo);

export function WidgetCfMix({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const mix = mixEntrainement(contexte.toutesSeances);

  const barre = mix ? (
    <View accessible accessibilityRole="image" accessibilityLabel={`Mix d'entraînement : ${mix.parts.map((x) => `${NOM[x.cle]} ${x.pct} %`).join(', ')}`} style={styles.barre}>
      {mix.parts.map((x) => (x.temps > 0 ? <View key={x.cle} style={{ flex: x.temps, backgroundColor: couleurDe(p, x.cle) }} /> : null))}
    </View>
  ) : null;

  if (taille !== 'l') {
    return (
      <Tuile titre="Mix d'entraînement" valeur={mix ? mix.parts.map((x) => x.pct).join(' · ') : '—'} unite={mix ? '%' : ''} note={mix ? mix.parts.map((x) => COURT[x.cle]).join(' · ') : 'Pas encore de séance'} large>
        {!mix ? null : taille === 's' ? (
          barre
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre}
            <ListeCompacte lignes={mix.parts.map((x) => ({ cle: x.cle, nom: NOM[x.cle], valeur: formatHeuresMinutes(x.temps), point: couleurDe(p, x.cle) }))} />
          </View>
        ) : null}
      </Tuile>
    );
  }

  const semaines = minutesParSemaineTypes(contexte.toutesSeances, 8);
  return (
    <CadreWidget titre="Mix d'entraînement">
      {mix ? (
        <>
          <Text style={[styles.total, { color: p.texte }]}>
            {formatHeuresMinutes(mix.total)}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> sur 4 semaines</Text>
          </Text>
          {barre}
          <View style={styles.parts}>
            {mix.parts.map((x) => (
              <View key={x.cle} accessible accessibilityLabel={`${NOM[x.cle]}, ${formatHeuresMinutes(x.temps)}, ${x.pct} %`} style={styles.part}>
                <View style={[styles.carre, { backgroundColor: couleurDe(p, x.cle) }]} />
                <View>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>{NOM[x.cle]}</Text>
                  <Text style={[styles.pct, { color: p.texte }]}>{x.pct} %</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>{formatHeuresMinutes(x.temps)}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte, marginTop: 16, marginBottom: 6 }]}>
            Semaine après semaine
          </Text>
          <BarresEmpilees
            series={semaines.map((s) => ({ nom: NOM[s.cle], couleur: couleurDe(p, s.cle), valeurs: s.minutes }))}
            etiquettes={[]}
            hauteur={110}
            etiquette="Temps par semaine et par type d'entraînement sur 8 semaines : WOD, force, endurance"
          />
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>WOD : CrossFit et HIIT. Force : musculation. Endurance : course, vélo, natation, aviron.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de séance sur les 4 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 },
  total: { fontFamily: police.titre700, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'], marginBottom: 10 },
  parts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  part: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  carre: { width: 10, height: 10, borderRadius: 2, marginTop: 5 },
  pct: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
