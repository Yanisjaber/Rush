import { StyleSheet, Text, View } from 'react-native';
import { TraitTirets } from '@/components/TraitTirets';
import { CadreWidget } from '@/components/CadreWidget';
import { CourbeLissee } from '@/components/CourbeLissee';
import { DeuxCourbes } from '@/components/DeuxCourbes';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import { formeActuelle } from '@/data/bilan/synthese';
import type { WidgetProps } from '@/data/types';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Forme, condition et fatigue du moment (dernier jour de la courbe de charge).
// Forme = condition − fatigue : positive quand on est frais, négative quand on est fatigué.
//  - XS : la forme et son libellé ;  S : + la courbe de condition sur 4 semaines ;
//  - M : + condition et fatigue sur 6 semaines, sur la même échelle ;
//  - L : les trois chiffres (forme, condition, fatigue) + la même courbe sur 12 semaines et sa légende.
const signe = (n: number) => `${n > 0 ? '+' : ''}${n}`;

export function WidgetForme({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const forme = formeActuelle(contexte.metriques);
  const jours = (n: number) => contexte.metriques.slice(-n);

  if (taille !== 'l') {
    const note = forme ? `${forme.libelle} · cond. ${forme.ctl}, fat. ${forme.atl}` : 'Pas encore de données';
    return (
      <Tuile titre="Forme" valeur={forme ? signe(forme.tsb) : '—'} note={note} large>
        {!forme ? null : taille === 's' ? (
          <CourbeLissee valeurs={jours(28).map((m) => Number(m.ctl) || 0)} couleur={p.texte} hauteur={34} aire={false} etiquette="Ta condition sur les 4 dernières semaines" />
        ) : taille === 'm' ? (
          <DeuxCourbes principale={jours(42).map((m) => Number(m.ctl) || 0)} secondaire={jours(42).map((m) => Number(m.atl) || 0)} largeur={220} hauteur={88} etiquette="Ta condition et ta fatigue sur les 6 dernières semaines" />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Forme">
      {forme ? (
        <>
          <View style={styles.stats}>
            <StatCle etiquette="Forme" valeur={signe(forme.tsb)} note={forme.libelle} couleur={forme.tsb >= 5 ? p.ok : undefined} />
            <StatCle etiquette="Condition" valeur={String(forme.ctl)} />
            <StatCle etiquette="Fatigue" valeur={String(forme.atl)} />
          </View>
          <View style={styles.graphe}>
            <DeuxCourbes principale={jours(84).map((m) => Number(m.ctl) || 0)} secondaire={jours(84).map((m) => Number(m.atl) || 0)} largeur={320} hauteur={100} etiquette="Ta condition et ta fatigue sur les 12 dernières semaines" />
          </View>
          <View style={styles.legende}>
            <View style={styles.item}>
              <View style={[styles.trait, { backgroundColor: p.texte }]} />
              <Text style={[typo.petit, { color: p.texteDoux }]}>Condition</Text>
            </View>
            <View style={styles.item}>
              <TraitTirets couleur={p.texteDoux} epaisseur={2} largeur={16} />
              <Text style={[typo.petit, { color: p.texteDoux }]}>Fatigue</Text>
            </View>
            <Text style={[typo.petit, styles.periode, { color: p.texteDoux }]}>12 dernières semaines</Text>
          </View>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de données de forme.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  graphe: { marginTop: 14 },
  legende: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trait: { width: 16, height: 3, borderRadius: 2 },
  periode: { marginLeft: 'auto' },
});
