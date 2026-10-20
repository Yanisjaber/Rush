import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarresHebdo } from '@/components/BarresHebdo';
import { Bloc } from '@/components/Bloc';
import { ChampMesure } from '@/components/ChampMesure';
import { EcranSection } from '@/components/EcranSection';
import { SelecteurJour } from '@/components/SelecteurJour';
import { dateIsoLocale, formatNombre } from '@/data/format';
import { defMesure } from '@/data/sante-catalogue';
import { lisser, moyenneSur, proteinesParKg, serieDe } from '@/data/suivi-corps';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const NIVEAU_PROTEINES = { basse: 'Basse', limite: 'Limite', bonne: 'Bonne', haute: 'Élevée' } as const;
const virgule = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

// La nutrition : ce que tu as mangé, avec les moyennes de la semaine. Les journaux alimentaires sont rarement exacts (ils sous-estiment souvent
// de 10 à 30 %) : on regarde les moyennes et les tendances, pas un jour isolé. Rien ici ne bouge l'état de forme du jour.
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
          {kcal ? (
            <>
              <View style={styles.valeurLigne}>
                <Text accessibilityLabel={`${Math.round(kcal.moyenne)} calories par jour en moyenne`} style={[styles.valeur, { color: p.texte }]}>
                  {formatNombre(Math.round(kcal.moyenne))}
                </Text>
                <Text style={[typo.corpsFort, { color: p.texteDoux }]}>kcal par jour en moyenne</Text>
              </View>
              <Text style={[typo.petit, { color: p.texteDoux }]}>Sur {kcal.n} jour{kcal.n > 1 ? 's' : ''} renseigné{kcal.n > 1 ? 's' : ''} (7 derniers jours).</Text>
              {quatorze.length > 1 ? (
                <View style={{ marginTop: 12 }}>
                  <BarresHebdo valeurs={quatorze} couleur={p.sportNeutre} hauteur={70} etiquette="Calories des 14 derniers jours renseignés" />
                </View>
              ) : null}
              <View style={styles.stats}>
                {prot ? <Stat nom="Protéines" valeur={`${Math.round(prot.moyenne)} g`} note={parKg ? `${virgule(parKg.gParKg, 2)} g/kg · ${NIVEAU_PROTEINES[parKg.niveau]}` : undefined} /> : null}
                {eau ? <Stat nom="Eau" valeur={`${virgule(eau.moyenne)} L`} /> : null}
              </View>
              {parKg ? <Text style={[typo.petit, { color: p.texteMuet, marginTop: 8 }]}>Repère : 1,4 à 2,0 g de protéines par kilo et par jour pour une personne qui s'entraîne.</Text> : null}
            </>
          ) : (
            <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de repas saisi. Note tes calories ci-dessous.</Text>
          )}
        </Bloc>

        <Bloc titre="Saisir ce jour-là">
          {(['calories_kcal', 'proteines_g', 'eau_l'] as const).map((cle) => {
            const def = defMesure(cle);
            return def ? <ChampMesure key={cle} def={def} valeur={jour[cle]} onChange={(v) => void saisir(cle, v)} /> : null;
          })}
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok, marginTop: 10, minHeight: 20 }]}>
            {message}
          </Text>
        </Bloc>

        <Text style={[typo.petit, { color: p.texteMuet }]}>
          Les journaux alimentaires sous-estiment souvent de 10 à 30 % : regarde les moyennes sur plusieurs jours plutôt qu'un jour isolé.
        </Text>
      </View>
    </EcranSection>
  );
}

function Stat({ nom, valeur, note }: { nom: string; valeur: string; note?: string }) {
  const p = usePalette();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>{nom}</Text>
      <Text style={[styles.stat, { color: p.texte }]}>{valeur}</Text>
      {note ? <Text style={[typo.petit, { color: p.texteDoux }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  valeurLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  valeur: { fontFamily: police.titre800, fontSize: 48, lineHeight: 52 },
  stats: { flexDirection: 'row', gap: 16, marginTop: 14 },
  stat: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28 },
});
