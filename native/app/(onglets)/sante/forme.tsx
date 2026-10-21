import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/Bloc';
import { CourbeForme } from '@/components/CourbeForme';
import { AnneauJauge } from '@/components/AnneauJauge';
import { CourbeLissee } from '@/components/CourbeLissee';
import { IndicateursEtat } from '@/components/IndicateursEtat';
import { accordAvecRessenti, indicateurs, JOURS_MINI_ACCORD, lecture, niveauDe, NOM_COMPOSANTE, serieEtatDeForme, type Composante } from '@/data/forme-sante';
import type { Nuit } from '@/data/types';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const BARRE_ONGLETS = 72;
const NB_JOURS = 60;
const MOT_PRECISION = { basique: 'basique', bonne: 'bonne', elevee: 'élevée' } as const;

const dateCourte = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// Les chiffres bruts qui nourrissent l'état de forme, avec leur évolution
const TENDANCES: { cle: keyof Nuit; nom: string; unite: string; lecture: string }[] = [
  { cle: 'hrv_avg', nom: 'HRV de nuit', unite: 'ms', lecture: 'Plus haut que ta moyenne = mieux récupéré.' },
  { cle: 'resting_heart_rate', nom: 'FC de repos', unite: 'bpm', lecture: 'Plus basse que ta moyenne = mieux récupéré.' },
  { cle: 'avg_stress', nom: 'Stress de nuit', unite: '/100', lecture: 'Plus bas que ta moyenne = mieux récupéré.' },
];

