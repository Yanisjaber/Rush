import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatAllure, formatAllure100m } from '@/data/format';
import { disciplinesDe, reperesDisciplines, type Repere } from '@/data/triathlon';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { couleurDiscipline, NOM_COURT, NOM_DISCIPLINE } from './disciplines';

// Un repère de niveau par discipline : l'allure en natation (au 100 m), les watts de 20 minutes à vélo (à défaut la vitesse), l'allure en course.
//  - XS : les repères sur une ligne ; S : + leur évolution ; M : + la liste ; L : chaque repère en grand, avec son évolution et ce qu'elle compare.
const sansUnite = (t: string) => t.replace('/100 m', '').replace('/km', '');
function valeurDe(r: Repere): string {
  if (r.cle === 'natation') return r.valeur ? sansUnite(formatAllure100m(r.valeur)) : '—';
  if (r.cle === 'velo') return r.valeur ? `${r.valeur} W` : r.vitesseKmh ? `${String(r.vitesseKmh).replace('.', ',')} km/h` : '—';
  return r.valeur ? sansUnite(formatAllure(r.valeur)) : '—';
}
const uniteDe = (r: Repere) => (r.cle === 'natation' ? '/100 m' : r.cle === 'course' ? '/km' : r.valeur ? '(20 min)' : '');
/** L'évolution : négatif = plus rapide pour la natation et la course (vert) ; à vélo, la part du record. */
function tendance(r: Repere): { texte: string; bon: boolean | null } {
  if (r.cle === 'velo') return r.valeur && r.record ? { texte: `${Math.round((r.valeur / r.record) * 100)} % du record`, bon: null } : { texte: '', bon: null };
  if (r.evolutionPct == null) return { texte: '', bon: null };
  return { texte: `${r.evolutionPct > 0 ? '+' : ''}${String(r.evolutionPct).replace('.', ',')} %`, bon: r.evolutionPct < 0 };
}

export function WidgetTriReperes({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const disciplines = disciplinesDe(contexte.filtre);
  const reperes = reperesDisciplines(contexte.toutesSeances, contexte.puissance, disciplines);
  const aucun = reperes.every((r) => !r.valeur && !r.vitesseKmh);

  if (taille !== 'l') {
    return (
      <Tuile titre="Repères" valeur={aucun ? '—' : reperes.map(valeurDe).join(' · ')} note={aucun ? 'Pas encore de séance' : disciplines.map((d) => NOM_COURT[d]).join(' · ')} large>
        {aucun ? null : taille === 's' ? (
          <View style={styles.rangee}>
            {reperes.map((r) => {
              const t = tendance(r);
              return (
                <View key={r.cle} accessible accessibilityLabel={`${NOM_DISCIPLINE[r.cle]} : ${valeurDe(r)}${t.texte ? `, ${t.texte}` : ''}`} style={styles.colonne}>
                  <View style={[styles.trait, { backgroundColor: couleurDiscipline(p, r.cle) }]} />
                  <Text style={[styles.tendance, { color: t.bon === true ? p.ok : t.bon === false ? p.alerte : p.texteDoux }]}>{t.texte || '—'}</Text>
                </View>
              );
            })}
          </View>
        ) : taille === 'm' ? (
          <ListeCompacte lignes={reperes.map((r) => ({ cle: r.cle, nom: NOM_DISCIPLINE[r.cle], valeur: `${valeurDe(r)}${uniteDe(r) && r.cle !== 'velo' ? uniteDe(r) : ''}`, point: couleurDiscipline(p, r.cle) }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Repères par discipline">
      {aucun ? (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de séance sur les 4 dernières semaines.</Text>
      ) : (
        <>
          {reperes.map((r, i) => {
            const t = tendance(r);
            return (
              <View
                key={r.cle}
                accessible
                accessibilityLabel={`${NOM_DISCIPLINE[r.cle]} : ${valeurDe(r)} ${uniteDe(r)}${t.texte ? `, ${t.texte}` : ''}`}
                style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }, i === 0 && { paddingTop: 0 }]}
              >
                <View style={[styles.barre, { backgroundColor: couleurDiscipline(p, r.cle) }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>{NOM_DISCIPLINE[r.cle]}</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>
                    {r.cle === 'natation' ? 'Allure, 4 dernières semaines' : r.cle === 'course' ? 'Allure, 4 dernières semaines' : r.valeur ? 'Meilleure puissance sur 20 min (90 jours)' : 'Vitesse, 4 dernières semaines'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.valeur, { color: p.texte }]}>
                    {valeurDe(r)}
                    {uniteDe(r) && r.cle !== 'velo' ? <Text style={[typo.petit, { color: p.texteDoux }]}> {uniteDe(r)}</Text> : null}
                  </Text>
                  {t.texte ? (
                    <View style={[styles.badge, { backgroundColor: t.bon === true ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
                      <Text style={[typo.petit, { color: t.bon === true ? p.ok : t.bon === false ? p.alerte : p.texteDoux, fontFamily: police.texte600 }]}>{t.texte}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
            En natation et en course, le pourcentage compare aux 4 semaines d’avant : en vert, tu vas plus vite. À vélo, c’est ta puissance du moment face à ton meilleur de toujours.
          </Text>
        </>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: 10 },
  colonne: { flex: 1, gap: 4 },
  trait: { height: 6, borderRadius: 3 },
  tendance: { fontFamily: police.texte600, fontSize: 13, lineHeight: 17, fontVariant: ['tabular-nums'] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  barre: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  valeur: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2, marginTop: 2 },
});
