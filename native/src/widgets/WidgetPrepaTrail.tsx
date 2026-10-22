import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import { formatKm, formatNombre } from '@/data/format';
import { prepaDenivele, type SportDenivele } from '@/data/trail';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Où tu en es du dénivelé de ta prochaine course (trail ou VTT) : ton plus gros D+ en une sortie (12 semaines) face au D+ de la course.
//  - XS : le pourcentage ; S : + la barre de progression ; M : + les chiffres en liste ;
//  - L : le D+ et la distance face à la course, et ton dénivelé des 4 dernières semaines.
export function PrepaDenivele({ contexte, taille = 'm', sport }: WidgetProps & { sport: SportDenivele }) {
  const p = usePalette();
  const prepa = prepaDenivele(contexte.toutesSeances, contexte.objectifs, sport);
  const couleur = sport === 'vtt' ? p.sportVelo : p.sportCourse;
  const nomSport = sport === 'vtt' ? 'VTT' : 'trail';
  const { cible } = prepa;
  const aDesSorties = prepa.meilleureDPlus > 0 || prepa.dPlus4Semaines > 0;

  const barre = (pct: number, etiquette: string) => (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={etiquette} accessibilityValue={{ min: 0, max: 100, now: Math.min(100, pct) }} style={[styles.piste, { backgroundColor: p.surface2 }]}>
      <View style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%`, height: '100%', backgroundColor: couleur, borderRadius: 5 }} />
    </View>
  );

  if (taille !== 'l') {
    const valeur = cible && prepa.pctDPlus != null ? `${prepa.pctDPlus} %` : aDesSorties ? formatNombre(prepa.meilleureDPlus) : '—';
    const unite = !cible && aDesSorties ? 'm' : '';
    const note = cible ? `du D+ de ${cible.nom}` : aDesSorties ? 'ton plus gros D+, pas de course visée' : `Pas encore de ${nomSport}`;
    return (
      <Tuile titre="Prépa dénivelé" valeur={valeur} unite={unite} note={note} large>
        {!cible || prepa.pctDPlus == null ? null : taille === 's' ? (
          barre(prepa.pctDPlus, `Ton plus gros dénivelé en une sortie : ${prepa.pctDPlus} % de celui de ${cible.nom}`)
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre(prepa.pctDPlus, `Ton plus gros dénivelé en une sortie : ${prepa.pctDPlus} % de celui de ${cible.nom}`)}
            <ListeCompacte
              lignes={[
                { cle: 'sortie', nom: 'Ta plus grosse sortie', valeur: `${formatNombre(prepa.meilleureDPlus)} m` },
                { cle: 'cible', nom: 'D+ de la course', valeur: `${formatNombre(cible.dPlus)} m` },
                { cle: 'semaines', nom: '4 dernières semaines', valeur: `${formatNombre(prepa.dPlus4Semaines)} m` },
              ]}
            />
          </View>
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Prépa dénivelé">
      {cible ? (
        <>
          <Text style={[styles.valeur, { color: p.texte }]}>
            J-{cible.joursRestants}
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}> {cible.nom}</Text>
          </Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>
            {[cible.km ? `${formatKm(cible.km, 0)} km` : '', `${formatNombre(cible.dPlus)} m de D+`].filter(Boolean).join(' · ')}
          </Text>

          <View style={styles.bloc}>
            <View style={styles.entete}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Dénivelé</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                {formatNombre(prepa.meilleureDPlus)} m sur {formatNombre(cible.dPlus)} m · {prepa.pctDPlus} %
              </Text>
            </View>
            {barre(prepa.pctDPlus ?? 0, `Dénivelé : ${prepa.pctDPlus} % de celui de la course`)}
          </View>

          {prepa.pctDistance != null && cible.km ? (
            <View style={styles.bloc}>
              <View style={styles.entete}>
                <Text style={[typo.corpsFort, { color: p.texte }]}>Distance</Text>
                <Text style={[typo.petit, { color: p.texteDoux }]}>
                  {formatKm(prepa.meilleureDistance)} km sur {formatKm(cible.km, 0)} km · {prepa.pctDistance} %
                </Text>
              </View>
              {barre(prepa.pctDistance, `Distance : ${prepa.pctDistance} % de celle de la course`)}
            </View>
          ) : null}

          <View style={styles.reperes}>
            <StatCle etiquette="4 dernières semaines" valeur={formatNombre(prepa.dPlus4Semaines)} unite="m" petit />
            <StatCle etiquette="Par semaine" valeur={formatNombre(prepa.dPlusParSemaine)} unite="m" petit />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
            Ta plus grosse sortie des 12 dernières semaines, comparée à la course. Au-delà de 100 %, tu as déjà fait en une sortie plus de dénivelé que la course n'en demande.
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>
          {aDesSorties
            ? `Pas de course à venir avec un dénivelé. Ton plus gros D+ en une sortie : ${formatNombre(prepa.meilleureDPlus)} m. Ajoute ta course, avec son D+, pour mesurer ta préparation.`
            : `Pas encore de sortie de ${nomSport} ni de course à venir avec un dénivelé.`}
        </Text>
      )}
    </CadreWidget>
  );
}

export function WidgetPrepaTrail(props: WidgetProps) {
  return <PrepaDenivele {...props} sport="trail" />;
}

const styles = StyleSheet.create({
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  bloc: { gap: 6, marginTop: 14 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  reperes: { flexDirection: 'row', gap: 32, marginTop: 16 },
});
