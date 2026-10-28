import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { ListeCompacte } from '@/components/ui/ListeCompacte';
import { Tuile } from '@/components/ui/Tuile';
import { formatChrono } from '@/data/outils/format';
import { predictionsCourse } from '@/data/bilan/synthese';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// 5 km, 10 km et semi estimés d'après les sorties récentes (formule de Riegel), avec l'écart à l'objectif.
export function WidgetPredictions({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const predictions = predictionsCourse(contexte.toutesSeances);

  // Écart à l'objectif : on compare à la prédiction de la distance la plus proche de la prochaine course
  const objectif = contexte.objectifs[0] ?? null;
  let ecart: { cle: string; secondes: number } | null = null;
  if (objectif && objectif.km && objectif.duration) {
    const km = objectif.km;
    const proche = predictions.reduce<(typeof predictions)[number] | null>((a, b) => (a && Math.abs(a.km - km) <= Math.abs(b.km - km) ? a : b), null);
    if (proche && Math.abs(proche.km - km) <= 1.5) ecart = { cle: proche.cle, secondes: proche.secondes - objectif.duration * 60 };
  }

  // XS : la distance de l'objectif ; S : + les autres en note ; M : + les trois distances et l'écart à l'objectif en liste ; L : le grand format
  if (taille !== 'l') {
    const vedette = predictions.find((pr) => pr.cle === ecart?.cle) ?? predictions[predictions.length > 1 ? 1 : 0];
    const autres = predictions.filter((pr) => pr !== vedette).map((pr) => `${pr.label} ${formatChrono(pr.secondes)}`).join(' · ');
    const texteEcart = ecart ? `${ecart.secondes <= 0 ? '−' : '+'}${formatChrono(Math.abs(ecart.secondes))} vs objectif` : null;
    const lignes = predictions.map((pr) => ({ cle: pr.cle, nom: pr.label, valeur: formatChrono(pr.secondes) }));
    if (texteEcart && ecart) lignes.push({ cle: 'ecart', nom: 'Objectif', valeur: texteEcart, couleur: ecart.secondes <= 0 ? p.ok : p.alerte } as (typeof lignes)[number]);
    return (
      <Tuile
        titre={vedette ? `Prédiction ${vedette.label}` : 'Prédictions'}
        valeur={vedette ? formatChrono(vedette.secondes) : '—'}
        note={vedette ? (taille === 'm' ? 'Estimée sur 4 mois' : autres) : 'Il faut une sortie de 5 km'}
        large
      >
        {taille === 'm' && lignes.length ? <ListeCompacte lignes={lignes} /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Prédictions de temps">
      {predictions.length ? (
        <>
          {predictions.map((pr, i) => {
            const vedette = ecart?.cle === pr.cle;
            return (
              <View
                key={pr.cle}
                accessible
                accessibilityLabel={`${pr.label}, ${formatChrono(pr.secondes)}${vedette && ecart ? `, ${ecart.secondes <= 0 ? 'moins' : 'plus'} ${formatChrono(Math.abs(ecart.secondes))} par rapport à l'objectif` : ''}`}
                style={[
                  styles.ligne,
                  i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth },
                  i === 0 && { paddingTop: 0 },
                  vedette && { backgroundColor: avecAlpha(p.sportCourse, 0.12), marginHorizontal: -18, paddingHorizontal: 18 },
                ]}
              >
                <Text style={[typo.corps, styles.distance, { color: p.texteDoux }]}>{pr.label}</Text>
                <Text style={[styles.chrono, { color: p.texte }]}>{formatChrono(pr.secondes)}</Text>
                {vedette && ecart ? (
                  <View style={[styles.puce, { backgroundColor: ecart.secondes <= 0 ? p.ok : p.sportCourse }]}>
                    <Text style={[typo.petit, styles.puceTexte, { color: p.encreSurCouleur }]}>
                      {ecart.secondes <= 0 ? '−' : '+'}
                      {formatChrono(Math.abs(ecart.secondes))} vs objectif
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 14 }]}>
            Estimées à partir de tes sorties des 4 derniers mois (formule de Riegel). Prudentes : une sortie d'entraînement n'est pas une course.
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Il faut au moins une sortie de 5 km sur les 4 derniers mois pour estimer tes temps.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  distance: { width: 64 },
  chrono: { flex: 1, fontFamily: police.titre700, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
  puce: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  puceTexte: { fontFamily: police.texte600 },
});
