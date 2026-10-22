import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { formatDateCourte, formatKm, formatNombre } from '@/data/format';
import { NOM_TERRAIN, profilTerrain, SEUILS_TERRAIN, type Terrain } from '@/data/vtt';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le terrain de tes sorties de VTT : le dénivelé par kilomètre (m/km), de roulant à montagneux (repères indicatifs, voir SEUILS_TERRAIN).
//  - XS : le dénivelé par km de tes sorties et le type de terrain ; S : + une barre par sortie ; M : + le nombre de sorties de chaque type ;
//  - L : + la répartition et tes sorties les plus récentes, une par une.
const virgule = (n: number) => String(n).replace('.', ',');

export function WidgetTerrainVtt({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const profil = profilTerrain(contexte.toutesSeances);
  const { moyenne, terrain } = profil;
  // Du plus plat au plus montagneux : de plus en plus soutenu
  const teinte: Record<Terrain, string> = { roulant: avecAlpha(p.sportVelo, 0.35), vallonne: avecAlpha(p.sportVelo, 0.65), montagneux: p.sportVelo };

  if (taille !== 'l') {
    const ratios = [...profil.sorties].reverse().map((s) => s.ratio); // du plus ancien au plus récent
    return (
      <Tuile titre="Profil des sorties" valeur={moyenne != null ? virgule(moyenne) : '—'} unite={moyenne != null ? 'm D+/km' : ''} note={terrain ? NOM_TERRAIN[terrain] : 'Pas encore de sortie'} large>
        {!profil.sorties.length ? null : taille === 's' ? (
          <MiniBarres valeurs={ratios.slice(-8)} couleur={p.sportVelo} etiquette="Dénivelé par kilomètre de tes 8 dernières sorties de VTT" />
        ) : taille === 'm' ? (
          <ListeCompacte lignes={(['roulant', 'vallonne', 'montagneux'] as Terrain[]).map((t) => ({ cle: t, nom: NOM_TERRAIN[t], valeur: `${profil.comptes[t]} sortie${profil.comptes[t] > 1 ? 's' : ''}`, point: teinte[t] }))} />
        ) : null}
      </Tuile>
    );
  }

  const total = profil.sorties.length;
  const recentes = profil.sorties.slice(0, 6);
  return (
    <CadreWidget titre="Profil des sorties">
      {total && moyenne != null && terrain ? (
        <>
          <Text style={[styles.valeur, { color: p.texte }]}>
            {virgule(moyenne)}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> m de D+ par km · {NOM_TERRAIN[terrain].toLowerCase()}</Text>
          </Text>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Répartition de tes ${total} sorties : ${(['roulant', 'vallonne', 'montagneux'] as Terrain[]).map((t) => `${profil.comptes[t]} ${NOM_TERRAIN[t].toLowerCase()}`).join(', ')}`}
            style={styles.barre}
          >
            {(['roulant', 'vallonne', 'montagneux'] as Terrain[]).map((t) => (profil.comptes[t] > 0 ? <View key={t} style={{ flex: profil.comptes[t], backgroundColor: teinte[t] }} /> : null))}
          </View>
          <View style={styles.legende}>
            {(['roulant', 'vallonne', 'montagneux'] as Terrain[]).map((t) => (
              <View key={t} style={styles.item}>
                <View style={[styles.carre, { backgroundColor: teinte[t] }]} />
                <Text style={[typo.petit, { color: p.texteDoux }]}>
                  {NOM_TERRAIN[t]} · {profil.comptes[t]}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 12 }}>
            <ListeCompacte lignes={recentes.map((s) => ({ cle: s.id, nom: `${formatDateCourte(s.date)} · ${formatKm(s.km, 0)} km, ${formatNombre(s.dPlus)} m`, valeur: `${virgule(s.ratio)} m/km`, point: teinte[s.terrain] }))} />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
            {`Dénivelé positif divisé par la distance, sur tes sorties de VTT des 12 dernières semaines. Repères indicatifs : moins de ${SEUILS_TERRAIN.vallonne} m/km roulant, jusqu'à ${SEUILS_TERRAIN.montagneux} vallonné, au-delà montagneux.`}
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de sortie de VTT d'au moins 3 km avec son dénivelé sur les 12 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  valeur: { fontFamily: police.titre700, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'], marginBottom: 10 },
  barre: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 },
  legende: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carre: { width: 10, height: 10, borderRadius: 2 },
});
