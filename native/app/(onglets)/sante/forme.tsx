import { FondDegrade } from '@/components/FondDegrade';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnneauJauge } from '@/components/AnneauJauge';
import { AnneauZones } from '@/components/AnneauZones';
import { BarresEcarts } from '@/components/BarresEcarts';
import { Bloc } from '@/components/Bloc';
import { CourbeForme } from '@/components/CourbeForme';
import { accordAvecRessenti, indiceVeille, JOURS_MINI_ACCORD, jusquAuDernierIndice, lecture, niveauDe, NOM_COMPOSANTE, serieEtatDeForme } from '@/data/sante/forme-sante';
import { construirePiliers, NOM_COURT } from '@/data/sante/piliers';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { useMesuresSante } from '@/hooks/useMesuresSante';
import { useMetriques } from '@/hooks/useMetriques';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const BARRE_ONGLETS = 72;
const PERIODES = [7, 30, 60] as const;

const dateCourte = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// L'état de forme en détail, dans le même esprit que l'écran principal : des formes et des chiffres, pas de paragraphes.
//   1. L'anneau en zones (le mot en grand, le chiffre en petit).   2. La courbe, sur 7, 30 ou 60 jours.
//   3. Ce qui tire vers le haut ou le bas, pilier par pilier.      4. Fiable pour toi ?   5. La méthode et les sources, repliées.
export default function EtatDeForme() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const router = useRouter();
  const [periode, setPeriode] = useState<(typeof PERIODES)[number]>(60);
  const [methode, setMethode] = useState(false);
  const { nuits, chargement, actualisation, recharger } = useDonneesSommeil();
  const { metriques, recharger: rechargerMetriques } = useMetriques();
  const { mesures, recharger: rechargerMesures } = useMesuresSante();
  // Coupée au dernier jour qui a un indice : un jour avec seulement un poids ou un check-in ne doit pas effacer l'état connu
  const serie = useMemo(() => jusquAuDernierIndice(serieEtatDeForme(nuits, metriques, mesures)), [nuits, metriques, mesures]);
  const piliers = useMemo(() => construirePiliers(nuits, metriques, mesures, serie), [nuits, metriques, mesures, serie]);
  const accord = useMemo(() => accordAvecRessenti(nuits, metriques, mesures), [nuits, metriques, mesures]);
  const dernier = serie[serie.length - 1] ?? null;
  const veille = indiceVeille(serie);
  const l = lecture(dernier);
  const niveau = niveauDe(dernier?.indice);
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.traitFort;
  const ecart = l && veille != null ? l.indice - veille : null;
  // La courbe démarre au premier jour où l'indice existe (avant, la référence personnelle n'est pas encore assez fournie)
  const premier = serie.findIndex((pt) => pt.indice != null);
  const courbe = (premier >= 0 ? serie.slice(premier) : serie).slice(-periode);
  const zones = [
    { de: 0, a: 40, couleur: avecAlpha(p.danger, 0.45) },
    { de: 40, a: 65, couleur: avecAlpha(p.alerte, 0.45) },
    { de: 65, a: 100, couleur: avecAlpha(p.ok, 0.45) },
  ];

  return (
    <View style={{ flex: 1 }}>
      <FondDegrade />
      <ScrollView
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.contenu, { paddingBottom: bas + BARRE_ONGLETS }]}
      refreshControl={<RefreshControl refreshing={actualisation} onRefresh={() => void Promise.all([recharger(), rechargerMetriques(), rechargerMesures()])} tintColor={p.texteDoux} />}
    >
      {chargement ? (
        <View accessible accessibilityLabel="Chargement" style={styles.attente}>
          <ActivityIndicator color={p.texteDoux} />
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'capitalize' }]}>{dernier ? dateCourte(dernier.date) : 'État de forme'}</Text>
            <AnneauZones
              valeur={l ? l.indice : null}
              taille={190}
              epaisseur={20}
              zones={zones}
              couleurRepere={couleur}
              contourRepere={p.fond}
              etiquette={l ? `État de forme : ${l.mot}, ${l.indice} sur 100. C'est une estimation.` : 'État de forme indisponible'}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.mot, { color: l ? p.texte : p.texteMuet }]}>
                {l ? l.mot : '—'}
              </Text>
              {l ? (
                <View style={styles.detail}>
                  <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{l.indice}</Text>
                  {ecart != null && ecart !== 0 ? (
                    <View style={styles.variation} accessible accessibilityLabel={`${ecart > 0 ? 'Plus' : 'Moins'} ${Math.abs(ecart)} point${Math.abs(ecart) > 1 ? 's' : ''} depuis hier`}>
                      <Svg width={11} height={9} viewBox="0 0 10 8">
                        <Path d={ecart > 0 ? 'M5 0 L10 8 L0 8 Z' : 'M0 0 L10 0 L5 8 Z'} fill={ecart > 0 ? p.ok : p.danger} />
                      </Svg>
                      <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{Math.abs(ecart)}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </AnneauZones>
            <Text style={[typo.micro, { color: p.texteMuet }]}>estimation</Text>
            {dernier && dernier.alertes.length ? (
              // Une alerte ne change pas le chiffre : elle signale un écart marqué à ta norme
              <View accessible accessibilityRole="alert" accessibilityLabel={`Alerte : ${dernier.alertes.map((a) => a.nom).join(', ')}. Ça ne change pas le chiffre.`} style={styles.alertes}>
                {dernier.alertes.map((a) => (
                  <View key={a.cle} style={[styles.puceAlerte, { borderColor: p.danger }]}>
                    <Text style={[typo.petit, { color: p.danger }]}>! {NOM_COMPOSANTE[a.cle]}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <Bloc>
            <View style={styles.periodes} accessibilityRole="tablist">
              {PERIODES.map((n) => (
                <Pressable key={n} onPress={() => setPeriode(n)} accessibilityRole="tab" accessibilityState={{ selected: n === periode }} accessibilityLabel={`${n} jours`} style={[styles.periode, { backgroundColor: n === periode ? p.surface2 : 'transparent', borderColor: n === periode ? p.traitFort : 'transparent' }]}>
                  <Text style={[typo.corpsFort, { color: n === periode ? p.texte : p.texteDoux }]}>{n} j</Text>
                </Pressable>
              ))}
            </View>
            {courbe.length > 1 ? (
              <>
                <CourbeForme points={courbe} etiquette={`Courbe de ton état de forme sur ${courbe.length} jours, de 0 à 100`} />
                <View style={styles.legende}>
                  {[
                    { mot: 'À ménager', c: p.danger },
                    { mot: 'Moyen', c: p.alerte },
                    { mot: 'Récupéré', c: p.ok },
                  ].map((z) => (
                    <View key={z.mot} style={styles.legendeItem}>
                      <View style={[styles.puce, { backgroundColor: z.c }]} />
                      <Text style={[typo.micro, { color: p.texteDoux }]}>{z.mot}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[typo.petit, { color: p.texteMuet }]}>—</Text>
            )}
          </Bloc>

          <Bloc titre="Ce qui le tire">
            <BarresEcarts lignes={piliers.filter((x) => !x.surveille).map((x) => ({ cle: x.cle, nom: NOM_COURT[x.cle], indice: x.indice, vers: x.vers }))} onOuvrir={(vers) => router.push(vers as never)} />
          </Bloc>

          <Bloc titre="Fiable pour toi ?">
            <Fiabilite accord={accord} />
          </Bloc>

          <Pressable onPress={() => setMethode((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: methode }} accessibilityLabel="Méthode et sources" style={[styles.rangee, { backgroundColor: p.surface }]}>
            <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>Méthode et sources</Text>
            <View style={[styles.fleche, { borderColor: p.texteDoux, transform: [{ rotate: methode ? '-45deg' : '135deg' }] }]} />
          </Pressable>
          {methode ? (
            <Bloc>
              <Text style={[typo.petit, { color: p.texteDoux }]}>
                Estimation à partir de tes chiffres : ce n'est pas un avis médical. La HRV et la FC de repos sont comparées à TA référence (tes 28 nuits précédentes) ; le sommeil, le ressenti et la charge sont lus sur leur propre échelle. L'état de forme est la moyenne pondérée des piliers disponibles.
              </Text>
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
                Cinq piliers. HRV (30 %) : Plews et coll., 2013 ; Buchheit, 2014. Sommeil (24 %) : repères de la National Sleep Foundation, 2015. FC de repos (18 %) : écart à ta moyenne, inversé. Ressenti (18 %) : indice de Hooper, 1995. Charge (10 %) : modèle de Banister, 1975. Malade ou blessé plafonne l'état (35 et 50).
              </Text>
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
                Stress de nuit, respiration et température ne comptent pas dans le chiffre : ils signalent seulement un écart marqué à ta norme (le stress de nuit est dérivé de la HRV, il la compterait deux fois).
              </Text>
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 8 }]}>
                Les poids sont des choix raisonnés, pas ceux d'une étude. Sans assez de données (moins de 55 % du poids), l'indice n'est pas affiché.
              </Text>
            </Bloc>
          ) : null}
        </>
      )}
    </ScrollView>
    </View>
  );
}

// Le verdict : l'état de forme calculé suit-il ton ressenti du matin ? Avant 14 jours de check-in on ne dit rien (le hasard déciderait) : on montre l'avancement.
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
          {accord.jours} / {JOURS_MINI_ACCORD} jours de check-in
        </Text>
      </View>
    );
  }
  const couleur = accord.accord === 'fort' ? p.ok : accord.accord === 'moyen' ? p.alerte : p.danger;
  return (
    <View style={styles.fiabilite}>
      <AnneauJauge valeur={Math.max(0, Math.round((accord.r ?? 0) * 100))} taille={72} epaisseur={9} couleur={couleur} piste={p.surface2} etiquette={`Accord avec ton ressenti : ${accord.accord}`}>
        <Text style={[styles.accordValeur, { color: p.texte }]}>{String(accord.r).replace('.', ',')}</Text>
      </AnneauJauge>
      <View style={{ flex: 1 }}>
        <Text style={[typo.titre3, { color: p.texte }]}>Accord {accord.accord}</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>{accord.jours} jours avec ton ressenti</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, paddingTop: espace.e3, gap: espace.e4 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  hero: { alignItems: 'center', gap: 10, paddingVertical: espace.e2 },
  mot: { fontFamily: police.titre800, fontSize: 30, lineHeight: 34, maxWidth: 140, textAlign: 'center' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  alertes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  puceAlerte: { borderWidth: 1, borderRadius: rayon.rond, paddingHorizontal: 12, minHeight: 32, justifyContent: 'center' },
  variation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  periodes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  periode: { minHeight: 44, minWidth: 64, borderWidth: 1, borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  legende: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 10 },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  puce: { width: 10, height: 10, borderRadius: 5 },
  rangee: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: rayon.bloc, paddingHorizontal: 18 },
  fleche: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2 },
  progres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  petitPoint: { width: 12, height: 12, borderRadius: 6 },
  fiabilite: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accordValeur: { fontFamily: police.titre700, fontSize: 16, lineHeight: 20 },
});
