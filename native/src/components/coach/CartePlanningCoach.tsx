import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { VueApercu } from '@/data/coach/apercu-plan';
import { periodesDuPlan } from '@/data/coach/apercu-plan';
import { descriptionPlan, jourCarte, MOT_ETAT_PLAN, nombreChangements, nomPeriode, phraseAnnulation, resumePlan } from '@/data/coach/libelles';
import type { CartePlanning } from '@/data/coach/types';
import { dateIsoLocale } from '@/data/outils/format';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { CalendrierPlan, FrisePlan, Hachure } from './PlanApercu';

// La carte d'un plan de modifications du calendrier (maquette « le mélange 7 + 2 + 3 »). Elle ne modifie RIEN toute seule :
// « Valider le plan » demande au serveur de tout revérifier puis d'appliquer le plan en une fois ; « Annuler le plan » défait tout.
// Chaque état se dit avec un mot ET une icône, jamais la couleur seule. Le texte vient du serveur et s'affiche tel quel (jamais interprété).
interface Props {
  carte: CartePlanning;
  /** Une action est en cours sur cette carte */
  occupee: boolean;
  /** Le message d'erreur de la dernière action (réseau, plan refusé au moment du tap…) */
  erreur?: string;
  onValider: () => void;
  onAnnuler: () => void;
  /** « Refaire le plan » : demande au coach de recalculer (envoie un message) */
  onRefaire: () => void;
  onVoirCalendrier: () => void;
}

type Pictogramme = 'attente' | 'ok' | 'alerte' | 'retour' | 'calendrier' | 'frise';

