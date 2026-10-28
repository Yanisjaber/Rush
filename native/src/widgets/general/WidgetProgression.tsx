import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { IconeSport } from '@/components/ui/IconeSport';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import { Tuile } from '@/components/ui/Tuile';
import { DISCIPLINES_DU_FILTRE, familleAffichage } from '@/data/sports/familles';
import { PERIODES_PROGRESSION, progressionTousSports, type PeriodeProgression, type Progression } from '@/data/bilan/progression';
import { MOT, formatPct, formatValeurProgression, variationTexte } from '@/data/bilan/progression-texte';
import type { WidgetProps } from '@/data/types';
import { useHistoriqueProgression } from '@/hooks/useHistoriqueProgression';
import { choisirPeriodeProgression, usePeriodeProgression } from '@/stores/progression';
import { avecAlpha, rayon } from '@/theme/couleurs';
import { SPORTS, couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NOM_SPORT = (famille: string): string => (SPORTS as Record<string, { court: string }>)[famille]?.court ?? famille;
// Les sports à mesurer : celui de l'onglet ouvert, ou tous ceux que l'utilisateur pratique sur « Tout »
function famillesDuContexte(filtre: string, seances: { sport: string }[], aDesSeriesDeForce: boolean): string[] {
  if (filtre !== 'tout') return DISCIPLINES_DU_FILTRE[filtre] ? [...DISCIPLINES_DU_FILTRE[filtre]] : [filtre];
  const f = new Set(seances.map((s) => familleAffichage(s.sport)));
  if (aDesSeriesDeForce) f.add('muscu');
  return [...f];
}

// « Est-ce que j'ai progressé ? » : une note par sport, la période actuelle comparée à celle d'avant (voir data/progression.ts).
//  XS : la réponse en un chiffre ; S : + une ligne par sport ; M : + l'indicateur et le passage de l'ancienne à la nouvelle valeur ; L : + le choix de la période.
export function WidgetProgression({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const jours = usePeriodeProgression();
  const { seances } = useHistoriqueProgression(contexte.toutesSeances);
  const liste = useMemo(
    () => progressionTousSports(
      famillesDuContexte(contexte.filtre, contexte.toutesSeances, contexte.force.series.length > 0),
      { seances, series: contexte.force.series, hrMax: contexte.hrMax },
      jours,
    ),
    [contexte.filtre, contexte.toutesSeances, contexte.force.series, contexte.hrMax, seances, jours],
  );
  const periode = PERIODES_PROGRESSION.find((x) => x.jours === jours)!;
  const mesurees = liste.filter((x) => x.statut !== 'insuffisant');
  const enHausse = mesurees.filter((x) => x.statut === 'hausse').length;

  const couleurStatut = (prog: Progression): string => (prog.statut === 'hausse' ? p.ok : prog.statut === 'baisse' ? p.alerte : p.texteDoux);
  const pastille = (prog: Progression) => (
    <View style={[styles.pastille, { backgroundColor: prog.statut === 'insuffisant' || prog.statut === 'stable' ? p.surface2 : avecAlpha(couleurStatut(prog), 0.16) }]}>
      <Text style={[typo.petit, styles.pastilleTexte, { color: couleurStatut(prog) }]}>{variationTexte(prog)}</Text>
    </View>
  );

  // Aucun sport mesurable (Hyrox seul, ski…) : on le dit au lieu d'afficher un widget vide
  if (!liste.length) {
    return <Tuile titre="Progression" valeur="—" note="Pas encore mesurable pour ce sport" large />;
  }

  // La réponse en un chiffre : un seul sport = son évolution ; plusieurs = combien sont en hausse
  const unique = mesurees.length === 1 ? mesurees[0] : null;
  const reponse = !mesurees.length ? '—' : unique ? formatPct(unique.variationPct!) : `${enHausse}/${mesurees.length}`;
  const note = !mesurees.length
    ? 'Pas assez de données'
    : unique
      ? `${MOT[unique.statut]} · vs ${periode.nom} d'avant`
      : `sports en hausse · vs ${periode.nom} d'avant`;

  if (taille === 'xs') return <Tuile titre="Progression" valeur={reponse} note={note} />;

  if (taille === 's') {
    return (
      <Tuile titre="Progression" valeur={reponse} note={note}>
        <View style={styles.lignesCompactes}>
          {liste.slice(0, 4).map((prog) => (
            <View key={prog.famille} style={styles.ligneCompacte}>
              <IconeSport sport={prog.famille} taille={14} />
              <Text numberOfLines={1} style={[typo.petit, styles.flex, { color: p.texteDoux }]}>{NOM_SPORT(prog.famille)}</Text>
              <Text style={[typo.petit, styles.pastilleTexte, { color: couleurStatut(prog) }]}>{variationTexte(prog)}</Text>
            </View>
          ))}
        </View>
      </Tuile>
    );
  }

  const ligne = (prog: Progression, detail: boolean) => (
    <View key={prog.famille} style={styles.ligne}>
      <View style={styles.tete}>
        <IconeSport sport={prog.famille} taille={18} />
        <Text numberOfLines={1} style={[typo.corpsFort, styles.flex, { color: p.texte }]}>{NOM_SPORT(prog.famille)}</Text>
        {pastille(prog)}
      </View>
      <Text style={[typo.petit, { color: p.texteDoux }]} numberOfLines={detail ? 3 : 1}>
        {prog.statut === 'insuffisant'
          ? prog.manque
          : `${prog.indicateur} : ${formatValeurProgression(prog, prog.avant)} → ${formatValeurProgression(prog, prog.actuel)}`}
      </Text>
    </View>
  );

  if (taille === 'm') {
    return (
      <CadreWidget titre="Progression">
        <View style={styles.liste}>{liste.slice(0, 3).map((prog) => ligne(prog, false))}</View>
      </CadreWidget>
    );
  }

  return (
    <CadreWidget titre="Progression">
      <OngletsSegment<string>
        etiquette="Période de comparaison"
        taille={13}
        onglets={PERIODES_PROGRESSION.map((x) => ({ cle: String(x.jours), nom: x.court }))}
        actuel={String(jours)}
        onChoisir={(cle) => choisirPeriodeProgression(Number(cle) as PeriodeProgression)}
      />
      <Text style={[typo.petit, styles.legende, { color: p.texteDoux }]}>
        {mesurees.length ? `${periode.nom} comparés aux ${periode.nom} d'avant, sorties faciles et exercices comparables seulement.` : 'Pas assez de séances pour comparer ces deux périodes.'}
      </Text>
      <View style={styles.liste}>{liste.map((prog) => ligne(prog, true))}</View>
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  liste: { gap: 10 },
  ligne: { gap: 2 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastille: { borderRadius: rayon.rond, paddingHorizontal: 9, paddingVertical: 3 },
  pastilleTexte: { fontFamily: police.texte600, fontVariant: ['tabular-nums'] },
  lignesCompactes: { gap: 2, marginTop: 4 },
  ligneCompacte: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legende: { marginVertical: 8 },
});
