import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { repartitionAllure } from '@/data/course';
import { formatDuree } from '@/data/format';
import { calculerZones } from '@/data/profil';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Où passe ton temps de course sur les 4 dernières semaines, zone d'allure par zone d'allure (zones recalculées depuis ta vitesse seuil).
// Une sortie est classée tout entière dans la zone de son allure moyenne : c'est une estimation, le grand format le dit.
export function WidgetZonesAllure({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const seuil = contexte.profil?.extras?.threshold_speed;
  const rep = repartitionAllure(contexte.toutesSeances, seuil);
  // De la zone la plus douce (transparente) à la plus dure (pleine), dans la couleur de la course
  const teinte = (i: number, n: number) => avecAlpha(p.sportCourse, 0.3 + (0.7 * i) / Math.max(1, n - 1));
  const vide = !(Number(seuil) > 0) ? 'Renseigne ta vitesse seuil' : 'Pas de course récente';

  const barre = rep ? (
    <View accessible accessibilityRole="image" accessibilityLabel={`Temps par zone d'allure : ${rep.zones.map((z) => `${z.nom} ${z.pct} %`).join(', ')}`} style={styles.barre}>
      {rep.zones.map((z, i) => (z.temps > 0 ? <View key={z.nom} style={{ flex: z.temps, backgroundColor: teinte(i, rep.zones.length) }} /> : null))}
    </View>
  ) : null;

  // XS : la zone où tu cours le plus ; S : + la répartition en une barre ; M : + les trois zones principales en liste ; L : les cinq zones avec leurs allures
  if (taille !== 'l') {
    const dom = rep ? rep.zones[rep.dominante] : null;
    const [code, ...reste] = dom ? dom.nom.split(' ') : [''];
    const principales = rep
      ? rep.zones
          .map((z, i) => ({ z, i }))
          .filter(({ z }) => z.temps > 0)
          .sort((a, b) => b.z.temps - a.z.temps)
          .slice(0, 3)
          .sort((a, b) => a.i - b.i)
      : [];
    return (
      <Tuile titre="Zones d'allure" valeur={dom ? code : '—'} note={dom ? `${reste.join(' ')} · ${dom.pct} % du temps` : vide} large>
        {!rep ? null : taille === 's' ? (
          barre
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre}
            <ListeCompacte lignes={principales.map(({ z, i }) => ({ cle: z.nom, nom: z.nom, valeur: `${z.pct} %`, point: teinte(i, rep.zones.length) }))} />
          </View>
        ) : null}
      </Tuile>
    );
  }

  const zones = calculerZones('allure', seuil);
  return (
    <CadreWidget titre="Zones d'allure">
      {rep && zones ? (
        <>
          <Text style={[styles.total, { color: p.texte }]}>
            {formatDuree(rep.total)}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> de course, 4 semaines</Text>
          </Text>
          <View style={styles.zones}>
            {rep.zones.map((z, i) => (
              <View key={z.nom} accessible accessibilityLabel={`${z.nom}, de ${zones[i].alluresDe} à ${zones[i].alluresA}, ${formatDuree(z.temps)}, ${z.pct} %`} style={styles.ligne}>
                <View style={styles.entete}>
                  <Text numberOfLines={1} style={[typo.petit, styles.nom, { color: p.texte }]}>
                    {z.nom}
                  </Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>{z.temps > 0 ? `${formatDuree(z.temps)} · ${z.pct} %` : '—'}</Text>
                </View>
                <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                  <View style={{ width: `${Math.max(z.temps > 0 ? 3 : 0, z.pct)}%`, height: '100%', backgroundColor: teinte(i, rep.zones.length), borderRadius: 4 }} />
                </View>
              </View>
            ))}
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Chaque sortie est classée dans la zone de son allure moyenne : une estimation.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>{Number(seuil) > 0 ? 'Pas de course sur les 4 dernières semaines.' : 'Renseigne ta vitesse seuil dans Paramètres › Physiologie pour voir où passe ton temps de course.'}</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', height: 12, borderRadius: 4, overflow: 'hidden', gap: 2 },
  total: { fontFamily: police.titre700, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'], marginBottom: 10 },
  zones: { gap: 8 },
  ligne: { gap: 4 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  nom: { flex: 1, minWidth: 0, fontFamily: police.texte600 },
  piste: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
