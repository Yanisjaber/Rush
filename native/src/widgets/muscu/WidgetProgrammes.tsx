import { Pressable, StyleSheet, Text, View } from 'react-native';
import { bientot } from '@/actions/bientot';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { Bouton } from '@/components/ui/Bouton';
import { ListeCompacte } from '@/components/ui/ListeCompacte';
import { Tuile } from '@/components/ui/Tuile';
import { resumeProgramme } from '@/data/sports/force';
import type { WidgetProps } from '@/data/types';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes programmes de musculation (PUSH, PULL, LEGS…).
export function WidgetProgrammes({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const programmes = contexte.force.programmes;
  const detail = (prog: (typeof programmes)[number]) => {
    const r = resumeProgramme(prog);
    return `${r.exercices} exo${r.exercices > 1 ? 's' : ''} · ${r.series} séries · ~${r.minutes} min`;
  };

  // XS : le nombre de programmes ; S : + leurs noms ; M : + les quatre premiers en liste ; L : la liste détaillée (exercices, séries, durée)
  if (taille !== 'l') {
    return (
      <Tuile titre="Programmes" valeur={String(programmes.length)} note={taille === 's' && programmes.length ? programmes.map((prog) => prog.name).join(' · ') : programmes.length > 1 ? 'programmes de force' : 'programme de force'} large>
        {taille === 'm' && programmes.length ? (
          <ListeCompacte lignes={programmes.slice(0, 4).map((prog) => ({ cle: prog.id, nom: prog.name, valeur: `${resumeProgramme(prog).exercices} exos` }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Programmes">
      {programmes.length ? (
        programmes.slice(0, 4).map((prog, i) => (
          <Pressable
            key={prog.id}
            onPress={() => bientot('La page des programmes')}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir le programme ${prog.name}`}
            style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
          >
            <Text numberOfLines={1} style={[styles.nomProg, { color: p.texte }]}>
              {prog.name}
            </Text>
            <Text style={[typo.petit, { color: p.texteDoux }]}>{detail(prog)}</Text>
          </Pressable>
        ))
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Aucun programme pour l'instant. Crée-en un pour démarrer tes séances en un geste.</Text>
      )}
      <View style={{ marginTop: 12 }}>
        <Bouton variante="discret" onPress={() => bientot('La création de programme')}>
          + Nouveau programme
        </Bouton>
      </View>
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  // Version téléphone : un bouton, pas une carte
  bouton: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 18, borderRadius: rayon.bloc },
  nom: { flex: 1, fontFamily: police.titre700, fontSize: 17, lineHeight: 22 },
  nombre: { minWidth: 24, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, alignItems: 'center' },
  nombreTexte: { fontFamily: police.texte600 },
  fleche: { width: 7, height: 7, marginRight: 3, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },
  // Version carte
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 },
  nomProg: { flex: 1, minWidth: 0, fontFamily: police.titre700, fontSize: 16, lineHeight: 22 },
});