// L'écran de détail de l'état de forme : la courbe, ce qui la compose, les chiffres bruts et la méthode de calcul.
export default function EtatDeForme() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { nuits, chargement, actualisation, recharger } = useDonneesSommeil();
  const { metriques, recharger: rechargerMetriques } = useMetriques();
  const { mesures, recharger: rechargerMesures } = useMesuresSante();
  const serie = useMemo(() => serieEtatDeForme(nuits, metriques, mesures), [nuits, metriques, mesures]);
  // La courbe démarre au premier jour où l'indice existe (avant, la référence personnelle n'est pas encore assez fournie)
  const premier = serie.findIndex((pt) => pt.indice != null);
  const recente = (premier >= 0 ? serie.slice(premier) : serie).slice(-NB_JOURS);
  const accord = useMemo(() => accordAvecRessenti(nuits, metriques, mesures), [nuits, metriques, mesures]);
  const dernier = serie[serie.length - 1] ?? null;
  const l = lecture(dernier);
  const chrono = useMemo(() => [...nuits].sort((a, b) => a.date.localeCompare(b.date)), [nuits]);

  return (
    <ScrollView
      style={{ backgroundColor: p.fond }}
      contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]}
      refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void Promise.all([recharger(), rechargerMetriques(), rechargerMesures()])} tintColor={p.texteDoux} />}
    >
      {chargement ? (
        <View accessible accessibilityLabel="Chargement" style={styles.attente}>
          <ActivityIndicator color={p.texteDoux} />
        </View>
      ) : (
        <>
          <Bloc>
            <Text style={[typo.micro, { color: p.texteDoux }]}>{dernier ? dateCourte(dernier.date) : 'État de forme'}</Text>
            <View style={styles.valeurLigne}>
              <Text accessibilityLabel={l ? `État de forme ${l.indice} sur 100` : 'État de forme indisponible'} style={[styles.valeur, { color: p.texte }]}>
                {l ? l.indice : '—'}
              </Text>
              {l ? <Text style={[typo.corpsFort, { color: p.texteDoux }]}>/100</Text> : null}
            </View>
            <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
              {l ? l.libelle : 'Pas assez de données'}
            </Text>
            <Text style={[typo.corps, { color: p.texteDoux, marginTop: 4 }]}>
              {l ? l.phrase : "Il faut quelques semaines de nuits (HRV, FC de repos, sommeil) pour calibrer ta référence personnelle."}
            </Text>
            <IndicateursEtat indicateurs={indicateurs(dernier)} />
            {dernier ? (
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 10 }]}>
                Précision {dernier.precision ? MOT_PRECISION[dernier.precision] : 'insuffisante'} : {dernier.composantes.filter((c) => c.indice != null).length} piliers sur {dernier.composantes.length}.
              </Text>
            ) : null}
            {dernier?.freins.map((f) => (
              <Text key={f} style={[typo.petit, { color: p.alerte, marginTop: 6 }]}>
                {f}
              </Text>
            ))}
            {dernier?.contexte.map((c) => (
              <Text key={c} style={[typo.petit, { color: p.texteDoux, marginTop: 6 }]}>
                {c}
              </Text>
            ))}
          </Bloc>

          <Bloc titre={`Sur ${Math.min(NB_JOURS, recente.length)} jours`}>
            {recente.length > 1 ? (
              <>
                <CourbeForme points={recente} etiquette={`Courbe de ton état de forme sur ${recente.length} jours, de 0 à 100`} />
                <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
                  Au-dessus de 65 : bien récupéré. De 40 à 64 : récupération moyenne. En dessous de 40 : à ménager. 50 = comme d'habitude pour toi.
                </Text>
              </>
            ) : (
              <Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore de courbe : il faut plusieurs nuits.</Text>
            )}
          </Bloc>

          <Bloc titre="Ce qui compose ton état de forme">
            <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 10 }]}>Chaque pilier va de 0 à 100 (50 = comme d'habitude). Le poids dit son importance dans l'état de forme.</Text>
            {(dernier?.composantes ?? []).map((c, i) => (
              <LignePilier key={c.cle} c={c} premiere={i === 0} />
            ))}
          </Bloc>

          {dernier && dernier.manquants.length ? (
            <Bloc titre="Pour être plus précis">
              {dernier.manquants.map((m) => (
                <Text key={m.cle} style={[typo.petit, { color: p.texteDoux, marginBottom: 4 }]}>
                  {m.comment}
                </Text>
              ))}
            </Bloc>
          ) : null}

          <Bloc titre="Tes chiffres">
            {TENDANCES.map((t, i) => (
              <Tendance key={t.cle} t={t} nuits={chrono} premiere={i === 0} />
            ))}
          </Bloc>

          <Bloc titre="Fiable pour toi ?">
            <Fiabilite accord={accord} />
          </Bloc>

          <Bloc titre="Comment c'est calculé">
            <Text style={[typo.petit, { color: p.texteDoux }]}>
              Ton état de forme est une estimation à partir de tes chiffres. Ce n'est pas un avis médical : en cas de doute sur ta santé, parle à un professionnel.
            </Text>
            <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
              Chaque pilier est comparé à TA référence (tes 28 nuits précédentes), pas à une moyenne de la population : un écart à ta norme devient un indice de 0 à 100, puis l'état de forme est la moyenne pondérée des piliers disponibles.
            </Text>
            <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
              HRV (25 %) : logarithme de la HRV de nuit, moyenne des 3 dernières nuits (Plews et coll., 2013 ; Buchheit, 2014). Sommeil (20 %) : ton score de sommeil, dans la logique des repères de 7 à 9 h de la National Sleep Foundation (2015). FC de repos (15 %), stress de nuit (7 %) et respiration de nuit (5 %) : écart à ta moyenne, inversé. Ressenti du matin (15 %) : tes 5 réponses, dans l'esprit de l'indice de Hooper (1995). Charge d'entraînement (8 %) : la fraîcheur « condition moins fatigue » du modèle de Banister (1975). Température cutanée (5 %) : plus l'écart à ta normale est grand, plus l'indice baisse. Être malade ou blessé plafonne l'état de forme (35 et 50).
            </Text>
            <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
              Les piliers sans donnée sont simplement écartés et leur poids est réparti sur les autres : la précision indique combien il y en a. Si trop de données manquent (moins de 55 % du poids total), l'indice n'est pas affiché plutôt qu'inventé.
            </Text>
          </Bloc>
        </>
      )}
    </ScrollView>
  );
}

