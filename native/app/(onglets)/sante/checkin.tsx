import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { CompteurMesure } from '@/components/CompteurMesure';
import { EcranSection } from '@/components/EcranSection';
import { InterrupteurMesure } from '@/components/InterrupteurMesure';
import { SelecteurEchelle } from '@/components/SelecteurEchelle';
import { SelecteurJour } from '@/components/SelecteurJour';
import { lecture, serieEtatDeForme } from '@/data/forme-sante';
import { dateIsoLocale } from '@/data/format';
import { defMesure, mesuresDe } from '@/data/sante-catalogue';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const MOT_PRECISION = { basique: 'basique', bonne: 'bonne', elevee: 'élevée' } as const;

// Le check-in du matin : dix secondes pour dire comment tu te sens et ce qui s'est passé. Chaque réponse s'enregistre toute seule.
// Tout est facultatif : une question sans réponse n'entre pas dans le calcul (son poids est réparti sur les autres piliers).
export default function Checkin() {
  const p = usePalette();
  const [date, setDate] = useState(dateIsoLocale(new Date()));
  const [message, setMessage] = useState('');
  const { mesures, enregistrer, erreur, demo } = useMesuresSante();
  const { nuits } = useDonneesSommeil();
  const { metriques } = useMetriques();
  const jour = mesures[date] ?? {};

  // L'état de forme de ce jour avec ce qui est saisi : on voit tout de suite ce que ça change
  const serie = useMemo(() => serieEtatDeForme(nuits, metriques, mesures), [nuits, metriques, mesures]);
  const point = serie.find((pt) => pt.date === date) ?? null;
  const l = lecture(point);

  async function saisir(metric: string, valeur: number | null) {
    setMessage('');
    if (await enregistrer(date, metric, valeur)) setMessage('Enregistré');
  }

  const alcool = defMesure('alcool_verres');
  const cycle = defMesure('cycle_phase');
  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        <SelecteurJour date={date} onChange={(d) => { setDate(d); setMessage(''); }} />
        {demo ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : tes réponses restent en mémoire, rien n'est enregistré.</Text> : null}
        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}

        <Bloc titre="Comment te sens-tu ?">
          <View style={{ gap: espace.e4 }}>
            {mesuresDe('ressenti').map((m) => (
              <SelecteurEchelle key={m.cle} def={m} valeur={jour[m.cle]} onChange={(v) => void saisir(m.cle, v)} />
            ))}
          </View>
        </Bloc>

        <Bloc titre="Ce qui s'est passé">
          {(['evt_malade', 'evt_blesse', 'evt_voyage'] as const).map((cle) => {
            const m = defMesure(cle);
            return m ? <InterrupteurMesure key={cle} nom={m.nom} aide={m.aide} actif={jour[cle] === 1} onChange={(on) => void saisir(cle, on ? 1 : null)} /> : null;
          })}
          {alcool ? <CompteurMesure nom={alcool.nom} unite="verres" aide={alcool.aide} valeur={jour.alcool_verres ?? 0} max={alcool.max} onChange={(n) => void saisir('alcool_verres', n === 0 ? null : n)} /> : null}
        </Bloc>

        {cycle ? (
          <Bloc titre="Cycle (facultatif)">
            <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 8 }]}>Donnée sensible : elle n'apparaît que sur cet écran et sert à mieux lire tes autres chiffres.</Text>
            <SelecteurEchelle def={cycle} valeur={jour.cycle_phase} onChange={(v) => void saisir('cycle_phase', v)} />
          </Bloc>
        ) : null}

        <Bloc titre="Avec ces données">
          {l && point ? (
            <>
              <View style={styles.valeurLigne}>
                <Text accessibilityLabel={`État de forme ${l.indice} sur 100`} style={[styles.valeur, { color: p.texte }]}>
                  {l.indice}
                </Text>
                <Text style={[typo.corpsFort, { color: p.texteDoux }]}>/100 · {l.libelle}</Text>
              </View>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                Précision {point.precision ? MOT_PRECISION[point.precision] : '—'} : {point.composantes.filter((c) => c.indice != null).length} piliers sur {point.composantes.length}.
              </Text>
              {point.freins.map((f) => (
                <Text key={f} style={[typo.petit, { color: p.alerte, marginTop: 6 }]}>
                  {f}
                </Text>
              ))}
              {point.contexte.map((c) => (
                <Text key={c} style={[typo.petit, { color: p.texteDoux, marginTop: 6 }]}>
                  {c}
                </Text>
              ))}
            </>
          ) : (
            <Text style={[typo.corps, { color: p.texteDoux }]}>
              Pas assez de données ce jour-là pour calculer ton état de forme. Plus tu réponds, plus l'estimation est précise.
            </Text>
          )}
        </Bloc>

        <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok, minHeight: 20 }]}>
          {message}
        </Text>
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  valeurLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  valeur: { fontFamily: police.titre800, fontSize: 48, lineHeight: 52 },
});
