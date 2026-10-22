import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import { formatNombre } from '@/data/format';
import { prepaNatation } from '@/data/natation';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Où tu en es de la distance de ta prochaine course de natation (traversée, eau libre) : ta plus longue séance des 12 dernières semaines face à elle.
//  - XS : le pourcentage ; S : + la barre de progression ; M : + les chiffres en liste ; L : + ton volume des 4 dernières semaines.
const metres = (km: number) => formatNombre(Math.round(km * 1000));

export function WidgetNatPrepa({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const prepa = prepaNatation(contexte.toutesSeances, contexte.objectifs);
  const { cible } = prepa;
  const aNage = prepa.plusLongue > 0;

  const barre = (pct: number) => (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Ta plus longue séance : ${pct} % de la distance de la course`} accessibilityValue={{ min: 0, max: 100, now: Math.min(100, pct) }} style={[styles.piste, { backgroundColor: p.surface2 }]}>
      <View style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%`, height: '100%', backgroundColor: p.sportNatation, borderRadius: 5 }} />
    </View>
  );

  if (taille !== 'l') {
    return (
      <Tuile
        titre="Prépa distance"
        valeur={cible && prepa.pctDistance != null ? `${prepa.pctDistance} %` : aNage ? metres(prepa.plusLongue) : '—'}
        unite={!cible && aNage ? 'm' : ''}
        note={cible ? `de la distance de ${cible.nom}` : aNage ? 'ta plus longue séance, pas de course visée' : 'Pas encore de natation'}
        large
      >
        {!cible || prepa.pctDistance == null ? null : taille === 's' ? (
          barre(prepa.pctDistance)
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre(prepa.pctDistance)}
            <ListeCompacte
              lignes={[
                { cle: 'longue', nom: 'Ta plus longue', valeur: `${metres(prepa.plusLongue)} m` },
                { cle: 'course', nom: 'La course', valeur: `${metres(cible.km)} m` },
                { cle: 'semaines', nom: '4 dernières semaines', valeur: `${formatNombre(prepa.metres4Semaines)} m` },
              ]}
            />
          </View>
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Prépa distance">
      {cible && prepa.pctDistance != null ? (
        <>
          <Text style={[styles.valeur, { color: p.texte }]}>
            J-{cible.joursRestants}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {cible.nom}</Text>
          </Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>{metres(cible.km)} m à nager</Text>
          <View style={styles.bloc}>
            <View style={styles.entete}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Ta plus longue séance</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                {metres(prepa.plusLongue)} m sur {metres(cible.km)} m · {prepa.pctDistance} %
              </Text>
            </View>
            {barre(prepa.pctDistance)}
          </View>
          <View style={styles.reperes}>
            <StatCle etiquette="4 dernières semaines" valeur={formatNombre(prepa.metres4Semaines)} unite="m" petit />
            <StatCle etiquette="Par semaine" valeur={formatNombre(prepa.metresParSemaine)} unite="m" petit />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
            Ta plus longue séance des 12 dernières semaines, comparée à la distance de la course. Au-delà de 100 %, tu as déjà nagé en une séance plus que la course n'en demande.
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>
          {aNage
            ? `Pas de course de natation à venir avec sa distance. Ta plus longue séance : ${metres(prepa.plusLongue)} m. Ajoute ta course, avec sa distance, pour mesurer ta préparation.`
            : 'Pas encore de natation ni de course à venir avec une distance.'}
        </Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  bloc: { gap: 6, marginTop: 14 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  reperes: { flexDirection: 'row', gap: 32, marginTop: 16 },
});
