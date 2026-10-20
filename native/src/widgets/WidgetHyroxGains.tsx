import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { ciblesSegments, ecartsParSegment, formatEcart } from '@/data/hyrox';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Pour chaque station : l'écart entre ton dernier test et ton objectif. Orange = temps à gagner, vert = déjà tenu.
// tuile : le temps total à gagner sur les stations, la station la plus en retard en note.
export function WidgetHyroxGains({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  const test = contexte.hyrox.tests[0] ?? null;
  const cibles = ciblesSegments(contexte.hyrox.objectif, test);
  const ecarts = ecartsParSegment(test, cibles, 'station');
  const echelle = Math.max(10, ...ecarts.map((e) => Math.abs(e.ecart)));

  if (tuile) {
    const aGagner = ecarts.filter((e) => e.ecart > 0);
    const pire = aGagner.reduce<(typeof ecarts)[number] | null>((a, b) => (a && a.ecart >= b.ecart ? a : b), null);
    return (
      <Tuile
        titre="Où gagner du temps"
        valeur={ecarts.length ? formatEcart(aGagner.reduce((somme, e) => somme + e.ecart, 0)) : '—'}
        note={pire ? `Surtout : ${pire.nom}` : ecarts.length ? 'Objectif tenu partout' : 'Fixe un objectif'}
      />
    );
  }

  return (
    <CadreWidget titre="Où gagner du temps">
      {ecarts.length ? (
        <>
          <View style={styles.liste}>
            {ecarts.map((e) => (
              <View key={e.cle} accessible accessibilityLabel={`${e.nom} : ${formatEcart(e.ecart)}`} style={styles.ligne}>
                <Text style={[typo.petit, styles.nom, { color: p.texte }]}>{e.nom}</Text>
                <View style={styles.piste}>
                  <View style={[styles.centre, { borderLeftColor: p.traitFort }]} />
                  {e.ecart > 0 ? (
                    <View style={[styles.barre, { left: '50%', width: `${(e.ecart / echelle) * 50}%`, backgroundColor: p.sportCourse }]} />
                  ) : e.ecart < 0 ? (
                    <View style={[styles.barre, { right: '50%', width: `${(-e.ecart / echelle) * 50}%`, backgroundColor: p.ok }]} />
                  ) : null}
                </View>
                <Text style={[styles.valeur, { color: e.ecart > 0 ? p.alerte : e.ecart < 0 ? p.ok : p.texteDoux }]}>{formatEcart(e.ecart)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>
          {test ? 'Fixe un objectif de temps dans ' : 'Saisis un test et fixe un objectif dans '}
          tes tests Hyrox pour voir où gagner du temps.
        </Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  liste: { gap: 7 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nom: { width: 104 },
  piste: { flex: 1, height: 10 },
  centre: { position: 'absolute', left: '50%', top: -3, bottom: -3, borderLeftWidth: 1 },
  barre: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3 },
  valeur: { width: 56, textAlign: 'right', fontFamily: police.texte600, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
