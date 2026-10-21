import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarresHebdo } from '@/components/BarresHebdo';
import { Bloc } from '@/components/Bloc';
import { ChampMesure } from '@/components/ChampMesure';
import { EcranSection } from '@/components/EcranSection';
import { SelecteurJour } from '@/components/SelecteurJour';
import { dateIsoLocale, formatNombre } from '@/data/format';
import { defMesure } from '@/data/sante-catalogue';
import { lisser, moyenneSur, proteinesParKg, serieDe, type NiveauProteines } from '@/data/suivi-corps';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NIVEAU_PROTEINES = { basse: 'Basse', limite: 'Limite', bonne: 'Bonne', haute: 'Élevée' } as const;
const virgule = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

// La piste des protéines va de 0,8 à 2,6 g par kilo ; la zone de repère (1,4 à 2,0) est dessinée dessus, le repère glisse à sa place.
const PISTE_MIN = 0.8;
const PISTE_MAX = 2.6;
const sur100 = (g: number) => Math.min(100, Math.max(0, ((g - PISTE_MIN) / (PISTE_MAX - PISTE_MIN)) * 100));

// La nutrition : ce que tu as mangé, avec les moyennes de la semaine. Les journaux alimentaires sont rarement exacts (ils sous-estiment souvent
// de 10 à 30 %) : on regarde les moyennes et les tendances, pas un jour isolé. Rien ici ne bouge l'état de forme du jour.
// Même esprit que le reste de Santé : un gros chiffre, des formes, presque pas de phrases.
export default function Nutrition() {
  const p = usePalette();
  const [date, setDate] = useState(dateIsoLocale(new Date()));
  const [message, setMessage] = useState('');
  const { mesures, enregistrer, erreur, demo } = useMesuresSante();
  const jour = mesures[date] ?? {};

  const kcal = moyenneSur(mesures, 'calories_kcal', 7, date);
  const prot = moyenneSur(mesures, 'proteines_g', 7, date);
  const eau = moyenneSur(mesures, 'eau_l', 7, date);
  const poids = lisser(serieDe(mesures, 'poids_kg')).pop();
  const parKg = proteinesParKg(prot?.moyenne, poids?.lisse);
  const quatorze = serieDe(mesures, 'calories_kcal').slice(-14).map((pt) => pt.valeur);

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

        <Bloc titre="Cette semaine">
          <View style={styles.valeurLigne}>
            <Text accessibilityLabel={kcal ? `${Math.round(kcal.moyenne)} calories par jour en moyenne` : 'Pas encore de repas saisi'} style={[styles.valeur, { color: kcal ? p.texte : p.texteMuet }]}>
              {kcal ? formatNombre(Math.round(kcal.moyenne)) : '—'}
            </Text>
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}>kcal / jour</Text>
          </View>
          {kcal ? (
            // Un point par jour sur les 7 derniers : rempli = jour renseigné
            <View accessible accessibilityLabel={`${kcal.n} jour${kcal.n > 1 ? 's' : ''} renseigné${kcal.n > 1 ? 's' : ''} sur 7`} style={styles.points}>
              {Array.from({ length: 7 }, (_, i) => (
                <View key={i} style={[styles.point, { backgroundColor: i < kcal.n ? p.texte : p.traitFort }]} />
              ))}
            </View>
          ) : null}
          {quatorze.length > 1 ? (
            <View style={{ marginTop: 12 }}>
              <BarresHebdo valeurs={quatorze} couleur={p.sportNeutre} hauteur={70} etiquette="Calories des 14 derniers jours renseignés" />
            </View>
          ) : null}
        </Bloc>

        <View style={styles.tuiles}>
          <View style={[styles.tuile, { backgroundColor: p.surface, flex: 1.7 }]} accessible accessibilityLabel={parKg ? `Protéines : ${virgule(parKg.gParKg, 2)} gramme par kilo, ${NIVEAU_PROTEINES[parKg.niveau]}. Repère : 1,4 à 2,0.` : 'Protéines : pas de mesure'}>
            <Text style={[typo.micro, { color: p.texteDoux }]}>Protéines</Text>
            <View style={styles.valeurLigne}>
              <Text style={[styles.valeurTuile, { color: prot ? p.texte : p.texteMuet }]}>{prot ? Math.round(prot.moyenne) : '—'}</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>g / jour</Text>
            </View>
            {parKg ? <PisteProteines gParKg={parKg.gParKg} niveau={parKg.niveau} /> : <View style={{ height: 22 }} />}
            <Text style={[typo.petit, { color: p.texteDoux, minHeight: 20 }]}>{parKg ? `${virgule(parKg.gParKg, 2)} g/kg · ${NIVEAU_PROTEINES[parKg.niveau]}` : ''}</Text>
          </View>
          <View style={[styles.tuile, { backgroundColor: p.surface, flex: 1 }]} accessible accessibilityLabel={eau ? `Eau : ${virgule(eau.moyenne)} litre par jour` : 'Eau : pas de mesure'}>
            <Text style={[typo.micro, { color: p.texteDoux }]}>Eau</Text>
            <View style={styles.valeurLigne}>
              <Text style={[styles.valeurTuile, { color: eau ? p.texte : p.texteMuet }]}>{eau ? virgule(eau.moyenne) : '—'}</Text>
              <Text style={[typo.petit, { color: p.texteDoux }]}>L / jour</Text>
            </View>
          </View>
        </View>

        <Bloc titre="Saisir ce jour-là">
          <View style={styles.champs}>
            {(['calories_kcal', 'proteines_g', 'eau_l'] as const).map((cle) => {
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

        <Text style={[typo.micro, { color: p.texteMuet }]}>moyennes sur 7 jours · les journaux sous-estiment souvent de 10 à 30 %</Text>
      </View>
    </EcranSection>
  );
}

// Les protéines par kilo sur une piste : la zone verte est le repère (1,4 à 2,0 g/kg), la pastille dit où tu en es.
// Dans la zone c'est vert, juste en dessous orange, très bas rouge ; au-dessus de 2,2 c'est plus que nécessaire (neutre, pas une alerte).
function PisteProteines({ gParKg, niveau }: { gParKg: number; niveau: NiveauProteines }) {
  const p = usePalette();
  const couleur = niveau === 'bonne' ? p.ok : niveau === 'limite' ? p.alerte : niveau === 'basse' ? p.danger : p.texteDoux;
  return (
    <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
      <View style={[styles.repere, { backgroundColor: avecAlpha(p.ok, 0.4), left: `${sur100(1.4)}%`, width: `${sur100(2.0) - sur100(1.4)}%` }]} />
      <View style={[styles.marqueur, { backgroundColor: couleur, borderColor: p.surface, left: `${sur100(gParKg)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  valeurLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  valeur: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  points: { flexDirection: 'row', gap: 6, marginTop: 6 },
  point: { width: 10, height: 10, borderRadius: 5 },
  tuiles: { flexDirection: 'row', gap: 10 },
  tuile: { borderRadius: rayon.bloc, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  valeurTuile: { fontFamily: police.titre700, fontSize: 28, lineHeight: 32 },
  piste: { height: 14, borderRadius: rayon.rond, marginVertical: 4, justifyContent: 'center' },
  repere: { position: 'absolute', top: 0, bottom: 0 },
  marqueur: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3, marginLeft: -9, top: -2 },
  champs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  champ: { width: '47%', flexGrow: 1 },
});
