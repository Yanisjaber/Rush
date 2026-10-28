import { StyleSheet, Text, View } from 'react-native';
import { BarresHebdo } from '@/components/graphes/BarresHebdo';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { ListeCompacte } from '@/components/ui/ListeCompacte';
import { MiniBarres } from '@/components/graphes/MiniBarres';
import { Tuile } from '@/components/ui/Tuile';
import { formatDateCourte, formatDuree } from '@/data/outils/format';
import { bricks, bricksParSemaine, type Brick } from '@/data/sports/triathlon';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes enchaînements : un vélo suivi d'une course à pied dans la foulée (la course d'abord en duathlon). C'est ce qui prépare les jambes à courir fatiguées.
//  - XS : le nombre sur 4 semaines ; S : + les 8 dernières semaines en mini-barres ; M : + tes trois derniers en liste ;
//  - L : + les 12 semaines en barres et tes cinq derniers, avec le temps de transition.
const resume = (b: Brick) => (b.ordre === 'velo-course' ? `${formatDuree(b.velo.moving_time)} vélo + ${formatDuree(b.course.moving_time)} course` : `${formatDuree(b.course.moving_time)} course + ${formatDuree(b.velo.moving_time)} vélo`);

export function WidgetTriBricks({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const b = bricks(contexte.toutesSeances);
  const parSemaine = bricksParSemaine(b.liste, 12);
  const duathlon = contexte.filtre === 'duathlon';

  if (taille !== 'l') {
    return (
      <Tuile titre="Enchaînements" valeur={String(b.quatreSemaines)} note={b.total ? (duathlon ? 'sur 4 semaines' : 'vélo + course, 4 sem.') : 'Pas encore'} large>
        {!b.total ? null : taille === 's' ? (
          <MiniBarres valeurs={parSemaine.slice(-8)} couleur={p.sportVelo} etiquette="Enchaînements par semaine sur 8 semaines" />
        ) : taille === 'm' ? (
          <ListeCompacte lignes={b.liste.slice(0, 3).map((x) => ({ cle: x.velo.id, nom: formatDateCourte(x.date), valeur: resume(x) }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Enchaînements">
      {b.total ? (
        <>
          <Text style={[styles.total, { color: p.texte }]}>
            {b.quatreSemaines}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> sur 4 semaines · {b.total} sur 12</Text>
          </Text>
          <BarresHebdo valeurs={parSemaine} couleur={p.sportVelo} hauteur={70} etiquette="Enchaînements par semaine sur 12 semaines" />
          <View style={{ marginTop: 14 }}>
            <ListeCompacte lignes={b.liste.slice(0, 5).map((x) => ({ cle: x.velo.id, nom: formatDateCourte(x.date), valeur: resume(x) }))} />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
            {duathlon ? 'Un vélo et une course le même jour, la deuxième séance commençant moins de 90 minutes après la fin de la première.' : 'Un vélo suivi d’une course à pied le même jour, moins de 90 minutes après la fin du vélo.'}
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore d’enchaînement. Un vélo suivi d’une course à pied dans les 90 minutes (le même jour) en compte un.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  total: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'], marginBottom: 12 },
});
