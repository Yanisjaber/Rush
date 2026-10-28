import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatDateCourte } from '@/data/outils/format';
import { dernieresParDiscipline, disciplinesDe, type DerniereSeance } from '@/data/sports/triathlon';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { couleurDiscipline, NOM_COURT, NOM_DISCIPLINE } from './disciplines';

// Depuis combien de jours tu n'as pas fait chacune de tes disciplines : pour ne pas laisser la natation (ou le vélo) s'éloigner sans s'en apercevoir.
// Au-delà de 7 jours, la discipline passe en alerte.
//  - XS : la discipline la plus délaissée ; S : + les trois disciplines côte à côte ; M : + la liste ; L : + la dernière séance de chacune.
const SEUIL_ALERTE = 7;
const texteJours = (j: number | null) => (j == null ? 'Jamais' : j === 0 ? "Aujourd'hui" : j === 1 ? 'Hier' : `${j} j`);

export function WidgetTriFraicheur({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const disciplines = disciplinesDe(contexte.filtre);
  const dernieres = dernieresParDiscipline(contexte.toutesSeances, disciplines);
  // La plus délaissée : celle qui n'a aucune séance, sinon celle qui date le plus
  const delaissee = [...dernieres].sort((a, b) => (b.jours ?? Infinity) - (a.jours ?? Infinity))[0];
  const enAlerte = (d: DerniereSeance) => d.jours == null || d.jours > SEUIL_ALERTE;

  if (taille !== 'l') {
    return (
      <Tuile
        titre="Par discipline"
        valeur={delaissee ? (delaissee.jours == null ? '—' : texteJours(delaissee.jours)) : '—'}
        note={delaissee ? (delaissee.jours == null ? `Pas encore de ${NOM_DISCIPLINE[delaissee.cle].toLowerCase()}` : `depuis ta ${delaissee.cle === 'velo' ? 'sortie vélo' : `séance de ${NOM_DISCIPLINE[delaissee.cle].toLowerCase()}`}`) : ''}
        large
      >
        {taille === 's' ? (
          <View style={styles.rangee}>
            {dernieres.map((d) => (
              <View key={d.cle} accessible accessibilityLabel={`${NOM_DISCIPLINE[d.cle]} : ${texteJours(d.jours)}`} style={styles.colonne}>
                <View style={[styles.trait, { backgroundColor: enAlerte(d) ? p.alerte : couleurDiscipline(p, d.cle) }]} />
                <Text style={[typo.micro, { color: p.texteDoux }]}>{NOM_COURT[d.cle]}</Text>
                <Text style={[styles.jours, { color: p.texte }]}>{d.jours == null ? '—' : d.jours === 0 ? '0' : d.jours}</Text>
              </View>
            ))}
          </View>
        ) : taille === 'm' ? (
          <ListeCompacte lignes={dernieres.map((d) => ({ cle: d.cle, nom: NOM_DISCIPLINE[d.cle], valeur: texteJours(d.jours), point: couleurDiscipline(p, d.cle), couleur: enAlerte(d) ? p.alerte : undefined }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Dernière séance par discipline">
      {dernieres.map((d, i) => (
        <View
          key={d.cle}
          accessible
          accessibilityLabel={`${NOM_DISCIPLINE[d.cle]} : ${d.jours == null ? 'aucune séance' : `${texteJours(d.jours)}${d.nom ? `, ${d.nom}` : ''}`}`}
          style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }, i === 0 && { paddingTop: 0 }]}
        >
          <View style={[styles.barre, { backgroundColor: couleurDiscipline(p, d.cle) }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typo.corpsFort, { color: p.texte }]}>{NOM_DISCIPLINE[d.cle]}</Text>
            <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
              {d.date ? `${d.nom ? `${d.nom} · ` : ''}${formatDateCourte(d.date)}` : 'Aucune séance'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: enAlerte(d) ? avecAlpha(p.alerte, 0.16) : p.surface2 }]}>
            <Text style={[typo.corpsFort, { color: enAlerte(d) ? p.alerte : p.texte }]}>{texteJours(d.jours)}</Text>
          </View>
        </View>
      ))}
      <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Au-delà de {SEUIL_ALERTE} jours sans séance, la discipline passe en alerte.</Text>
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row', gap: 10 },
  colonne: { flex: 1, gap: 2 },
  trait: { height: 6, borderRadius: 3 },
  jours: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  barre: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, minWidth: 72, alignItems: 'center' },
});
