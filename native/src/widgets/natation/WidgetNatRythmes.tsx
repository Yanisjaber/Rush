import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { alluresParDistance, type TrancheDistance } from '@/data/sports/natation';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Comment ton allure change avec la distance de la séance (12 dernières semaines) : on nage rarement aussi vite sur 3 km que sur 1 km.
//  - XS : l'allure sur tes séances les plus longues ; S : + les trois tranches côte à côte ; M : + la liste avec le nombre de séances ;
//  - L : une barre par tranche (plus elle est longue, plus tu vas vite) et l'écart entre la plus rapide et la plus lente.
const minSec = (s: number) => `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
const NOM: Record<TrancheDistance, string> = { courte: 'Moins de 1,5 km', moyenne: '1,5 à 2,5 km', longue: '2,5 km et plus' };
const COURT: Record<TrancheDistance, string> = { courte: 'Courte', moyenne: 'Moyenne', longue: 'Longue' };

export function WidgetNatRythmes({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const r = alluresParDistance(contexte.toutesSeances);
  const avec = r.tranches.filter((t) => t.allure != null);
  // La tranche la plus représentative : la plus longue qui a des séances
  const principale = [...avec].reverse()[0] ?? null;
  const rapide = avec.length ? Math.min(...avec.map((t) => t.allure as number)) : 0;
  const lente = avec.length ? Math.max(...avec.map((t) => t.allure as number)) : 0;

  if (taille !== 'l') {
    return (
      <Tuile titre="Allure par distance" valeur={principale ? minSec(principale.allure as number) : '—'} unite={principale ? '/100 m' : ''} note={principale ? `séances de ${NOM[principale.cle].toLowerCase()}` : 'Pas encore de natation'} large>
        {!principale ? null : taille === 's' ? (
          <View style={styles.rangee}>
            {r.tranches.map((t) => (
              <View key={t.cle} accessible accessibilityLabel={`${NOM[t.cle]} : ${t.allure != null ? `${minSec(t.allure)} au 100 mètres` : 'aucune séance'}`} style={styles.colonne}>
                <View style={[styles.trait, { backgroundColor: t.allure != null ? p.sportNatation : p.surface2 }]} />
                <Text style={[typo.micro, { color: p.texteDoux }]}>{COURT[t.cle]}</Text>
                <Text style={[styles.valeurPetite, { color: p.texte }]}>{t.allure != null ? minSec(t.allure) : '—'}</Text>
              </View>
            ))}
          </View>
        ) : taille === 'm' ? (
          <ListeCompacte lignes={r.tranches.map((t) => ({ cle: t.cle, nom: `${NOM[t.cle]} · ${t.seances}`, valeur: t.allure != null ? minSec(t.allure) : '—', point: p.sportNatation }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Allure selon la distance">
      {avec.length ? (
        <>
          <View style={{ gap: 14 }}>
            {r.tranches.map((t) => (
              <View key={t.cle} accessible accessibilityLabel={`${NOM[t.cle]} : ${t.allure != null ? `${minSec(t.allure)} au 100 mètres, ${t.seances} séance${t.seances > 1 ? 's' : ''}` : 'aucune séance'}`} style={{ gap: 4 }}>
                <View style={styles.enteteBarre}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>{NOM[t.cle]}</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>
                    {t.allure != null ? `${minSec(t.allure)} /100 m · ${t.seances} séance${t.seances > 1 ? 's' : ''}` : 'Aucune séance'}
                  </Text>
                </View>
                <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                  {t.allure != null ? <View style={{ width: `${(rapide / t.allure) * 100}%`, height: '100%', backgroundColor: t.cle === r.plusRapide ? p.sportNatation : avecAlpha(p.sportNatation, 0.5), borderRadius: 5 }} /> : null}
                </View>
              </View>
            ))}
          </View>
          {r.plusRapide && r.plusLente ? (
            <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>
              {`Tu es le plus rapide sur les séances « ${NOM[r.plusRapide].toLowerCase()} » et le plus lent sur « ${NOM[r.plusLente].toLowerCase()} » : ${lente - rapide} s de plus au 100 m.`}
            </Text>
          ) : null}
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 6 }]}>Allure moyenne selon la distance de la séance, sur 12 semaines. Plus la barre est longue, plus tu vas vite.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de natation sur les 12 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: 10 },
  colonne: { flex: 1, gap: 2 },
  trait: { height: 6, borderRadius: 3 },
  valeurPetite: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  enteteBarre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
});
