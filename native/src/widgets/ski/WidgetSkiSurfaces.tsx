import { StyleSheet, Text, View } from 'react-native';
import { BarresEmpilees } from '@/components/BarresEmpilees';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { formatHeuresMinutes, formatKm } from '@/data/outils/format';
import { minutesParSemaineSurfaces, repartitionSurfaces, type Surface } from '@/data/sports/ski';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Où tu skies : sur la neige, en ski à roulettes (l'entraînement de l'été et de l'automne) ou en hors-piste, sur 12 semaines.
//  - XS : la surface où tu passes le plus de temps ; S : + la barre ; M : + le temps et les kilomètres de chacune ;
//  - L : + le temps de chaque semaine, empilé, sur 8 semaines. Hors saison, tout est en roulettes : c'est normal.
const NOM: Record<Surface, string> = { neige: 'Neige', roulettes: 'Roulettes', horspiste: 'Hors-piste' };

export function WidgetSkiSurfaces({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const rep = repartitionSurfaces(contexte.toutesSeances);
  // La neige pleine, les roulettes à moitié, le hors-piste plus pâle : une seule couleur (le ski n'en a pas) avec trois opacités
  const couleur = (s: Surface) => (s === 'neige' ? p.sportNeutre : s === 'roulettes' ? avecAlpha(p.sportNeutre, 0.6) : avecAlpha(p.sportNeutre, 0.3));

  const barre = rep ? (
    <View accessible accessibilityRole="image" accessibilityLabel={`Temps par surface : ${rep.parts.map((x) => `${NOM[x.cle]} ${x.pct} %`).join(', ')}`} style={styles.barre}>
      {rep.parts.map((x) => (x.temps > 0 ? <View key={x.cle} style={{ flex: x.temps, backgroundColor: couleur(x.cle) }} /> : null))}
    </View>
  ) : null;

  if (taille !== 'l') {
    const dom = rep ? [...rep.parts].sort((a, b) => b.temps - a.temps)[0] : null;
    return (
      <Tuile titre="Neige ou roulettes" valeur={dom ? NOM[dom.cle] : '—'} note={dom ? `${dom.pct} % du temps` : 'Pas de ski récent'} large>
        {!rep ? null : taille === 's' ? (
          barre
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre}
            <ListeCompacte lignes={rep.parts.map((x) => ({ cle: x.cle, nom: NOM[x.cle], valeur: `${formatHeuresMinutes(x.temps)} · ${formatKm(x.km, 0)} km`, point: couleur(x.cle) }))} />
          </View>
        ) : null}
      </Tuile>
    );
  }

  const semaines = minutesParSemaineSurfaces(contexte.toutesSeances, 8);
  return (
    <CadreWidget titre="Neige ou roulettes">
      {rep ? (
        <>
          <Text style={[styles.total, { color: p.texte }]}>
            {formatHeuresMinutes(rep.total)}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> de ski, 12 semaines</Text>
          </Text>
          {barre}
          <View style={styles.parts}>
            {rep.parts.map((x) => (
              <View key={x.cle} accessible accessibilityLabel={`${NOM[x.cle]}, ${formatHeuresMinutes(x.temps)}, ${formatKm(x.km, 0)} kilomètres, ${x.pct} %`} style={styles.part}>
                <View style={[styles.carre, { backgroundColor: couleur(x.cle) }]} />
                <View>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>{NOM[x.cle]}</Text>
                  <Text style={[styles.pct, { color: p.texte }]}>{x.pct} %</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>
                    {formatHeuresMinutes(x.temps)} · {formatKm(x.km, 0)} km
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte, marginTop: 16, marginBottom: 6 }]}>
            Semaine après semaine
          </Text>
          <BarresEmpilees
            series={semaines.map((s) => ({ nom: NOM[s.cle], couleur: couleur(s.cle), valeurs: s.minutes }))}
            etiquettes={[]}
            hauteur={110}
            etiquette="Temps par semaine et par surface sur 8 semaines : neige, roulettes, hors-piste"
          />
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Hors saison, le ski à roulettes remplace la neige : c'est normal de ne voir que lui l'été.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas de ski sur les 12 dernières semaines (neige, roulettes ou hors-piste).</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2 },
  total: { fontFamily: police.titre700, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'], marginBottom: 10 },
  parts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  part: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  carre: { width: 10, height: 10, borderRadius: 2, marginTop: 5 },
  pct: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
});
