import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { GrandChiffre } from '@/components/ui/GrandChiffre';
import { ListeCompacte } from '@/components/ui/ListeCompacte';
import { Tuile } from '@/components/ui/Tuile';
import { familleAffichage } from '@/data/sports/familles';
import { formatDateCourte, formatDateLongue, joursAvant } from '@/data/outils/format';
import { ecrireTemps, formatEcartLong } from '@/data/sports/hyrox';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Compte à rebours de ta prochaine compétition Hyrox, avec ton dernier test et ton objectif de temps.
export function WidgetHyroxDossard({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const objectif = contexte.objectifs.find((o) => familleAffichage(o.sport) === 'hyrox') ?? null;
  const jours = objectif ? `J-${joursAvant(objectif.date)}` : '—';

  // XS : le compte à rebours ; S : + le nom ; M : + la date, ton dernier test, ton objectif et l'écart en liste ; L : le grand format et sa barre de progression
  if (taille !== 'l') {
    const dernier = contexte.hyrox.tests[0] ?? null;
    const cible = contexte.hyrox.objectif;
    const ecart = dernier && cible ? dernier.total_s - cible.total_s : null;
    const lignes = [
      ...(objectif ? [{ cle: 'date', nom: 'Date', valeur: formatDateCourte(objectif.date) }] : []),
      ...(dernier ? [{ cle: 'test', nom: 'Dernier test', valeur: ecrireTemps(dernier.total_s) }] : []),
      ...(cible ? [{ cle: 'obj', nom: 'Objectif', valeur: ecrireTemps(cible.total_s) }] : []),
      ...(ecart != null ? [{ cle: 'ecart', nom: 'Écart', valeur: formatEcartLong(ecart), couleur: ecart > 0 ? p.alerte : p.ok }] : []),
    ];
    return (
      <Tuile titre="Prochain Hyrox" valeur={jours} note={objectif ? objectif.name : 'Aucune compétition'} large>
        {taille === 'm' && lignes.length ? <ListeCompacte lignes={lignes} /> : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Prochain Hyrox">
      <GrandChiffre
        valeur={jours}
        nom={objectif ? objectif.name : 'Hyrox'}
        detail={objectif ? formatDateLongue(objectif.date) : "Ajoute ta compétition Hyrox dans l'onglet Compétitions."}
      >
        <Progression contexte={contexte} />
      </GrandChiffre>
    </CadreWidget>
  );
}

// Ton dernier test face à ton objectif : plus il s'en rapproche, plus la barre se remplit
function Progression({ contexte }: { contexte: WidgetProps['contexte'] }) {
  const p = usePalette();
  const dernier = contexte.hyrox.tests[0] ?? null;
  const cible = contexte.hyrox.objectif;
  if (!dernier && !cible) return null;
  const avancement = dernier && cible ? Math.max(0, Math.min(100, (cible.total_s / dernier.total_s) * 100)) : 0;
  return (
    <>
      <View style={styles.temps}>
        <Text style={[styles.tempsTexte, { color: p.texte }]}>{dernier ? `Dernier test ${ecrireTemps(dernier.total_s)}` : 'Aucun test'}</Text>
        <Text style={[styles.tempsTexte, { color: p.texte }]}>{cible ? `Objectif ${ecrireTemps(cible.total_s)}` : "Pas d'objectif"}</Text>
      </View>
      {dernier && cible ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={`Ton dernier test atteint ${Math.round(avancement)} % de ton objectif`} style={[styles.barre, { backgroundColor: avecAlpha(p.texte, 0.18) }]}>
          <View style={[styles.rempli, { width: `${avancement}%`, backgroundColor: p.texte }]} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  temps: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  tempsTexte: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20 },
  barre: { height: 6, borderRadius: 3, overflow: 'hidden' },
  rempli: { height: '100%', borderRadius: 3 },
});
