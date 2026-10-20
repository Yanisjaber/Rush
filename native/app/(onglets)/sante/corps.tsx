import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { ChampMesure } from '@/components/ChampMesure';
import { CourbeLissee } from '@/components/CourbeLissee';
import { EcranSection } from '@/components/EcranSection';
import { SelecteurJour } from '@/components/SelecteurJour';
import { dateIsoLocale } from '@/data/format';
import { defMesure } from '@/data/sante-catalogue';
import { alerteVariation, lisser, serieDe, variationHebdo } from '@/data/suivi-corps';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const virgule = (n: number, d = 1) => n.toFixed(d).replace('.', ',');
const signe = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '');

// Le corps : poids, masse grasse, masse musculaire, tension. Ce sont des TENDANCES lentes : le poids varie de centaines de grammes d'un jour
// à l'autre (eau, sel), donc on regarde la courbe lissée sur 7 jours, jamais la valeur du jour. Rien ici ne bouge l'état de forme du jour.
export default function Corps() {
  const p = usePalette();
  const [date, setDate] = useState(dateIsoLocale(new Date()));
  const [message, setMessage] = useState('');
  const { mesures, enregistrer, erreur, demo } = useMesuresSante();
  const jour = mesures[date] ?? {};

  const poids = lisser(serieDe(mesures, 'poids_kg')).slice(-90);
  const variation = variationHebdo(lisser(serieDe(mesures, 'poids_kg')));
  const alerte = alerteVariation(variation);
  const dernierPoids = poids[poids.length - 1];

  async function saisir(metric: string, valeur: number | null) {
    setMessage('');
    if (await enregistrer(date, metric, valeur)) setMessage('Enregistré');
  }

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
          {dernierPoids ? (
            <>
              <View style={styles.valeurLigne}>
                <Text accessibilityLabel={`Poids lissé ${virgule(dernierPoids.lisse)} kilos`} style={[styles.valeur, { color: p.texte }]}>
                  {virgule(dernierPoids.lisse)}
                </Text>
                <Text style={[typo.corpsFort, { color: p.texteDoux }]}>kg · tendance sur 7 jours</Text>
              </View>
              {variation ? (
                <Text style={[typo.corps, { color: p.texteDoux }]}>
                  {variation.pctParSemaine === 0 ? 'Stable' : `${signe(variation.parSemaine)}${virgule(Math.abs(variation.parSemaine), 2)} kg par semaine (${signe(variation.pctParSemaine)}${virgule(Math.abs(variation.pctParSemaine))} %)`}
                </Text>
              ) : (
                <Text style={[typo.corps, { color: p.texteDoux }]}>Il faut au moins une semaine de pesées pour voir la tendance.</Text>
              )}
              {alerte ? (
                <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface2, borderLeftColor: p.alerte, marginTop: 10 }]}>
                  <Text style={[typo.petit, { color: p.texte }]}>
                    {alerte === 'perte_rapide'
                      ? "Perte rapide : plus de 1 % de ton poids par semaine. Si ce n'est pas voulu, vérifie ton apport d'énergie : c'est trop rapide pour un sportif."
                      : 'Prise rapide : plus de 1 % de ton poids par semaine. Ça peut être de la rétention d\'eau ou un excès : regarde sur une ou deux semaines de plus.'}
                  </Text>
                </View>
              ) : null}
              {poids.length > 1 ? (
                <View style={{ marginTop: 12 }}>
                  <CourbeLissee valeurs={poids.map((pt) => pt.lisse)} couleur={p.texte} hauteur={80} etiquette={`Poids lissé sur ${poids.length} jours`} />
                </View>
              ) : null}
              <Text style={[typo.petit, { color: p.texteMuet, marginTop: 8 }]}>Le poids du jour varie avec l'eau et le sel : on suit la tendance, pas la valeur du jour.</Text>
            </>
          ) : (
            <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de pesée. Saisis ton poids ci-dessous.</Text>
          )}
        </Bloc>

        <TendanceSimple titre="Masse grasse" metric="masse_grasse_pct" unite="%" decimales={1} />
        <TendanceSimple titre="Masse musculaire" metric="masse_musculaire_kg" unite="kg" decimales={1} />

        <Bloc titre="Saisir ce jour-là">
          {(['poids_kg', 'masse_grasse_pct', 'masse_musculaire_kg', 'tension_sys', 'tension_dia'] as const).map((cle) => {
            const def = defMesure(cle);
            return def ? <ChampMesure key={cle} def={def} valeur={jour[cle]} onChange={(v) => void saisir(cle, v)} /> : null;
          })}
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok, marginTop: 10, minHeight: 20 }]}>
            {message}
          </Text>
        </Bloc>
      </View>
    </EcranSection>
  );
}

// Une mesure lente avec sa dernière valeur, son écart sur 30 jours et sa courbe
function TendanceSimple({ titre, metric, unite, decimales }: { titre: string; metric: string; unite: string; decimales: number }) {
  const p = usePalette();
  const { mesures } = useMesuresSante();
  const serie = serieDe(mesures, metric).slice(-60);
  if (!serie.length) return null;
  const derniere = serie[serie.length - 1];
  const ancienne = [...serie].reverse().find((pt) => (new Date(`${derniere.date}T12:00:00`).getTime() - new Date(`${pt.date}T12:00:00`).getTime()) / 86400000 >= 28);
  const ecart = ancienne ? derniere.valeur - ancienne.valeur : null;
  return (
    <Bloc titre={titre}>
      <View style={styles.valeurLigne}>
        <Text style={[styles.valeurMoyenne, { color: p.texte }]}>{virgule(derniere.valeur, decimales)}</Text>
        <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{unite}</Text>
      </View>
      {ecart != null ? <Text style={[typo.petit, { color: p.texteDoux }]}>{signe(ecart)}{virgule(Math.abs(ecart), decimales)} {unite} sur 30 jours</Text> : null}
      {serie.length > 1 ? (
        <View style={{ marginTop: 8 }}>
          <CourbeLissee valeurs={serie.map((pt) => pt.valeur)} couleur={p.texte} hauteur={60} aire={false} etiquette={`${titre} sur ${serie.length} mesures`} />
        </View>
      ) : null}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  valeurLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  valeur: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  valeurMoyenne: { fontFamily: police.titre700, fontSize: 32, lineHeight: 36 },
});
