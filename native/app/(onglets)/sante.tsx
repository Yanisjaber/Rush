import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/Bloc';
import { GrapheSeries } from '@/components/GrapheSeries';
import { StatCle } from '@/components/StatCle';
import { heureDe, phases } from '@/data/sommeil';
import {
  analyser, comparaisons, efficacitePct, latenceMin, NOM_COMPOSANT, NOM_QUALIFICATIF, planAction, preparer, REPERES, signauxPhysio, synthese,
  texteHM, texteHMdepuisSec, tonDe, type NuitPreparee, type StatsGroupe,
} from '@/data/score-sommeil';
import { useDonneesSommeil } from '@/hooks/useDonneesSommeil';
import { espace, rayon, type Palette } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const BARRE_ONGLETS = 72;
const VUES = ['Aperçu', 'Graphiques', 'Conseils'] as const;
type Vue = (typeof VUES)[number];
// Couleurs des phases (profond, léger, paradoxal, éveillé) : les mêmes que sur le web
const COULEURS_PHASE = ['#3b82f6', '#93c5fd', '#fbbf24', '#f87171'];
const COULEUR_CLE: Record<string, string> = { profond: COULEURS_PHASE[0], leger: COULEURS_PHASE[1], rem: COULEURS_PHASE[2], eveille: COULEURS_PHASE[3] };

const dateLongue = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const couleurTon = (p: Palette, ton: string) => (ton === 'bon' ? p.ok : ton === 'moyen' || ton === 'attention' ? p.alerte : ton === 'mauvais' || ton === 'faible' ? p.danger : p.texteDoux);

export default function Sante() {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const haut = useSafeAreaInsets().top;
  const { nuits, chargement, erreur, actualisation, demo, recharger } = useDonneesSommeil();
  const [vue, setVue] = useState<Vue>('Aperçu');
  const triees = useMemo(() => preparer(nuits), [nuits]);
  const pro = useMemo(() => analyser(triees), [triees]);

  return (
    <View style={[styles.page, { backgroundColor: p.fond }]}>
      <ScrollView
        contentContainerStyle={[styles.contenu, { paddingTop: haut + espace.e4, paddingBottom: bas + BARRE_ONGLETS }]}
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={recharger} tintColor={p.texteDoux} />}
      >
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>Sommeil</Text>
          {demo ? <Text style={[typo.micro, { color: p.texteMuet }]}>Mode démo</Text> : null}
        </View>

        <View accessibilityRole="tablist" style={[styles.segments, { backgroundColor: p.surface }]}>
          {VUES.map((v) => (
            <Pressable
              key={v}
              onPress={() => setVue(v)}
              accessibilityRole="tab"
              accessibilityState={{ selected: v === vue }}
              style={[styles.segment, v === vue && { backgroundColor: p.surface2, borderColor: p.traitFort, borderWidth: 1 }]}
            >
              <Text style={[typo.corpsFort, { color: v === vue ? p.texte : p.texteDoux }]}>{v}</Text>
            </Pressable>
          ))}
        </View>

        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}

        {chargement ? (
          <View accessible accessibilityLabel="Chargement du sommeil" style={styles.attente}><ActivityIndicator color={p.texteDoux} /></View>
        ) : !triees.length ? (
          <Bloc titre="Aucune nuit">
            <Text style={[typo.corps, { color: p.texteDoux }]}>
              Pas de nuit enregistrée pour l'instant. Les nuits déjà importées depuis Garmin s'affichent ici ; la synchronisation avec Santé (Apple) arrive plus tard.
            </Text>
          </Bloc>
        ) : vue === 'Aperçu' ? (
          <Apercu nuits={triees} />
        ) : vue === 'Graphiques' ? (
          <Graphiques nuits={triees} />
        ) : (
          <Conseils nuits={triees} pro={pro} />
        )}
      </ScrollView>
    </View>
  );
}

