import { View } from 'react-native';
import { bientot } from '@/actions/bientot';
import { Bouton } from '@/components/Bouton';
import { CadreWidget } from '@/components/CadreWidget';
import { GrandChiffre } from '@/components/GrandChiffre';
import { Tuile } from '@/components/Tuile';
import { familleAffichage } from '@/data/sports/familles';
import { programmeDuJour, resumeProgramme } from '@/data/sports/force';
import { dateIsoLocale, formatDateLongue } from '@/data/outils/format';
import type { WidgetProps } from '@/data/types';

// La séance de force du jour. Dans l'ordre :
//  1. une séance de muscu PRÉVUE aujourd'hui au calendrier : on l'affiche, avec le programme qu'on lui a relié (s'il y en a un) ;
//  2. sinon le programme qui suit celui de ta dernière séance (PUSH, PULL, LEGS, PUSH…) ;
//  3. sinon on propose d'enregistrer une séance.
// Comme tous les widgets, il prend la forme que lui donne sa taille (XS, S, M : tuile ; L : le grand format) ; s'il est le premier de la page,
// le cadre lui donne le look dossard. Les écrans « démarrer une séance » et « voir » arrivent plus tard : les boutons le disent pour l'instant.
export function WidgetSeanceDuJour({ contexte, taille = 'm', tuile = false }: WidgetProps) {
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

  // petit : les deux boutons côte à côte, plus bas (pour la tuile S)
  const actions = (petit = false) => (
    <View style={petit ? { flexDirection: 'row', gap: 8, marginTop: 8 } : { gap: 6 }}>
      <View style={petit ? { flex: 1 } : undefined}>
        <Bouton petit={petit} onPress={() => bientot('La saisie des séances de force')}>
          {bandeau.action}
        </Bouton>
      </View>
      {prevue ? (
        <View style={petit ? { flex: 1 } : undefined}>
          <Bouton petit={petit} variante="discret" onPress={() => bientot('Le détail de la séance prévue')}>
            Voir
          </Bouton>
        </View>
      ) : null}
    </View>
  );

  // XS : le nom et la durée ; S : + le détail et les boutons en petit, en bas ; M : le détail et les boutons à droite
  if (tuile) {
    const note = taille === 'xs' && resume ? `~${resume.minutes} min` : bandeau.detail;
    return (
      <Tuile titre="Séance du jour" valeur={bandeau.valeur || '—'} note={note}>
        {taille === 'm' ? actions() : taille === 's' ? actions(true) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre={bandeau.etiquette}>
      <GrandChiffre valeur={bandeau.valeur || '—'} nom={formatDateLongue(aujourdhui)} detail={bandeau.detail}>
        {actions()}
      </GrandChiffre>
    </CadreWidget>
  );
}
