import { StyleSheet, Text, View } from 'react-native';
import { BarresHebdo } from '@/components/BarresHebdo';
import { CadreWidget } from '@/components/CadreWidget';
import { MiniBarres } from '@/components/MiniBarres';
import { Tuile } from '@/components/Tuile';
import { formatNombre } from '@/data/format';
import { volumeNatation } from '@/data/natation';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les mètres nagés chaque semaine, sur 8 semaines. Même forme que le tonnage de la muscu.
// tuile (taille S, M ou XS) : la version tuile, voir Tuile.
export function WidgetNatVolume({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const v = volumeNatation(contexte.toutesSeances);
  const aDesDonnees = v.parSemaine.some((m) => m > 0);

  if (tuile) {
    return (
      <Tuile
        titre="Natation / semaine"
        valeur={aDesDonnees ? formatNombre(v.derniere) : '—'}
        unite={aDesDonnees ? 'm' : ''}
        note={aDesDonnees ? (v.ecartPct != null ? `${v.ecartPct > 0 ? '+' : ''}${v.ecartPct} % vs moyenne` : '8 dernières semaines') : 'Pas encore de natation'}
      >
        {aDesDonnees ? <MiniBarres valeurs={v.parSemaine} couleur={p.sportNatation} etiquette="Mètres nagés par semaine sur 8 semaines" /> : null}
      </Tuile>
    );
  }

  const mieux = v.ecartPct != null && v.ecartPct >= 0;
  return (
    <CadreWidget titre="Natation par semaine">
      {aDesDonnees ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {formatNombre(v.derniere)}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> m</Text>
            </Text>
            {v.ecartPct != null ? (
              <View style={[styles.badge, { backgroundColor: mieux ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
                <Text style={[typo.petit, styles.badgeTexte, { color: mieux ? p.ok : p.texteDoux }]}>
                  {v.ecartPct > 0 ? '+' : ''}
                  {v.ecartPct} % vs moyenne
                </Text>
              </View>
            ) : null}
            <Text style={[typo.petit, styles.periode, { color: p.texteDoux }]}>8 dernières semaines</Text>
          </View>
          <BarresHebdo valeurs={v.parSemaine} couleur={p.sportNatation} etiquette="Mètres nagés par semaine sur 8 semaines" hauteur={105} />
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 12 }]}>Mètres nagés, additionnés sur 7 jours glissants.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de natation. Dès ta première séance, tes mètres par semaine apparaissent ici.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 14, rowGap: 8, marginBottom: 14 },
  valeur: { fontFamily: police.titre700, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
  periode: { marginLeft: 'auto' },
});
