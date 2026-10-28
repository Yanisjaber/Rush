import { StyleSheet, Text, View } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { StatCle } from '@/components/StatCle';
import { Tuile } from '@/components/Tuile';
import { formatKm, formatNombre } from '@/data/outils/format';
import { prepaNatation, type PrepaNatation } from '@/data/sports/natation';
import type { Taille, WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Où tu en es de la distance de ta prochaine course (une traversée à la nage, une course de ski de fond) : ta plus longue séance des 12 dernières semaines face à elle.
//  - XS : le pourcentage ; S : + la barre de progression ; M : + les chiffres en liste ; L : + ton volume des 4 dernières semaines.
// Le même widget sert à la natation (en mètres) et au ski de fond (en kilomètres) : voir PrepaDistance.
interface PropsPrepa {
  taille: Taille;
  prepa: PrepaNatation;
  couleur: string;
  /** Le sport, pour les phrases : « natation », « ski de fond ». */
  nomSport: string;
  unite: 'm' | 'km';
}

export function PrepaDistance({ taille, prepa, couleur, nomSport, unite }: PropsPrepa) {
  const p = usePalette();
  const { cible } = prepa;
  const aFait = prepa.plusLongue > 0;
  // Une distance en kilomètres, écrite en mètres pour la natation (2 400 m) et en kilomètres pour le ski (32 km)
  const nombre = (km: number) => (unite === 'm' ? formatNombre(Math.round(km * 1000)) : formatKm(km, km < 10 ? 1 : 0));
  const dist = (km: number) => `${nombre(km)} ${unite}`;
  const volume = (metres: number) => (unite === 'm' ? `${formatNombre(metres)} m` : `${formatKm(metres / 1000, 0)} km`);

  const barre = (pct: number) => (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Ta plus longue séance : ${pct} % de la distance de la course`} accessibilityValue={{ min: 0, max: 100, now: Math.min(100, pct) }} style={[styles.piste, { backgroundColor: p.surface2 }]}>
      <View style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%`, height: '100%', backgroundColor: couleur, borderRadius: 5 }} />
    </View>
  );

  if (taille !== 'l') {
    return (
      <Tuile
        titre="Prépa distance"
        valeur={cible && prepa.pctDistance != null ? `${prepa.pctDistance} %` : aFait ? nombre(prepa.plusLongue) : '—'}
        unite={!cible && aFait ? unite : ''}
        note={cible ? `de la distance de ${cible.nom}` : aFait ? 'ta plus longue séance, pas de course visée' : `Pas encore de ${nomSport}`}
        large
      >
        {!cible || prepa.pctDistance == null ? null : taille === 's' ? (
          barre(prepa.pctDistance)
        ) : taille === 'm' ? (
          <View style={{ gap: 8 }}>
            {barre(prepa.pctDistance)}
            <ListeCompacte
              lignes={[
                { cle: 'longue', nom: 'Ta plus longue', valeur: dist(prepa.plusLongue) },
                { cle: 'course', nom: 'La course', valeur: dist(cible.km) },
                { cle: 'semaines', nom: '4 dernières semaines', valeur: volume(prepa.metres4Semaines) },
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
          <Text style={[typo.petit, { color: p.texteDoux }]}>{dist(cible.km)} {unite === 'm' ? 'à nager' : 'à parcourir'}</Text>
          <View style={styles.bloc}>
            <View style={styles.entete}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>Ta plus longue séance</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                {dist(prepa.plusLongue)} sur {dist(cible.km)} · {prepa.pctDistance} %
              </Text>
            </View>
            {barre(prepa.pctDistance)}
          </View>
          <View style={styles.reperes}>
            <StatCle etiquette="4 dernières semaines" valeur={unite === 'm' ? formatNombre(prepa.metres4Semaines) : formatKm(prepa.metres4Semaines / 1000, 0)} unite={unite} petit />
            <StatCle etiquette="Par semaine" valeur={unite === 'm' ? formatNombre(prepa.metresParSemaine) : formatKm(prepa.metresParSemaine / 1000, 0)} unite={unite} petit />
          </View>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
            Ta plus longue séance des 12 dernières semaines, comparée à la distance de la course. Au-delà de 100 %, tu as déjà fait en une séance plus que la course n'en demande.
          </Text>
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>
          {aFait
            ? `Pas de course de ${nomSport} à venir avec sa distance. Ta plus longue séance : ${dist(prepa.plusLongue)}. Ajoute ta course, avec sa distance, pour mesurer ta préparation.`
            : `Pas encore de ${nomSport} ni de course à venir avec une distance.`}
        </Text>
      )}
    </CadreWidget>
  );
}

export function WidgetNatPrepa({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  return <PrepaDistance taille={taille} prepa={prepaNatation(contexte.toutesSeances, contexte.objectifs)} couleur={p.sportNatation} nomSport="natation" unite="m" />;
}

const styles = StyleSheet.create({
  piste: { height: 10, borderRadius: 5, overflow: 'hidden' },
  valeur: { fontFamily: police.titre700, fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  bloc: { gap: 6, marginTop: 14 },
  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  reperes: { flexDirection: 'row', gap: 32, marginTop: 16 },
});