// --- Aperçu : la dernière nuit, puis les nuits récentes -----------------------------------------------------------------

function Apercu({ nuits }: { nuits: NuitPreparee[] }) {
  const p = usePalette();
  const [choix, setChoix] = useState(0);
  const n = nuits[Math.min(choix, nuits.length - 1)];
  const score = n.score_maison;
  const eff = efficacitePct(n);
  const lat = latenceMin(n);
  return (
    <>
      <Bloc>
        <Text style={[typo.micro, { color: p.texteDoux }]}>{choix === 0 ? 'Dernière nuit' : 'Nuit du'}</Text>
        <Text accessibilityRole="header" style={[typo.titre2, { color: p.texte }]}>{dateLongue(n.date)}</Text>
        <Text style={[typo.corps, { color: p.texteDoux, marginTop: 2 }]}>
          {heureDe(n.bedtime) ?? '—'} → {heureDe(n.wake_time) ?? '—'} · {texteHMdepuisSec(n.total_sec)} de sommeil
        </Text>
        {score ? (
          <View style={styles.score}>
            <Text accessibilityLabel={`Score ${score.total} sur 100`} style={[styles.scoreChiffre, { color: couleurTon(p, tonDe(score.qualificatif)) }]}>{score.total}</Text>
            <Text style={[typo.corpsFort, { color: p.texteDoux }]}>/100 · {NOM_QUALIFICATIF[score.qualificatif]}</Text>
          </View>
        ) : null}
        <Hypnogramme nuit={n} />
        <Phases nuit={n} />
      </Bloc>

      <Bloc titre="Chiffres clés">
        <View style={styles.grille}>
          <View style={styles.cellule}><StatCle etiquette="Efficacité" valeur={eff != null ? String(Math.round(eff)) : '—'} unite="%" /></View>
          <View style={styles.cellule}><StatCle etiquette="Endormissement" valeur={lat != null ? String(lat) : '—'} unite="min" /></View>
          <View style={styles.cellule}><StatCle etiquette="HRV" valeur={n.hrv_avg != null ? String(Math.round(n.hrv_avg)) : '—'} unite="ms" /></View>
          <View style={styles.cellule}><StatCle etiquette="FC moyenne" valeur={n.avg_heart_rate != null ? String(Math.round(n.avg_heart_rate)) : '—'} unite="bpm" /></View>
        </View>
        {score ? (
          <View style={{ marginTop: espace.e3, gap: 6 }}>
            {Object.entries(score.composants).map(([cle, v]) => (
              <View key={cle} style={styles.composant}>
                <Text style={[typo.petit, { color: p.texteDoux, width: 110 }]}>{NOM_COMPOSANT[cle]}</Text>
                <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                  <View style={{ width: `${v}%`, height: '100%', backgroundColor: couleurTon(p, v >= 65 ? 'bon' : v >= 50 ? 'moyen' : 'faible') }} />
                </View>
                <Text style={[typo.petit, { color: p.texte, width: 30, textAlign: 'right' }]}>{v}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Bloc>

      <Bloc titre="Nuits récentes">
        {nuits.slice(0, 14).map((x, i) => (
          <Pressable
            key={x.date}
            onPress={() => setChoix(i)}
            accessibilityRole="button"
            accessibilityLabel={`${dateLongue(x.date)}, ${texteHMdepuisSec(x.total_sec)}, score ${x.score_maison?.total ?? 'inconnu'}`}
            style={[styles.ligneNuit, { borderTopColor: p.trait }, i === choix && { backgroundColor: p.surface2 }]}
          >
            <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{dateLongue(x.date)}</Text>
            <Text style={[typo.corps, { color: p.texteDoux }]}>{texteHMdepuisSec(x.total_sec)}</Text>
            <Text style={[typo.corpsFort, { color: couleurTon(p, tonDe(x.score_maison?.qualificatif ?? 'POOR')), width: 40, textAlign: 'right' }]}>{x.score_maison?.total ?? '—'}</Text>
          </Pressable>
        ))}
      </Bloc>
    </>
  );
}

// Hypnogramme : une bande par segment, la hauteur dépend du niveau (profond en bas, éveil en haut)
function Hypnogramme({ nuit }: { nuit: NuitPreparee }) {
  const p = usePalette();
  const segs = nuit.segments;
  if (!Array.isArray(segs) || !segs.length) return null;
  const fin = Math.max(...segs.map((s) => s[1]));
  const W = 400;
  const H = 110;
  const ligne = (niveau: number) => (niveau === 3 ? 0 : niveau === 2 ? 1 : niveau === 1 ? 2 : 3);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Hypnogramme : les phases de la nuit dans l'ordre" style={{ marginTop: espace.e3 }}>
      <Svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: W / H }}>
        <Rect x={0} y={0} width={W} height={H} fill={p.surface2} />
        {segs.map((s, i) => (
          <Rect key={i} x={(s[0] / fin) * W} y={ligne(s[2]) * (H / 4) + 3} width={Math.max(1, ((s[1] - s[0]) / fin) * W)} height={H / 4 - 6} fill={COULEURS_PHASE[s[2]] ?? p.texteDoux} />
        ))}
      </Svg>
      <View style={styles.legende}>
        {['Profond', 'Léger', 'Paradoxal', 'Éveil'].map((nom, i) => (
          <View key={nom} style={styles.legendeItem}>
            <View style={{ width: 10, height: 10, backgroundColor: COULEURS_PHASE[i] }} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>{nom}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Phases({ nuit }: { nuit: NuitPreparee }) {
  const p = usePalette();
  const liste = phases(nuit);
  if (!liste.length) return null;
  return (
    <View style={{ marginTop: espace.e3, gap: 6 }}>
      {liste.map((ph) => (
        <View key={ph.cle} style={styles.composant}>
          <Text style={[typo.petit, { color: p.texteDoux, width: 80 }]}>{ph.nom}</Text>
          <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
            <View style={{ width: `${Math.round(ph.part * 100)}%`, height: '100%', backgroundColor: COULEUR_CLE[ph.cle] }} />
          </View>
          <Text style={[typo.petit, { color: p.texte, width: 80, textAlign: 'right' }]}>{texteHMdepuisSec(ph.secondes)} · {Math.round(ph.part * 100)} %</Text>
        </View>
      ))}
    </View>
  );
}

// --- Graphiques ---------------------------------------------------------------------------------------------------------

function Graphiques({ nuits }: { nuits: NuitPreparee[] }) {
  const p = usePalette();
  // Du plus ancien au plus récent, sur les 30 dernières nuits
  const serie = useMemo(() => nuits.slice(0, 30).reverse(), [nuits]);
  const dates = serie.map((n) => n.date);
  const heures = (n: NuitPreparee) => (n.total_sec != null ? n.total_sec / 3600 : null);
  const comp = useMemo(() => comparaisons(nuits), [nuits]);
  return (
    <>
      <Bloc titre="Durée de sommeil">
        <GrapheSeries titre="Durée de sommeil des 30 dernières nuits" etiquettes={dates} barres={[{ nom: 'Durée', valeurs: serie.map(heures), couleur: COULEURS_PHASE[0] }]}
          reperes={[{ valeur: 7, etiquette: '7 h' }, { valeur: 9, etiquette: '9 h' }]} formater={(v) => texteHM(Math.round(v * 60))} />
      </Bloc>
      <Bloc titre="Phases (en % de la nuit)">
        <GrapheSeries titre="Répartition des phases" etiquettes={dates} empile hauteur={150}
          barres={[
            { nom: 'Profond', valeurs: serie.map((n) => n.deep_sec), couleur: COULEURS_PHASE[0] },
            { nom: 'Léger', valeurs: serie.map((n) => n.light_sec), couleur: COULEURS_PHASE[1] },
            { nom: 'Paradoxal', valeurs: serie.map((n) => n.rem_sec), couleur: COULEURS_PHASE[2] },
            { nom: 'Éveil', valeurs: serie.map((n) => n.awake_sec), couleur: COULEURS_PHASE[3] },
          ]} formater={(v) => `${Math.round(v)} %`} />
      </Bloc>
      <Bloc titre="Score">
        <GrapheSeries titre="Score de sommeil" etiquettes={dates} min={0} max={100}
          lignes={[{ nom: 'Score', valeurs: serie.map((n) => n.score_maison?.total ?? null), couleur: p.sportCourse }]} formater={(v) => `${Math.round(v)}/100`} />
      </Bloc>
      <Bloc titre="Efficacité">
        <GrapheSeries titre="Efficacité du sommeil" etiquettes={dates} min={50} max={100} reperes={[{ valeur: REPERES.efficaciteBonne, etiquette: '85 %' }]}
          lignes={[{ nom: 'Efficacité', valeurs: serie.map(efficacitePct), couleur: p.sportNatation }]} formater={(v) => `${Math.round(v)} %`} />
      </Bloc>
      <Bloc titre="HRV nocturne">
        <GrapheSeries titre="Variabilité cardiaque nocturne" etiquettes={dates}
          lignes={[{ nom: 'HRV', valeurs: serie.map((n) => n.hrv_avg), couleur: p.sportVelo }]} formater={(v) => `${Math.round(v)} ms`} />
      </Bloc>
      <Bloc titre="FC pendant le sommeil">
        <GrapheSeries titre="Fréquence cardiaque pendant le sommeil" etiquettes={dates}
          lignes={[{ nom: 'FC', valeurs: serie.map((n) => n.avg_heart_rate), couleur: p.sportMuscu }]} formater={(v) => `${Math.round(v)} bpm`} />
      </Bloc>
      {comp.recent ? <Comparaison titre="7 derniers jours contre les 7 précédents" a="7 derniers" b="7 précédents" g={comp.recent} /> : null}
      {comp.semaineWeekEnd ? <Comparaison titre="Semaine contre week-end" a="Week-end" b="Semaine" g={comp.semaineWeekEnd} /> : null}
    </>
  );
}

function Comparaison({ titre, a, b, g }: { titre: string; a: string; b: string; g: { a: StatsGroupe; b: StatsGroupe } }) {
  const p = usePalette();
  const hm = (m: number | null) => (m == null ? '—' : texteHM(m));
  const lignes: [string, string, string][] = [
    ['Durée', g.a.dureeSec != null ? texteHM(g.a.dureeSec / 60) : '—', g.b.dureeSec != null ? texteHM(g.b.dureeSec / 60) : '—'],
    ['Score', g.a.score != null ? String(Math.round(g.a.score)) : '—', g.b.score != null ? String(Math.round(g.b.score)) : '—'],
    ['Efficacité', g.a.efficacite != null ? `${Math.round(g.a.efficacite)} %` : '—', g.b.efficacite != null ? `${Math.round(g.b.efficacite)} %` : '—'],
    ['HRV', g.a.hrv != null ? `${Math.round(g.a.hrv)} ms` : '—', g.b.hrv != null ? `${Math.round(g.b.hrv)} ms` : '—'],
    ['Coucher', hm(g.a.coucherMin), hm(g.b.coucherMin)],
    ['Lever', hm(g.a.leverMin), hm(g.b.leverMin)],
  ];
  return (
    <Bloc titre={titre}>
      <View style={styles.ligneTable}>
        <Text style={[typo.micro, { color: p.texteDoux, flex: 1 }]}> </Text>
        <Text style={[typo.micro, { color: p.texteDoux, width: 90, textAlign: 'right' }]}>{a}</Text>
        <Text style={[typo.micro, { color: p.texteDoux, width: 90, textAlign: 'right' }]}>{b}</Text>
      </View>
      {lignes.map(([nom, x, y]) => (
        <View key={nom} style={[styles.ligneTable, { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{nom}</Text>
          <Text style={[typo.corpsFort, { color: p.texte, width: 90, textAlign: 'right' }]}>{x}</Text>
          <Text style={[typo.corps, { color: p.texteDoux, width: 90, textAlign: 'right' }]}>{y}</Text>
        </View>
      ))}
    </Bloc>
  );
}

// --- Conseils -----------------------------------------------------------------------------------------------------------

function Conseils({ nuits, pro }: { nuits: NuitPreparee[]; pro: ReturnType<typeof analyser> }) {
  const p = usePalette();
  if (!pro) {
    return <Bloc titre="Conseils"><Text style={[typo.corps, { color: p.texteDoux }]}>Pas encore assez de nuits pour t'analyser.</Text></Bloc>;
  }
  const signaux = signauxPhysio(pro);
  const actions = planAction(pro);
  const h = pro.horaires;
  const impact = { fort: 'Impact fort', modere: 'Impact modéré', general: 'Hygiène générale' };
  return (
    <>
      <Bloc titre="En bref"><Text style={[typo.corps, { color: p.texte }]}>{synthese(nuits, pro)}</Text></Bloc>
      {h ? (
        <Bloc titre="Tes horaires">
          <View style={styles.grille}>
            <View style={styles.cellule}><StatCle etiquette="Coucher moyen" valeur={h.coucherMoyen} note={`Vise ${h.coucherVise}`} /></View>
            <View style={styles.cellule}><StatCle etiquette="Lever moyen" valeur={h.leverMoyen} note={`Vise ${h.leverVise}`} /></View>
            <View style={styles.cellule}><StatCle etiquette="Durée moyenne" valeur={texteHM(h.dureeMoyMin)} /></View>
            <View style={styles.cellule}><StatCle etiquette="Régularité" valeur={`±${Math.round(h.ecartCoucherMin / 2)}`} unite="min" note="au coucher" /></View>
          </View>
        </Bloc>
      ) : null}
      {signaux.length ? (
        <Bloc titre="Signaux physiologiques">
          {signaux.map((s) => (
            <View key={s.cle} style={[styles.signal, { borderLeftColor: couleurTon(p, s.ton) }]}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>{s.titre} · {s.valeur}</Text>
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 2 }]}>{s.texte}</Text>
            </View>
          ))}
        </Bloc>
      ) : null}
      <Bloc titre="Plan d'action">
        {actions.map((a, i) => (
          <View key={i} style={[styles.ligneNuit, { borderTopColor: p.trait, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }]}>
            <Text style={[typo.micro, { color: a.impact === 'fort' ? p.danger : a.impact === 'modere' ? p.alerte : p.texteMuet }]}>{impact[a.impact]}</Text>
            <Text style={[typo.corps, { color: p.texte }]}>{a.texte}</Text>
          </View>
        ))}
      </Bloc>
      <Text style={[typo.petit, { color: p.texteMuet }]}>
        Ce score est un repère, pas un diagnostic médical. Les seuils viennent de la National Sleep Foundation (Hirshkowitz 2015, Ohayon 2017). Si tu dors mal depuis longtemps, parles-en à un médecin.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  segments: { flexDirection: 'row', borderRadius: rayon.base, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: rayon.base },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: espace.e3 },
  scoreChiffre: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60, fontVariant: ['tabular-nums'] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', rowGap: espace.e4 },
  cellule: { width: '50%' },
  composant: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  piste: { flex: 1, height: 8, overflow: 'hidden' },
  ligneNuit: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 8, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth },
  legende: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ligneTable: { flexDirection: 'row', alignItems: 'center', minHeight: 40, gap: 8 },
  signal: { borderLeftWidth: 4, paddingLeft: 10, paddingVertical: 6, marginTop: 8 },
});
