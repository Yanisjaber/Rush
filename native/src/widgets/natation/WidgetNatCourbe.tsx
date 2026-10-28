import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { CourbeLissee } from '@/components/graphes/CourbeLissee';
import { StatCle } from '@/components/ui/StatCle';
import { Tuile } from '@/components/ui/Tuile';
import { allureParSemaineNatation } from '@/data/sports/natation';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ton allure de natation au 100 m, semaine après semaine (les semaines sans natation sont sautées) : elle baisse quand tu progresses.
//  - XS : l'allure du moment et son évolution ; S : + la courbe ; M : + la courbe remplie, plus grande ;
//  - L : + trois repères (première semaine, aujourd'hui, meilleure semaine).
const minSec = (s: number) => `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;

export function WidgetNatCourbe({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const a = allureParSemaineNatation(contexte.toutesSeances);
  // Une allure plus basse est plus rapide : on inverse pour que « mieux » monte sur la courbe
  const valeurs = a ? a.points.map((v) => -v) : [];
  const courbe = valeurs.length >= 2;
  const mieux = !!a && (a.evolutionPct ?? 0) < 0;
  const evolution = a?.evolutionPct != null ? `${Math.abs(a.evolutionPct).toString().replace('.', ',')} % ${a.evolutionPct < 0 ? 'plus rapide' : a.evolutionPct > 0 ? 'plus lent' : 'stable'}` : '1 semaine nagée';

  if (taille !== 'l') {
    return (
      <Tuile titre="Allure par semaine" valeur={a ? minSec(a.actuelle) : '—'} unite={a ? '/100 m' : ''} note={a ? evolution : 'Pas assez de natation'} large>
        {!a || !courbe ? null : taille === 's' ? (
          <CourbeLissee valeurs={valeurs} couleur={p.sportNatation} hauteur={34} aire={false} pointFinal={false} etiquette="Allure de natation au 100 m semaine après semaine" />
        ) : taille === 'm' ? (
          <CourbeLissee valeurs={valeurs} couleur={p.sportNatation} largeur={220} hauteur={90} etiquette="Allure de natation au 100 m semaine après semaine" />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Allure semaine après semaine">
      {a ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {minSec(a.actuelle)}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> /100 m</Text>
            </Text>
            <View style={[styles.badge, { backgroundColor: mieux ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
              <Text style={[typo.petit, styles.badgeTexte, { color: mieux ? p.ok : p.texteDoux }]}>{evolution}</Text>
            </View>
          </View>
          {courbe ? <CourbeLissee valeurs={valeurs} couleur={p.sportNatation} hauteur={92} etiquette="Allure de natation au 100 m semaine après semaine" /> : null}
          <View style={styles.reperes}>
            <StatCle etiquette="Au début" valeur={minSec(a.premiere)} petit />
            <StatCle etiquette="Aujourd'hui" valeur={minSec(a.actuelle)} petit />
            <StatCle etiquette="Meilleure" valeur={minSec(a.meilleure)} petit />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Une allure par semaine nagée (au moins 300 m), sur 12 semaines. Plus c'est bas, plus tu nages vite.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de natation sur les 12 dernières semaines.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  reperes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
});
