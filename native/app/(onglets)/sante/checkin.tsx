import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnneauZones } from '@/components/AnneauZones';
import { Bloc } from '@/components/Bloc';
import { CompteurMesure } from '@/components/CompteurMesure';
import { EcranSection } from '@/components/EcranSection';
import { Pastille } from '@/components/Pastille';
import { ReponseEchelle } from '@/components/ReponseEchelle';
import { SelecteurJour } from '@/components/SelecteurJour';
import { lecture, niveauDe, piliersDispo, serieEtatDeForme } from '@/data/sante/forme-sante';
import { dateIsoLocale } from '@/data/outils/format';
import { defMesure, mesuresDe } from '@/data/sante/sante-catalogue';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { avecAlpha, espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le check-in du matin : dix secondes pour dire comment tu te sens et ce qui s'est passé. Chaque réponse s'enregistre toute seule.
// Tout est facultatif : une question sans réponse n'entre pas dans le calcul (son poids est réparti sur les autres piliers).
// Même esprit que l'écran Santé : l'anneau en haut bouge en direct quand tu réponds, les réponses sont des pastilles de couleur.
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
  const niveau = niveauDe(l?.indice);
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.traitFort;
  const zones = [
    { de: 0, a: 40, couleur: avecAlpha(p.danger, 0.45) },
    { de: 40, a: 65, couleur: avecAlpha(p.alerte, 0.45) },
    { de: 65, a: 100, couleur: avecAlpha(p.ok, 0.45) },
  ];
  const { pris: piliersPris, total: piliersTotal } = piliersDispo(point);

  async function saisir(metric: string, valeur: number | null) {
    setMessage('');
    if (await enregistrer(date, metric, valeur)) setMessage(demo ? 'Noté (démo : non enregistré)' : 'Enregistré');
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

        <View style={styles.hero}>
          <AnneauZones
            valeur={l ? l.indice : null}
            taille={112}
            epaisseur={12}
            zones={zones}
            couleurRepere={couleur}
            contourRepere={p.fond}
            etiquette={l ? `Avec tes réponses, état de forme : ${l.mot}, ${l.indice} sur 100. C'est une estimation.` : "Pas assez de données ce jour-là pour estimer l'état de forme"}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.mot, { color: l ? p.texte : p.texteMuet }]}>
              {l ? l.mot : '—'}
            </Text>
          </AnneauZones>
          <View style={styles.precision}>
            <Text style={[typo.micro, { color: p.texteMuet }]}>estimation</Text>
            <View accessible accessibilityLabel={`${piliersPris} piliers sur ${piliersTotal}`} style={styles.points}>
              {Array.from({ length: piliersTotal }, (_, i) => (
                <View key={i} style={[styles.point, { backgroundColor: i < piliersPris ? p.texte : p.traitFort }]} />
              ))}
            </View>
            {point && (point.freins.length || point.contexte.length) ? (
              <View style={styles.puces}>
                {[...point.freins.map((t) => ({ t, c: p.alerte })), ...point.contexte.map((t) => ({ t, c: p.texteDoux }))].map((x) => (
                  <View key={x.t} style={[styles.puce, { borderColor: x.c }]}>
                    <Text numberOfLines={1} style={[typo.micro, { color: x.c }]}>
                      {x.t}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <Bloc titre="Comment te sens-tu ?">
          <View style={{ gap: espace.e4 }}>
            {mesuresDe('ressenti').map((m) => (
              <ReponseEchelle key={m.cle} def={m} valeur={jour[m.cle]} onChange={(v) => void saisir(m.cle, v)} />
            ))}
          </View>
        </Bloc>

        <Bloc titre="Ce qui s'est passé">
          <View style={styles.puces}>
            {(['evt_malade', 'evt_blesse', 'evt_voyage'] as const).map((cle) => {
              const m = defMesure(cle);
              return m ? <Pastille key={cle} nom={m.nom} aide={m.aide} actif={jour[cle] === 1} onPress={() => void saisir(cle, jour[cle] === 1 ? null : 1)} /> : null;
            })}
          </View>
          {alcool ? <CompteurMesure nom={alcool.nom} unite="verres" valeur={jour.alcool_verres ?? 0} max={alcool.max} onChange={(n) => void saisir('alcool_verres', n === 0 ? null : n)} /> : null}
        </Bloc>

        {cycle ? (
          <Bloc titre="Cycle">
            <View style={styles.puces}>
              {(cycle.libelles ?? []).map((nom, i) => {
                const v = cycle.min + i;
                return <Pastille key={nom} nom={nom} actif={jour.cycle_phase === v} onPress={() => void saisir('cycle_phase', jour.cycle_phase === v ? null : v)} />;
              })}
            </View>
            <Text style={[typo.micro, { color: p.texteMuet, marginTop: 8 }]}>Visible seulement ici</Text>
          </Bloc>
        ) : null}

        <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok, minHeight: 20 }]}>
          {message}
        </Text>
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  avis: { borderRadius: 6, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  mot: { fontFamily: police.titre800, fontSize: 17, lineHeight: 21, maxWidth: 80, textAlign: 'center' },
  precision: { flex: 1, gap: 8 },
  points: { flexDirection: 'row', gap: 5 },
  point: { width: 9, height: 9, borderRadius: 5 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, maxWidth: '100%' },
});
