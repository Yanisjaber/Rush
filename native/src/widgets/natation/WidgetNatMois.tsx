import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { ListeCompacte } from '@/components/ui/ListeCompacte';
import { MiniBarres } from '@/components/graphes/MiniBarres';
import { StatCle } from '@/components/ui/StatCle';
import { Tuile } from '@/components/ui/Tuile';
import { formatDuree, formatNombre } from '@/data/outils/format';
import { bilanMoisNatation } from '@/data/sports/natation';
import type { WidgetProps } from '@/data/types';
import { avecAlpha } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ce que tu as nagé ce mois-ci, face au mois d'avant au MÊME jour du mois (on n'oppose pas dix jours à trente et un).
//  - XS : les mètres du mois ; S : + les deux barres (mois d'avant, ce mois-ci) ; M : + le détail en liste ;
//  - L : + les trois barres (ce mois-ci, mois d'avant au même jour, mois d'avant en entier) et les chiffres.
const nomMois = (annee: number, mois: number) => new Date(annee, mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });

export function WidgetNatMois({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const b = bilanMoisNatation(contexte.toutesSeances);
  const aNage = b.actuel.metres > 0;
  const precedent = nomMois(b.mois === 1 ? b.annee - 1 : b.annee, b.mois === 1 ? 12 : b.mois - 1);
  const moisCourant = nomMois(b.annee, b.mois);
  const ecart = b.ecartPct != null ? `${b.ecartPct > 0 ? '+' : ''}${b.ecartPct} % vs ${precedent}` : '';
  const moyenne = b.actuel.seances ? Math.round(b.actuel.metres / b.actuel.seances) : 0;

  if (taille !== 'l') {
    return (
      <Tuile titre="Ce mois-ci" valeur={aNage ? formatNombre(b.actuel.metres) : '—'} unite={aNage ? 'm' : ''} note={aNage ? ecart || `${b.actuel.seances} séance${b.actuel.seances > 1 ? 's' : ''}` : 'Pas encore nagé'} large>
        {!aNage ? null : taille === 's' ? (
          <MiniBarres valeurs={[b.precedentMemeJour.metres, b.actuel.metres]} couleur={p.sportNatation} etiquette={`Mètres nagés : ${formatNombre(b.precedentMemeJour.metres)} en ${precedent} au même jour, ${formatNombre(b.actuel.metres)} ce mois-ci`} />
        ) : taille === 'm' ? (
          <ListeCompacte
            lignes={[
              { cle: 'seances', nom: 'Séances', valeur: String(b.actuel.seances) },
              { cle: 'temps', nom: 'Temps', valeur: formatDuree(b.actuel.secondes) },
              { cle: 'moy', nom: 'Par séance', valeur: `${formatNombre(moyenne)} m` },
              { cle: 'prec', nom: `${precedent} (même jour)`, valeur: `${formatNombre(b.precedentMemeJour.metres)} m` },
            ]}
          />
        ) : null}
      </Tuile>
    );
  }

  const maxi = Math.max(1, b.actuel.metres, b.precedentMemeJour.metres, b.precedent.metres);
  const barre = (etiquette: string, metres: number, couleur: string) => (
    <View accessible accessibilityLabel={`${etiquette} : ${formatNombre(metres)} mètres`} style={{ gap: 4 }}>
      <View style={styles.enteteBarre}>
        <Text style={[typo.petit, { color: p.texte }]}>{etiquette}</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>{formatNombre(metres)} m</Text>
      </View>
      <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
        <View style={{ width: `${Math.max(metres > 0 ? 3 : 0, (metres / maxi) * 100)}%`, height: '100%', backgroundColor: couleur, borderRadius: 5 }} />
      </View>
    </View>
  );

  return (
    <CadreWidget titre={`Natation de ${moisCourant}`}>
      {aNage || b.precedent.metres > 0 ? (
        <>
          <View style={styles.entete}>
            <Text style={[styles.valeur, { color: p.texte }]}>
              {formatNombre(b.actuel.metres)}
              <Text style={[typo.corpsFort, { color: p.texteDoux }]}> m en {b.jour} jour{b.jour > 1 ? 's' : ''}</Text>
            </Text>
            {ecart ? (
              <View style={[styles.badge, { backgroundColor: (b.ecartPct ?? 0) >= 0 ? avecAlpha(p.ok, 0.16) : p.surface2 }]}>
                <Text style={[typo.petit, styles.badgeTexte, { color: (b.ecartPct ?? 0) >= 0 ? p.ok : p.texteDoux }]}>{ecart}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ gap: 10 }}>
            {barre(`${moisCourant[0].toUpperCase()}${moisCourant.slice(1)}`, b.actuel.metres, p.sportNatation)}
            {barre(`${precedent[0].toUpperCase()}${precedent.slice(1)}, même jour`, b.precedentMemeJour.metres, avecAlpha(p.sportNatation, 0.5))}
            {barre(`${precedent[0].toUpperCase()}${precedent.slice(1)}, en entier`, b.precedent.metres, avecAlpha(p.sportNatation, 0.3))}
          </View>
          <View style={styles.reperes}>
            <StatCle etiquette="Séances" valeur={String(b.actuel.seances)} petit />
            <StatCle etiquette="Temps" valeur={formatDuree(b.actuel.secondes)} petit />
            <StatCle etiquette="Par séance" valeur={formatNombre(moyenne)} unite="m" petit />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>Ce mois-ci jusqu'à aujourd'hui, comparé au mois d'avant jusqu'au même jour.</Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Pas de natation ce mois-ci ni le mois dernier.</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  enteteBarre: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
  reperes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  badgeTexte: { fontFamily: police.texte600 },
});
