import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Bloc } from '@/components/Bloc';
import { ChampMesure } from '@/components/ChampMesure';
import { CourbeLissee } from '@/components/CourbeLissee';
import { EcranSection } from '@/components/EcranSection';
import { SelecteurJour } from '@/components/SelecteurJour';
import { dateIsoLocale } from '@/data/outils/format';
import { defMesure, type MesuresParJour } from '@/data/sante/sante-catalogue';
import { alerteVariation, lisser, serieDe, variationHebdo } from '@/data/sante/suivi-corps';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const virgule = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

// Le corps : poids, masse grasse, masse musculaire, tension. Ce sont des TENDANCES lentes : le poids varie de centaines de grammes d'un jour
// à l'autre (eau, sel), donc on regarde la courbe lissée sur 7 jours, jamais la valeur du jour. Rien ici ne bouge l'état de forme du jour.
// Même esprit que le reste de Santé : un gros chiffre, une flèche, une courbe, presque pas de phrases. Ici la flèche est NEUTRE (grise) :
// perdre ou prendre du poids n'est ni bien ni mal en soi, seule une variation trop rapide s'affiche en alerte.
export default function Corps() {
  const p = usePalette();
  const [date, setDate] = useState(dateIsoLocale(new Date()));
  const [message, setMessage] = useState('');
  const { mesures, enregistrer, erreur, demo } = useMesuresSante();
  const jour = mesures[date] ?? {};

  const lisses = lisser(serieDe(mesures, 'poids_kg'));
  const poids = lisses.slice(-90);
  const variation = variationHebdo(lisses);
  const alerte = alerteVariation(variation);
  const dernierPoids = poids[poids.length - 1];

  async function saisir(metric: string, valeur: number | null) {
    setMessage('');
    if (await enregistrer(date, metric, valeur)) setMessage(demo ? 'Noté (démo : non enregistré)' : 'Enregistré');
  }

  // La tension se lit en paire : la dernière fois où les deux chiffres ont été saisis le MÊME jour (sinon on mélangerait deux jours)
  const jourTension = Object.keys(mesures).sort().reverse().find((d) => mesures[d].tension_sys != null && mesures[d].tension_dia != null);
  const tension = jourTension ? `${mesures[jourTension].tension_sys}/${mesures[jourTension].tension_dia}` : null;

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        <SelecteurJour date={date} onChange={(d) => { setDate(d); setMessage(''); }} />
        {demo ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : tes saisies restent en mémoire, rien n'est enregistré.</Text> : null}
        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}

        <Bloc titre="Poids">
          <View style={styles.valeurLigne}>
            <Text accessibilityLabel={dernierPoids ? `Poids lissé ${virgule(dernierPoids.lisse)} kilos` : 'Pas encore de pesée'} style={[styles.valeur, { color: dernierPoids ? p.texte : p.texteMuet }]}>
              {dernierPoids ? virgule(dernierPoids.lisse) : '—'}
            </Text>
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}>kg</Text>
          </View>
          <View style={styles.puces}>
            {variation && variation.pctParSemaine !== 0 ? (
              <View accessible accessibilityLabel={`${variation.parSemaine > 0 ? 'Plus' : 'Moins'} ${virgule(Math.abs(variation.parSemaine), 2)} kilo par semaine`} style={styles.variation}>
                <Fleche haut={variation.parSemaine > 0} couleur={alerte ? p.alerte : p.texteDoux} />
                <Text style={[typo.corpsFort, { color: alerte ? p.alerte : p.texteDoux }]}>{virgule(Math.abs(variation.parSemaine), 2)} kg / sem.</Text>
              </View>
            ) : null}
            {alerte ? (
              // L'explication complète (apport d'énergie, rétention d'eau) reste lue par VoiceOver
              <View
                accessible
                accessibilityRole="alert"
                accessibilityLabel={alerte === 'perte_rapide' ? "Perte rapide : plus de 1 % du poids par semaine. Si ce n'est pas voulu, vérifie ton apport d'énergie." : "Prise rapide : plus de 1 % du poids par semaine. Ça peut être de la rétention d'eau : regarde une ou deux semaines de plus."}
                style={[styles.puce, { borderColor: p.alerte }]}
              >
                <Text style={[typo.micro, { color: p.alerte }]}>{alerte === 'perte_rapide' ? 'Perte rapide' : 'Prise rapide'} · plus de 1 % / sem.</Text>
              </View>
            ) : null}
          </View>
          {poids.length > 1 ? (
            <View style={{ marginTop: 12 }}>
              <CourbeLissee valeurs={poids.map((pt) => pt.lisse)} couleur={p.texte} hauteur={90} etiquette={`Poids lissé sur ${poids.length} jours`} />
            </View>
          ) : null}
          <Text style={[typo.micro, { color: p.texteMuet, marginTop: 8 }]}>tendance sur 7 jours</Text>
        </Bloc>

        <View style={styles.tuiles}>
          <Tuile mesures={mesures} titre="Gras" metric="masse_grasse_pct" unite="%" />
          <Tuile mesures={mesures} titre="Muscle" metric="masse_musculaire_kg" unite="kg" />
          <Tuile mesures={mesures} titre="Tension" metric="tension_sys" unite="mmHg" texte={tension ?? '—'} />
        </View>

        <Bloc titre="Saisir ce jour-là">
          <View style={styles.champs}>
            {(['poids_kg', 'masse_grasse_pct', 'masse_musculaire_kg', 'tension_sys', 'tension_dia'] as const).map((cle) => {
              const def = defMesure(cle);
              return def ? (
                <View key={cle} style={styles.champ}>
                  <ChampMesure def={def} valeur={jour[cle]} onChange={(v) => void saisir(cle, v)} aideVisible={false} />
                </View>
              ) : null;
            })}
          </View>
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok, marginTop: 10, minHeight: 20 }]}>
            {message}
          </Text>
        </Bloc>
      </View>
    </EcranSection>
  );
}

