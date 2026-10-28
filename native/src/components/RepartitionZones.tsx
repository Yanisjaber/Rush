import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatDuree } from '@/data/outils/format';
import type { RepartitionZones as Repartition } from '@/data/sports/hebdo';
import type { Taille } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Où passe ton temps sur 4 semaines, zone par zone (allure en course, puissance à vélo). Partagé par les deux widgets.
//  - XS : la zone où tu passes le plus de temps ;
//  - S  : + la répartition en une barre ;
//  - M  : + les trois zones principales en liste ;
//  - L  : toutes les zones, chacune avec son temps, son pourcentage et sa barre, puis la phrase qui explique l'estimation.
interface Props {
  taille: Taille;
  titre: string;
  couleur: string;
  rep: Repartition | null;
  /** Ce qu'on dit en tuile quand il n'y a rien à montrer, et en grand format. */
  videTuile: string;
  videL: string;
  /** Après la durée totale du grand format : « de course, 4 semaines ». */
  uniteTotal: string;
  pied: string;
}

export function RepartitionZones({ taille, titre, couleur, rep, videTuile, videL, uniteTotal, pied }: Props) {
  const p = usePalette();
  // De la zone la plus douce (transparente) à la plus dure (pleine), dans la couleur du sport
  const teinte = (i: number, n: number) => avecAlpha(couleur, 0.3 + (0.7 * i) / Math.max(1, n - 1));

  const barre = rep ? (
    <View accessible accessibilityRole="image" accessibilityLabel={`Temps par zone : ${rep.zones.map((z) => `${z.nom} ${z.pct} %`).join(', ')}`} style={styles.barre}>
      {rep.zones.map((z, i) => (z.temps > 0 ? <View key={z.nom} style={{ flex: z.temps, backgroundColor: teinte(i, rep.zones.length) }} /> : null))}
    </View>
  ) : null;

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
      <Tuile titre={titre} valeur={dom ? code : '—'} note={dom ? `${reste.join(' ')} · ${dom.pct} % du temps` : videTuile} large>
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

  return (
    <CadreWidget titre={titre}>
      {rep ? (
        <>
          <Text style={[styles.total, { color: p.texte }]}>
            {formatDuree(rep.total)}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {uniteTotal}</Text>
          </Text>
          <View style={styles.zones}>
            {rep.zones.map((z, i) => (
              <View key={z.nom} accessible accessibilityLabel={`${z.nom}, ${formatDuree(z.temps)}, ${z.pct} %`} style={styles.ligne}>
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
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>{pied}</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>{videL}</Text>
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