// Un pilier : son nom, son poids, sa barre de 0 à 100 et sa valeur. Le niveau est écrit en toutes lettres, la couleur ne se lit pas seule.
function LignePilier({ c, premiere }: { c: Composante; premiere: boolean }) {
  const p = usePalette();
  const niveau = niveauDe(c.indice);
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.texteMuet;
  const mot = niveau === 'bon' ? 'bon' : niveau === 'moyen' ? 'moyen' : niveau === 'faible' ? 'faible' : 'pas de donnée';
  return (
    <View accessible accessibilityLabel={`${NOM_COMPOSANTE[c.cle]}, poids ${Math.round(c.poids * 100)} pour cent : ${c.indice != null ? `${c.indice} sur 100, ${mot}` : 'pas de donnée'}`} style={[styles.pilier, !premiere && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.pilierTete}>
        <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>{NOM_COMPOSANTE[c.cle]}</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>{Math.round(c.poids * 100)} %</Text>
        <Text style={[styles.pilierValeur, { color: p.texte }]}>{c.indice ?? '—'}</Text>
      </View>
      <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
        {c.indice != null ? <View style={[styles.rempli, { width: `${c.indice}%`, backgroundColor: couleur }]} /> : null}
        <View style={[styles.repere, { backgroundColor: p.traitFort }]} />
      </View>
      <Text style={[typo.micro, { color: p.texteDoux, marginTop: 2 }]}>{mot}</Text>
    </View>
  );
}

// Une grandeur brute : sa valeur de la dernière nuit, sa moyenne sur 28 nuits et sa courbe
function Tendance({ t, nuits, premiere }: { t: (typeof TENDANCES)[number]; nuits: Nuit[]; premiere: boolean }) {
  const p = usePalette();
  const valeurs = nuits.map((n) => Number(n[t.cle])).filter((v) => Number.isFinite(v) && v > 0);
  const recent = valeurs.slice(-NB_JOURS);
  const derniere = valeurs[valeurs.length - 1];
  const moy = valeurs.slice(-28).reduce((s, v) => s + v, 0) / Math.max(1, valeurs.slice(-28).length);
  return (
    <View style={[styles.tendance, !premiere && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.pilierTete}>
        <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>{t.nom}</Text>
        {derniere != null ? (
          <Text style={[styles.pilierValeur, { color: p.texte }]}>
            {Math.round(derniere)}
            <Text style={[typo.petit, { color: p.texteDoux }]}> {t.unite}</Text>
          </Text>
        ) : (
          <Text style={[typo.petit, { color: p.texteDoux }]}>Pas de mesure</Text>
        )}
      </View>
      {recent.length > 1 ? <CourbeLissee valeurs={recent} couleur={p.texte} hauteur={60} aire={false} etiquette={`${t.nom} sur ${recent.length} nuits`} /> : null}
      <Text style={[typo.petit, { color: p.texteDoux }]}>
        {recent.length > 1 ? `Moyenne sur 28 nuits : ${Math.round(moy)} ${t.unite}. ` : ''}
        {t.lecture}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e3, gap: espace.e4 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  valeurLigne: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  valeur: { fontFamily: police.titre800, fontSize: 72, lineHeight: 76, letterSpacing: -1 },
  pilier: { paddingVertical: 10, gap: 6 },
  pilierTete: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  pilierValeur: { fontFamily: police.titre700, fontSize: 20, lineHeight: 24, minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'] },
  piste: { height: 10, borderRadius: rayon.rond, overflow: 'hidden' },
  rempli: { height: '100%', borderRadius: rayon.rond },
  repere: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2 },
  tendance: { paddingVertical: 12, gap: 6 },
  progres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  petitPoint: { width: 12, height: 12, borderRadius: 6 },
  fiabilite: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accordValeur: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20 },
});

// Le verdict : l'état de forme calculé suit-il ton ressenti du matin ? Avant 14 jours de check-in, on ne dit rien (le hasard déciderait) ; on montre l'avancement.
function Fiabilite({ accord }: { accord: ReturnType<typeof accordAvecRessenti> }) {
  const p = usePalette();
  if (accord.accord == null) {
    return (
      <View accessible accessibilityLabel={`${accord.jours} jours de check-in sur ${JOURS_MINI_ACCORD} pour savoir si l'état de forme colle à ton ressenti`}>
        <View style={styles.progres}>
          {Array.from({ length: JOURS_MINI_ACCORD }, (_, i) => (
            <View key={i} style={[styles.petitPoint, { backgroundColor: i < accord.jours ? p.ok : p.traitFort }]} />
          ))}
        </View>
        <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
          {accord.jours} sur {JOURS_MINI_ACCORD} jours de check-in. Il en faut {JOURS_MINI_ACCORD} pour savoir si ton état de forme colle à ce que tu ressens.
        </Text>
      </View>
    );
  }
  const couleur = accord.accord === 'fort' ? p.ok : accord.accord === 'moyen' ? p.alerte : p.danger;
  const phrase = accord.accord === 'fort' ? 'Il colle bien à ton ressenti : tu peux t\'y fier.' : accord.accord === 'moyen' ? 'Il suit en partie ton ressenti : à prendre avec recul.' : 'Il ne suit pas ton ressenti : ne t\'y fie pas pour décider.';
  return (
    <View style={styles.fiabilite}>
      <AnneauJauge valeur={Math.max(0, Math.round((accord.r ?? 0) * 100))} taille={72} epaisseur={9} couleur={couleur} piste={p.surface2} etiquette={`Accord avec ton ressenti : ${accord.accord}`}>
        <Text style={[styles.accordValeur, { color: p.texte }]}>{String(accord.r).replace('.', ',')}</Text>
      </AnneauJauge>
      <View style={{ flex: 1 }}>
        <Text style={[typo.corpsFort, { color: p.texte }]}>Accord {accord.accord}</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>{phrase}</Text>
        <Text style={[typo.petit, { color: p.texteMuet, marginTop: 4 }]}>Sur {accord.jours} jours avec ton ressenti.</Text>
      </View>
    </View>
  );
}
