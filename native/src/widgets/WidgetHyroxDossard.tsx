import { StyleSheet, Text, View } from 'react-native';
import { Dossard } from '@/components/Dossard';
import { Tuile } from '@/components/Tuile';
import { familleAffichage } from '@/data/familles';
import { formatDateLongue, joursAvant } from '@/data/format';
import { ecrireTemps } from '@/data/hyrox';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Compte à rebours de ta prochaine compétition Hyrox, avec ton dernier test et ton objectif de temps.
// tuile : le compte à rebours en gros, le nom de la course en note.
export function WidgetHyroxDossard({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const objectif = contexte.objectifs.find((o) => familleAffichage(o.sport) === 'hyrox') ?? null;
  const dernier = contexte.hyrox.tests[0] ?? null;
  const cible = contexte.hyrox.objectif;
  // Barre de progression : plus le test se rapproche de l'objectif, plus elle se remplit
  const avancement = dernier && cible ? Math.max(0, Math.min(100, (cible.total_s / dernier.total_s) * 100)) : 0;

  if (tuile) return <Tuile titre="Prochain Hyrox" valeur={objectif ? `J-${joursAvant(objectif.date)}` : '—'} note={objectif ? objectif.name : 'Aucune compétition'} />;

  return (
    <Dossard
      sport="hyrox"
      etiquette="Prochain objectif"
      nom={objectif ? objectif.name : 'Hyrox'}
      valeur={objectif ? `J-${joursAvant(objectif.date)}` : '—'}
      detail={objectif ? formatDateLongue(objectif.date) : "Ajoute ta compétition Hyrox dans l'onglet Compétitions."}
    >
      {dernier || cible ? (
        <>
          <View style={styles.temps}>
            <Text style={[styles.tempsTexte, { color: p.dossardTexte }]}>{dernier ? `Dernier test ${ecrireTemps(dernier.total_s)}` : 'Aucun test'}</Text>
            <Text style={[styles.tempsTexte, { color: p.dossardTexte }]}>{cible ? `Objectif ${ecrireTemps(cible.total_s)}` : "Pas d'objectif"}</Text>
          </View>
          {dernier && cible ? (
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Ton dernier test atteint ${Math.round(avancement)} % de ton objectif`}
              style={[styles.barre, { backgroundColor: avecAlpha(p.dossardTexte, 0.18) }]}
            >
              <View style={[styles.rempli, { width: `${avancement}%`, backgroundColor: p.dossardTexte }]} />
            </View>
          ) : null}
        </>
      ) : null}
    </Dossard>
  );
}

const styles = StyleSheet.create({
  temps: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  tempsTexte: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20 },
  barre: { height: 6, borderRadius: 3, overflow: 'hidden' },
  rempli: { height: '100%', borderRadius: 3 },
});