function Picto({ nom, couleur, taille = 18 }: { nom: Pictogramme; couleur: string; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {nom === 'attente' ? <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {nom === 'ok' ? <Path d="M5 12l5 5 9-10" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {nom === 'alerte' ? <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v6M12 16.5v.5" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {nom === 'retour' ? <Path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {nom === 'calendrier' ? (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={2} stroke={couleur} strokeWidth={2} />
          <Path d="M3 10h18M8 3v4M16 3v4" stroke={couleur} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}
      {nom === 'frise' ? <Path d="M3 8h18M3 16h18M7 5v6M15 13v6" stroke={couleur} strokeWidth={2} strokeLinecap="round" /> : null}
    </Svg>
  );
}

export function CartePlanningCoach({ carte, occupee, erreur, onValider, onAnnuler, onRefaire, onVoirCalendrier }: Props) {
  const p = usePalette();
  const [vue, setVue] = useState<VueApercu>('apres');
  const [affichage, setAffichage] = useState<'calendrier' | 'frise'>('calendrier');
  const [detail, setDetail] = useState(false);
  const aujourdhui = useMemo(() => dateIsoLocale(new Date()), []);
  const etat = occupee && carte.etat === 'proposee' ? 'en_cours' : carte.etat;
  const periodes = periodesDuPlan(carte.lignes);
  const montrerPlan = etat === 'proposee' || etat === 'en_cours' || etat === 'ajoutee';
  const charge = Math.round(vue === 'apres' ? carte.charge_apres : carte.charge_avant);

  const couleurEtat = { proposee: p.texte, en_cours: p.texte, ajoutee: p.ok, refusee: p.danger, annulee: p.texteMuet }[etat];

  return (
    <View style={[styles.carte, { backgroundColor: p.surface, borderColor: p.trait }]}>
      <View style={[styles.lisere, { backgroundColor: couleurEtat }]} />
      <View style={styles.corps}>
        <View accessible accessibilityLabel={descriptionPlan(carte)} style={{ gap: 2 }}>
          <View style={styles.ligne}>
            <Picto nom={etat === 'ajoutee' ? 'ok' : etat === 'refusee' ? 'alerte' : etat === 'annulee' ? 'retour' : 'attente'} couleur={couleurEtat} />
            <Text style={[typo.petit, { color: couleurEtat, fontFamily: police.texte600 }]}>{MOT_ETAT_PLAN[etat]}</Text>
          </View>
          <Text style={[typo.titre3, { color: p.texte }]}>{carte.intention || 'Plan de modifications'}</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>
            {nombreChangements(carte.lignes)} · {resumePlan(carte.lignes)}
          </Text>
        </View>

        {montrerPlan ? (
          <>
            <View style={[styles.segments, { borderColor: p.contourChamp }]} accessibilityRole="tablist">
              {(['avant', 'apres'] as const).map((v) => {
                const actif = vue === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setVue(v)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: actif }}
                    accessibilityLabel={v === 'avant' ? "Voir ton calendrier d'aujourd'hui" : 'Voir ton calendrier avec le plan'}
                    style={[styles.segment, { backgroundColor: actif ? p.texte : 'transparent' }]}
                  >
                    <Text style={[typo.petit, { fontFamily: police.texte600, color: actif ? p.fond : p.texte }]}>{v === 'avant' ? "Aujourd'hui" : 'Avec le plan'}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.chargeLigne}>
              <View accessible accessibilityLabel={`Charge prévue sur 14 jours : ${charge} points`}>
                <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none', letterSpacing: 0 }]}>Charge prévue · 14 jours</Text>
                <Text style={[typo.titre2, { color: p.texte }]}>
                  {charge}
                  <Text style={[typo.petit, { color: p.texte }]}> points</Text>
                </Text>
              </View>
              <View style={styles.bascules}>
                {(['calendrier', 'frise'] as const).map((a) => {
                  const actif = affichage === a;
                  return (
                    <Pressable
                      key={a}
                      onPress={() => setAffichage(a)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: actif }}
                      accessibilityLabel={a === 'calendrier' ? 'Voir en calendrier' : 'Voir en frise'}
                      style={[styles.bascule, { borderColor: p.contourChamp, backgroundColor: actif ? p.texte : 'transparent' }]}
                    >
                      <Picto nom={a} couleur={actif ? p.fond : p.texte} taille={20} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {affichage === 'calendrier' ? <CalendrierPlan lignes={carte.lignes} vue={vue} aujourdhui={aujourdhui} /> : <FrisePlan lignes={carte.lignes} vue={vue} aujourdhui={aujourdhui} />}

            <Legende vue={vue} periode={periodes[0]} />

            <Pressable
              onPress={() => setDetail((d) => !d)}
              accessibilityRole="button"
              accessibilityState={{ expanded: detail }}
              accessibilityLabel={detail ? 'Masquer le détail du plan' : 'Voir le détail du plan, ligne par ligne'}
              style={styles.detailBouton}
            >
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{detail ? 'Masquer le détail' : 'Voir le détail'}</Text>
            </Pressable>
            {detail ? <Detail carte={carte} /> : null}
          </>
        ) : null}

        <View style={[styles.etat, { borderTopColor: p.trait }]}>
          {etat === 'proposee' ? (
            <Pressable
              onPress={onValider}
              accessibilityRole="button"
              accessibilityLabel={`Valider le plan : ${carte.intention}. ${nombreChangements(carte.lignes)} seront appliqués à ton calendrier.`}
              style={({ pressed }) => [styles.valider, { backgroundColor: p.texte, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[typo.corpsFort, { color: p.fond }]}>Valider le plan</Text>
            </Pressable>
          ) : null}

          {etat === 'en_cours' ? (
            <View accessible accessibilityLabel={MOT_ETAT_PLAN.en_cours} style={styles.ligne}>
              <ActivityIndicator color={p.texteDoux} />
              <Text style={[typo.petit, { color: p.texteDoux }]}>{MOT_ETAT_PLAN.en_cours}</Text>
            </View>
          ) : null}

          {etat === 'ajoutee' ? (
            <View style={styles.boutons}>
              <Pressable
                onPress={onAnnuler}
                disabled={occupee}
                accessibilityRole="button"
                accessibilityLabel="Annuler le plan : remettre ton calendrier comme avant"
                style={({ pressed }) => [styles.secondaire, { borderColor: p.contourChamp, opacity: occupee ? 0.5 : pressed ? 0.7 : 1 }]}
              >
                <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Annuler le plan</Text>
              </Pressable>
              <Pressable
                onPress={onVoirCalendrier}
                accessibilityRole="button"
                accessibilityLabel="Voir au calendrier"
                style={({ pressed }) => [styles.secondaire, { borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Voir au calendrier</Text>
              </Pressable>
            </View>
          ) : null}

          {etat === 'refusee' ? (
            <>
              <View accessible accessibilityLabel={`${MOT_ETAT_PLAN.refusee}. ${carte.motif ?? ''}`} style={[styles.ligne, { alignItems: 'flex-start' }]}>
                <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>{carte.motif ?? 'Ton calendrier a changé depuis la proposition.'} Rien n’a été modifié.</Text>
              </View>
              <Pressable onPress={onRefaire} accessibilityRole="button" accessibilityLabel="Demander au coach de refaire le plan" style={({ pressed }) => [styles.valider, { backgroundColor: p.texte, opacity: pressed ? 0.8 : 1 }]}>
                <Text style={[typo.corpsFort, { color: p.fond }]}>Refaire le plan</Text>
              </Pressable>
            </>
          ) : null}

          {etat === 'annulee' ? (
            <>
              <Text style={[typo.petit, { color: p.texteDoux }]}>{phraseAnnulation(carte)}</Text>
              <Pressable onPress={onRefaire} accessibilityRole="button" accessibilityLabel="Demander au coach un nouveau plan" style={({ pressed }) => [styles.secondaire, { borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Refaire un plan</Text>
              </Pressable>
            </>
          ) : null}

          {erreur ? (
            <View accessibilityRole="alert" style={styles.ligne}>
              <Picto nom="alerte" couleur={p.danger} />
              <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>{erreur}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** La légende du dessin : ce que veulent dire le pointillé, le plein et les hachures */
function Legende({ vue, periode }: { vue: VueApercu; periode?: { type: string; du: string; au: string } }) {
  const p = usePalette();
  return (
    <View style={styles.legende}>
      {vue === 'avant' ? (
        <Element libelle="séance prévue">
          <View style={[styles.echantillon, { backgroundColor: p.texte }]} />
        </Element>
      ) : (
        <>
          <Element libelle="retirée">
            <View style={[styles.echantillon, { borderWidth: 1, borderStyle: 'dashed', borderColor: p.texteMuet }]} />
          </Element>
          <Element libelle="nouvelle">
            <View style={[styles.echantillon, { backgroundColor: p.texte }]} />
          </Element>
          {periode ? (
            <Element libelle={`${nomPeriode(periode.type)}, ${jourCarte(periode.du)} → ${jourCarte(periode.au)}`}>
              <View style={[styles.echantillon, { overflow: 'hidden', borderRadius: 2 }]}>
                <Hachure couleur={p.danger} trait={p.texteMuet} />
              </View>
            </Element>
          ) : null}
        </>
      )}
    </View>
  );
}

function Element({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.element}>
      {children}
      <Text style={[typo.petit, { color: p.texteDoux }]}>{libelle}</Text>
    </View>
  );
}

/** Le plan ligne par ligne, avec la raison de chaque changement (accessible : c'est le texte qui remplace le dessin) */
function Detail({ carte }: { carte: CartePlanning }) {
  const p = usePalette();
  return (
    <View style={{ gap: 0 }}>
      {carte.lignes.map((l, i) => (
        <View key={i} style={[styles.detailLigne, { borderTopColor: p.trait }]}>
          <View style={[styles.detailBarre, { backgroundColor: l.sport ? couleurSport(p, l.sport) : p.danger }]} />
          <View style={{ flex: 1 }}>
            <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{l.texte}</Text>
            {l.raison ? <Text style={[typo.petit, { color: p.texteDoux }]}>{l.raison}</Text> : null}
            {l.structure ? <Text style={[typo.petit, { color: p.texteDoux }]}>{l.structure}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: rayon.l, overflow: 'hidden' },
  lisere: { height: 4 },
  corps: { padding: espace.e3, gap: espace.e3 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: rayon.base, overflow: 'hidden' },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  chargeLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bascules: { flexDirection: 'row', gap: 4 },
  bascule: { width: 44, height: 44, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  legende: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espace.e3, rowGap: 4 },
  element: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  echantillon: { width: 14, height: 10, borderRadius: 2 },
  detailBouton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  detailLigne: { flexDirection: 'row', gap: espace.e3, paddingVertical: espace.e2, borderTopWidth: StyleSheet.hairlineWidth },
  detailBarre: { width: 4, borderRadius: 2 },
  etat: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espace.e3, gap: espace.e2 },
  valider: { minHeight: 48, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
  boutons: { flexDirection: 'row', gap: espace.e2 },
  secondaire: { flex: 1, minHeight: 44, paddingHorizontal: espace.e3, borderWidth: 1, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
