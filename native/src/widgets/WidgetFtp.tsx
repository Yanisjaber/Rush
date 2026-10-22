import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { CourbeLissee } from '@/components/CourbeLissee';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import type { WidgetProps } from '@/data/types';
import { evolutionFtp } from '@/data/velo';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ta FTP au fil des semaines, d'après celle enregistrée avec chacune de tes sorties à vélo (26 semaines).
export function WidgetFtp({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const e = evolutionFtp(contexte.toutesSeances);
  const evolution = e?.evolutionPct != null ? `${e.evolutionPct > 0 ? '+' : ''}${e.evolutionPct.toString().replace('.', ',')} % en 6 mois` : e ? 'stable' : '';
  const monte = !!e && (e.evolutionPct ?? 0) > 0;
  // Une courbe a besoin d'au moins deux points
  const courbe = !!e && e.parSemaine.length >= 2;

  // XS : la FTP ; S : + la courbe ; M : + la courbe remplie, plus grande ; L : + trois repères (début, aujourd'hui, record)
  if (taille !== 'l') {
    return (
      <Tuile titre="FTP" valeur={e ? String(e.actuelle) : '—'} unite={e ? 'W' : ''} note={e ? evolution : 'Pas de FTP enregistrée'} large>
        {!e || !courbe ? null : taille === 's' ? (
          <CourbeLissee valeurs={e.parSemaine} couleur={p.sportVelo} hauteur={34} aire={false} pointFinal={false} etiquette="Ta FTP sur 6 mois" />
        ) : taille === 'm' ? (
          <CourbeLissee valeurs={e.parSemaine} couleur={p.sportVelo} largeur={220} hauteur={90} etiquette="Ta FTP sur 6 mois" />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="FTP">
      {e ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {e.actuelle}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> W</Text>
            </Text>
            <View style={[styles.badge, { backgroundColor: monte ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
              <Text style={[typo.petit, styles.badgeTexte, { color: monte ? p.ok : p.texteDoux }]}>{evolution}</Text>
            </View>
          </View>
          {courbe ? <CourbeLissee valeurs={e.parSemaine} couleur={p.sportVelo} hauteur={92} etiquette="Ta FTP sur 6 mois" /> : null}
          <View style={styles.reperes}>
            <StatCle etiquette="Au début" valeur={String(e.parSemaine[0])} unite="W" petit />
            <StatCle etiquette="Aujourd'hui" valeur={String(e.actuelle)} unite="W" petit />
            <StatCle etiquette="Record" valeur={String(e.meilleure)} unite="W" petit />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>La FTP enregistrée avec ta dernière sortie de chaque semaine. Sans sortie, elle reste celle d'avant.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de FTP enregistrée avec tes sorties à vélo.</Text>
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