// Un triangle neutre : haut = ça monte, bas = ça descend
function Fleche({ haut, couleur }: { haut: boolean; couleur: string }) {
  return (
    <Svg width={11} height={9} viewBox="0 0 10 8">
      <Path d={haut ? 'M5 0 L10 8 L0 8 Z' : 'M0 0 L10 0 L5 8 Z'} fill={couleur} />
    </Svg>
  );
}

// Une mesure lente en tuile : son nom, sa dernière valeur, l'écart sur 30 jours (flèche grise) et une mini-courbe.
// Sans mesure, la tuile reste là avec un tiret : on voit ce qu'on peut suivre.
// Les mesures viennent de l'écran (état partagé) : la tuile se met à jour dès qu'on saisit.
function Tuile({ mesures, titre, metric, unite, texte }: { mesures: MesuresParJour; titre: string; metric: string; unite: string; texte?: string }) {
  const p = usePalette();
  const serie = serieDe(mesures, metric).slice(-60);
  const derniere = serie[serie.length - 1];
  const ancienne = derniere ? [...serie].reverse().find((pt) => (new Date(`${derniere.date}T12:00:00`).getTime() - new Date(`${pt.date}T12:00:00`).getTime()) / 86400000 >= 28) : undefined;
  const ecart = derniere && ancienne ? derniere.valeur - ancienne.valeur : null;
  const valeur = texte ?? (derniere ? virgule(derniere.valeur) : '—');
  const sansMesure = valeur === '—';
  return (
    <View accessible accessibilityLabel={!sansMesure ? `${titre} : ${valeur} ${unite}${ecart ? `, ${ecart > 0 ? 'plus' : 'moins'} ${virgule(Math.abs(ecart))} sur 30 jours` : ''}` : `${titre} : pas de mesure`} style={[styles.tuile, { backgroundColor: p.surface }]}>
      <Text numberOfLines={1} style={[typo.micro, { color: p.texteDoux }]}>{titre}</Text>
      <View style={styles.valeurLigne}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.valeurTuile, { color: !sansMesure ? p.texte : p.texteMuet }]}>{valeur}</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>{unite}</Text>
      </View>
      <View style={styles.variation}>
        {ecart ? (
          <>
            <Fleche haut={ecart > 0} couleur={p.texteDoux} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>{virgule(Math.abs(ecart))}</Text>
          </>
        ) : null}
      </View>
      {serie.length > 1 ? <CourbeLissee valeurs={serie.map((pt) => pt.valeur)} couleur={p.texteDoux} hauteur={40} aire={false} epaisseur={2} etiquette={`${titre} sur ${serie.length} mesures`} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  valeurLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  valeur: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, minHeight: 4 },
  variation: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 20 },
  puce: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  tuiles: { flexDirection: 'row', gap: 10 },
  tuile: { flex: 1, borderRadius: rayon.bloc, paddingHorizontal: 12, paddingVertical: 12, gap: 2 },
  valeurTuile: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, flexShrink: 1 },
  champs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  champ: { width: '47%', flexGrow: 1 },
});
