import { StyleSheet, Text, View } from 'react-native';
import { bientot } from '@/actions/bientot';
import { Bouton } from '@/components/Bouton';
import { Dossard } from '@/components/Dossard';
import { Tuile } from '@/components/Tuile';
import { useRemplir } from '@/components/taille';
import { familleAffichage } from '@/data/familles';
import { programmeDuJour, resumeProgramme } from '@/data/force';
import { dateIsoLocale, formatDateLongue } from '@/data/format';
import type { WidgetProps } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le dossard de la séance de force du jour. Dans l'ordre :
//  1. une séance de muscu PRÉVUE aujourd'hui au calendrier : on l'affiche, avec le programme qu'on lui a relié (s'il y en a un) ;
//  2. sinon le programme qui suit celui de ta dernière séance (PUSH, PULL, LEGS, PUSH…) ;
//  3. sinon on propose d'enregistrer une séance.
// tuile : le nom du programme en gros, le détail en note.
// M : bandeau dossard pour téléphone (le nom du programme en gros, un seul bouton).
// Les écrans « démarrer une séance » et « voir » arrivent plus tard : les boutons le disent pour l'instant.
export function WidgetSeanceDuJour({ contexte, taille = 'm', tuile = false }: WidgetProps) {
  const p = usePalette();
  const remplir = useRemplir();
  const compact = taille === 'm'; // M : bandeau ; L : le grand dossard
  const aujourdhui = dateIsoLocale();

  // Séance de muscu prévue aujourd'hui (ni compétition, ni autre sport) et son programme relié
  const prevue = contexte.planifiees.find((x) => x.date === aujourdhui && x.category !== 'competition' && familleAffichage(x.sport) === 'muscu') ?? null;
  const programmeLie = prevue?.programme_id ? (contexte.force.programmes.find((x) => x.id === prevue.programme_id) ?? null) : null;
  const prog = programmeLie ?? programmeDuJour(contexte.force.programmes, contexte.toutesSeances);
  const resume = prog ? resumeProgramme(prog) : null;
  const detailProgramme = resume ? `${resume.exercices} exercice${resume.exercices > 1 ? 's' : ''} · ${resume.series} séries · environ ${resume.minutes} min` : '';
  const detailSansProgramme = prevue && Number(prevue.duration) > 0 ? `${prevue.duration} min · sans programme relié` : 'Sans programme relié';

  // Un seul bloc de texte et un bouton, quel que soit le cas (prévue, programme suivant, rien)
  const bandeau = prevue
    ? {
        etiquette: 'Séance du jour · prévue',
        valeur: programmeLie ? programmeLie.name : (prevue.name ?? ''),
        detail: programmeLie ? detailProgramme : detailSansProgramme,
        action: programmeLie ? 'Démarrer' : 'Enregistrer',
      }
    : prog
      ? { etiquette: 'Séance du jour', valeur: prog.name, detail: detailProgramme, action: 'Démarrer' }
      : { etiquette: 'Séance du jour', valeur: '—', detail: 'Enregistre ta séance : chrono, exercices, séries.', action: 'Enregistrer' };

  if (tuile) return <Tuile titre={bandeau.etiquette} valeur={bandeau.valeur || '—'} note={bandeau.detail} />;

  if (compact) {
    return (
      <View accessible accessibilityLabel={`${bandeau.etiquette}, ${bandeau.valeur}. ${bandeau.detail}`} style={[styles.bandeau, { backgroundColor: p.dossardFond }, remplir]}>
        {[styles.a, styles.b, styles.c, styles.d].map((pos, i) => (
          <View key={i} style={[styles.attache, pos, { backgroundColor: p.dossardTexte }]} />
        ))}
        <View style={styles.texte}>
          <Text numberOfLines={1} style={[typo.micro, { color: p.dossardTexte }]}>
            {bandeau.etiquette}
          </Text>
          <Text numberOfLines={1} style={[styles.valeur, { color: p.dossardTexte }]}>
            {bandeau.valeur}
          </Text>
          {bandeau.detail ? (
            <Text numberOfLines={2} style={[typo.petit, { color: p.dossardTexte, opacity: 0.75 }]}>
              {bandeau.detail}
            </Text>
          ) : null}
        </View>
        <View style={styles.boutons}>
          <Bouton variante="sur-dossard" onPress={() => bientot('La saisie des séances de force')}>
            {bandeau.action}
          </Bouton>
          {prevue ? (
            <Bouton variante="sur-dossard-contour" onPress={() => bientot('Le détail de la séance prévue')}>
              Voir
            </Bouton>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Dossard
      taille="m"
      sport="muscu"
      etiquette={bandeau.etiquette}
      nom={formatDateLongue(aujourdhui)}
      valeur={bandeau.valeur}
      detail={bandeau.detail}
    >
      <View style={styles.actions}>
        <Bouton variante="sur-dossard" onPress={() => bientot('La saisie des séances de force')}>
          {prevue ? (programmeLie ? 'Démarrer la séance' : 'Enregistrer la séance') : bandeau.action === 'Enregistrer' ? 'Enregistrer une séance' : 'Démarrer la séance'}
        </Bouton>
        {prevue ? (
          <Bouton variante="sur-dossard-contour" onPress={() => bientot('Le détail de la séance prévue')}>
            Voir
          </Bouton>
        ) : null}
      </View>
    </Dossard>
  );
}

const styles = StyleSheet.create({
  bandeau: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 18, borderRadius: rayon.bloc },
  attache: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5 },
  a: { left: 8, top: 8 },
  b: { right: 8, top: 8 },
  c: { left: 8, bottom: 8 },
  d: { right: 8, bottom: 8 },
  texte: { flex: 1, minWidth: 0 },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, marginTop: 2 },
  boutons: { gap: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
});
