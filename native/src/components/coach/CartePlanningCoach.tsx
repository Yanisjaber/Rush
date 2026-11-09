import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { periodesDuPlan } from '@/data/coach/apercu-plan';
import { descriptionPlan, dureeMinutes, jourCarte, MOT_ETAT_PLAN, nombreChangements, nomPeriode, nomSport, phraseAnnulation, resumePlan } from '@/data/coach/libelles';
import { plageSemaine, semainesDuPlan } from '@/data/coach/semaines-plan';
import type { JourSemaine, SemainePlan } from '@/data/coach/semaines-plan';
import type { CartePlanning, LignePlan } from '@/data/coach/types';
import { dateIsoLocale } from '@/data/outils/format';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { TicketSeance } from './TicketSeance';

// La carte d'un plan de modifications du calendrier, posée comme une grande bulle du coach : l'état, la phrase du coach, puis UNE LIGNE PAR SEMAINE
// (ses 7 jours en points, son volume) ; toucher une semaine déplie ses séances. Chaque séance ajoutée a un bouton « Détail » qui déplie son ticket (profil, blocs).
// Elle ne modifie RIEN toute seule : « Valider le plan » demande au serveur de tout revérifier puis d'appliquer le plan en une fois ; « Annuler le plan » défait tout.
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

type Pictogramme = 'attente' | 'ok' | 'alerte' | 'retour';
/** Au-delà, les semaines se replient derrière « Voir les autres semaines » (un plan d'un an en a une soixantaine) */
const SEMAINES_VISIBLES = 6;

function Picto({ nom, couleur, taille = 18 }: { nom: Pictogramme; couleur: string; taille?: number }) {
  return (
    <Svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {nom === 'attente' ? <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {nom === 'ok' ? <Path d="M5 12l5 5 9-10" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {nom === 'alerte' ? <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v6M12 16.5v.5" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {nom === 'retour' ? <Path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /> : null}
    </Svg>
  );
}

/** Le jour que concerne une ligne (celui où la séance arrive, ou celui où elle disparaît) */
const jourLigne = (l: LignePlan): string | undefined => (l.op === 'supprimer' ? l.de : l.op === 'indisponibilite' ? l.du : l.vers);

/** Le mot de l'étiquette d'une ligne : jamais la couleur seule */
function etiquette(l: LignePlan): string {
  if (l.op === 'ajouter') return 'Nouvelle';
  if (l.op === 'deplacer') return 'Déplacée';
  if (l.op === 'supprimer') return 'Retirée';
  if (l.op === 'repos') return l.poser === false ? 'Repos retiré' : 'Repos';
  const nom = nomPeriode(l.type);
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}

/** Une séance ajoutée : « 6 × 800 m · 52 min » quand le serveur a nommé la séance, sinon la phrase écrite par le serveur */
const texteLigne = (l: LignePlan): string => {
  if (l.op !== 'ajouter' || !l.nom || !l.minutes) return l.texte;
  // Le nom dit parfois déjà la durée (« Footing 30 min + 6 lignes droites ») : on ne la répète pas
  return /\b\d+\s*min\b/.test(l.nom) ? l.nom : `${l.nom} · ${dureeMinutes(l.minutes)}`;
};

export function CartePlanningCoach({ carte, occupee, erreur, onValider, onAnnuler, onRefaire, onVoirCalendrier }: Props) {
  const p = usePalette();
  const [toutesSemaines, setToutesSemaines] = useState(false);
  /** Les semaines dépliées (la première l'est d'office, tant qu'on n'a rien touché) */
  const [semOuvertes, setSemOuvertes] = useState<Record<number, boolean>>({});
  /** Les séances retirées sont regroupées sur une seule ligne ; ce bouton les liste */
  const [voirRetirees, setVoirRetirees] = useState(false);
  /** Une fois validé, le plan se réduit à une ligne ; ce bouton le déplie pour le relire */
  const [deplie, setDeplie] = useState(false);
  const [ouvertes, setOuvertes] = useState<Record<string, boolean>>({});
  const aujourdhui = useMemo(() => dateIsoLocale(new Date()), []);
  const etat = occupee && carte.etat === 'proposee' ? 'en_cours' : carte.etat;
  const compact = etat === 'ajoutee' && !deplie;
  const montrerPlan = (etat === 'proposee' || etat === 'en_cours' || etat === 'ajoutee') && !compact;
  const couleurEtat = { proposee: p.texte, en_cours: p.texte, ajoutee: p.ok, refusee: p.danger, annulee: p.texteMuet }[etat];
  // La couleur du bouton principal : celle du sport du plan s'il n'y en a qu'un (sinon neutre : la couleur désigne UN sport)
  const sports = new Set(carte.lignes.map((l) => l.sport).filter((s): s is string => !!s));
  const sportPlan = sports.size === 1 ? [...sports][0] : undefined;
  const teinte = sportPlan ? couleurSport(p, sportPlan) : p.texte;
  const encreTeinte = sportPlan ? p.encreSurCouleur : p.fond;
  // Ce qui compte d'abord : les séances ajoutées ou déplacées, les repos, les périodes. Les séances retirées (souvent des dizaines, toutes « remplacée par le plan mis à jour ») se regroupent en une ligne.
  const retirees = carte.lignes.filter((l) => l.op === 'supprimer');
  const semaines = useMemo(() => semainesDuPlan(carte.lignes), [carte.lignes]);
  const semainesVisibles = toutesSemaines ? semaines : semaines.slice(0, SEMAINES_VISIBLES);
  const periode = periodesDuPlan(carte.lignes)[0];
  const raisonCommune = retirees.length > 0 && retirees.every((l) => l.raison && l.raison === retirees[0].raison) ? retirees[0].raison : undefined;
  const raisonRetirees = retirees.length > 1 ? raisonCommune?.replace(/^remplacée\b/, 'remplacées') : raisonCommune;

  /** Une ligne du plan : le jour, ce qui change, sa raison, et pour une séance ajoutée le bouton « Détail » qui déplie son ticket */
  const rendreLigne = (l: LignePlan, cle: string) => {
    const ouverte = !!ouvertes[cle];
    const avecDetail = l.op === 'ajouter' && !!l.minutes;
    const jour = jourLigne(l);
    return (
      <View key={cle} style={[styles.ligneDuPlan, { borderTopColor: p.trait }]}>
        <View style={styles.ligneHaut}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.ligne}>
              <Text style={[typo.micro, { color: p.texteMuet }]}>{jour ? jourCarte(jour) : ''}</Text>
              <View style={[styles.etiquette, { borderColor: p.traitFort }]}>
                <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none', letterSpacing: 0 }]}>{etiquette(l)}</Text>
              </View>
            </View>
            <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{texteLigne(l)}</Text>
            {l.raison && !avecDetail ? <Text style={[typo.petit, { color: p.texteDoux }]}>{l.raison}</Text> : null}
          </View>
          {avecDetail ? (
            <Pressable
              onPress={() => setOuvertes((o) => ({ ...o, [cle]: !o[cle] }))}
              accessibilityRole="button"
              accessibilityState={{ expanded: ouverte }}
              accessibilityLabel={`${ouverte ? 'Masquer' : 'Voir'} le détail de la séance : ${texteLigne(l)}`}
              style={({ pressed }) => [styles.detail, { borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{ouverte ? 'Masquer' : 'Détail'}</Text>
            </Pressable>
          ) : null}
        </View>
        {avecDetail && ouverte && l.minutes ? (
          <View style={[styles.ticket, { backgroundColor: p.surface, borderColor: p.trait }]}>
            <TicketSeance
              couleur={couleurSport(p, l.sport ?? undefined)}
              jour={l.vers ? jourCarte(l.vers) : ''}
              titre={l.nom ?? texteLigne(l)}
              minutes={l.minutes}
              blocs={l.blocs}
              sport={l.sport ?? undefined}
              resume={l.structure}
              raison={l.raison}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.bulle, { backgroundColor: p.surface2 }]}>
      <View accessible accessibilityLabel={descriptionPlan(carte)} style={{ gap: 2 }}>
        <View style={styles.ligne}>
          <Picto nom={etat === 'ajoutee' ? 'ok' : etat === 'refusee' ? 'alerte' : etat === 'annulee' ? 'retour' : 'attente'} couleur={couleurEtat} />
          <Text style={[typo.petit, { color: couleurEtat, fontFamily: police.texte600 }]}>{compact ? 'Plan validé' : MOT_ETAT_PLAN[etat]}</Text>
        </View>
        <Text numberOfLines={2} style={[compact ? typo.corpsFort : typo.titre3, { color: p.texte }]}>
          {carte.intention || 'Plan de modifications'}
        </Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>
          {nombreChangements(carte.lignes)} · {resumePlan(carte.lignes)}
        </Text>
      </View>

      {montrerPlan ? (
        <>
          <View>
            {semainesVisibles.map((sem, idx) => {
              const ouverte = semOuvertes[sem.numero] ?? idx === 0;
              const plage = plageSemaine(sem.debut, sem.fin);
              return (
                <View key={sem.numero} style={[styles.semaine, { borderTopColor: p.trait }]}>
                  <Pressable
                    onPress={() => setSemOuvertes((o) => ({ ...o, [sem.numero]: !ouverte }))}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: ouverte }}
                    accessibilityLabel={`Semaine ${sem.numero}, ${plage}, ${sem.seances} séance${sem.seances > 1 ? 's' : ''}${sem.minutes > 0 ? `, ${dureeMinutes(sem.minutes)}` : ''}. ${ouverte ? 'Replier' : 'Déplier'}`}
                    style={styles.semaineTete}
                  >
                    <View style={{ width: 98 }}>
                      <Text style={[typo.corpsFort, { color: p.texte }]}>S{sem.numero}</Text>
                      <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'none', letterSpacing: 0 }]}>{plage}</Text>
                    </View>
                    <View style={styles.jours} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                      {sem.jours.map((j) => (
                        <PastilleJour key={j.iso} jour={j} />
                      ))}
                    </View>
                    <Text style={[typo.petit, styles.volume, { color: p.texteDoux }]}>{sem.minutes > 0 ? dureeMinutes(sem.minutes) : ''}</Text>
                    <Chevron ouvert={ouverte} couleur={p.texteMuet} />
                  </Pressable>
                  {ouverte ? <View>{sem.lignes.map((l, i) => rendreLigne(l, `${sem.numero}-${i}`))}</View> : null}
                </View>
              );
            })}
            {semaines.length > SEMAINES_VISIBLES ? (
              <Pressable
                onPress={() => setToutesSemaines((t) => !t)}
                accessibilityRole="button"
                accessibilityState={{ expanded: toutesSemaines }}
                accessibilityLabel={toutesSemaines ? 'Replier la liste des semaines' : `Voir les ${semaines.length - SEMAINES_VISIBLES} autres semaines`}
                style={[styles.autres, { borderTopColor: p.trait }]}
              >
                <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{toutesSemaines ? 'Replier' : `Voir les ${semaines.length - SEMAINES_VISIBLES} autres semaines`}</Text>
              </Pressable>
            ) : null}

            {periode ? (
              <View style={[styles.legende, { borderTopColor: p.trait }]}>
                <View style={[styles.echantillon, { borderColor: p.danger }]} />
                <Text style={[typo.petit, { color: p.texteDoux, flex: 1 }]}>
                  {nomPeriode(periode.type)}, {jourCarte(periode.du)} → {jourCarte(periode.au)}
                </Text>
              </View>
            ) : null}

            {retirees.length > 0 ? (
              <View style={[styles.ligneDuPlan, { borderTopColor: p.trait }]}>
                <View style={styles.ligneHaut}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.etiquette2}>
                      <View style={[styles.etiquette, { borderColor: p.traitFort }]}>
                        <Text style={[typo.micro, { color: p.texteDoux, textTransform: 'none', letterSpacing: 0 }]}>Retirées</Text>
                      </View>
                    </View>
                    <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{retirees.length > 1 ? `${retirees.length} séances retirées` : '1 séance retirée'}</Text>
                    {raisonRetirees ? <Text style={[typo.petit, { color: p.texteDoux }]}>{raisonRetirees}</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => setVoirRetirees((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: voirRetirees }}
                    accessibilityLabel={voirRetirees ? 'Masquer les séances retirées' : `Voir les ${retirees.length} séances retirées`}
                    style={({ pressed }) => [styles.detail, { borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{voirRetirees ? 'Masquer' : 'Voir'}</Text>
                  </Pressable>
                </View>
                {voirRetirees
                  ? retirees.map((l, i) => (
                      <Text key={i} style={[typo.petit, { color: p.texteDoux }]}>
                        {l.de ? `${jourCarte(l.de)} · ` : ''}
                        {l.sport ? nomSport(l.sport) : ''}
                        {l.minutes ? ` ${dureeMinutes(l.minutes)}` : l.sport ? '' : l.texte}
                      </Text>
                    ))
                  : null}
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      <View style={styles.etat}>
        {etat === 'proposee' ? (
          <Pressable
            onPress={onValider}
            accessibilityRole="button"
            accessibilityLabel={`Valider le plan : ${carte.intention}. ${nombreChangements(carte.lignes)} seront appliqués à ton calendrier.`}
            style={({ pressed }) => [styles.valider, { backgroundColor: teinte, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[typo.corpsFort, { color: encreTeinte }]}>Valider le plan</Text>
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
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={onVoirCalendrier}
              accessibilityRole="button"
              accessibilityLabel="Voir au calendrier"
              style={({ pressed }) => [styles.secondaire, { borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>Calendrier</Text>
            </Pressable>
            <Pressable
              onPress={() => setDeplie((d) => !d)}
              accessibilityRole="button"
              accessibilityState={{ expanded: deplie }}
              accessibilityLabel={deplie ? 'Masquer le détail du plan' : 'Revoir le détail du plan'}
              style={({ pressed }) => [styles.secondaire, { borderColor: p.contourChamp, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[typo.petit, { color: p.texte, fontFamily: police.texte600 }]}>{deplie ? 'Masquer' : 'Détail'}</Text>
            </Pressable>
          </View>
        ) : null}

        {etat === 'refusee' ? (
          <>
            <View accessible accessibilityLabel={`${MOT_ETAT_PLAN.refusee}. ${carte.motif ?? ''}`} style={[styles.ligne, { alignItems: 'flex-start' }]}>
              <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>{carte.motif ?? 'Ton calendrier a changé depuis la proposition.'} Rien n’a été modifié.</Text>
            </View>
            <Pressable onPress={onRefaire} accessibilityRole="button" accessibilityLabel="Demander au coach de refaire le plan" style={({ pressed }) => [styles.valider, { backgroundColor: teinte, opacity: pressed ? 0.8 : 1 }]}>
              <Text style={[typo.corpsFort, { color: encreTeinte }]}>Refaire le plan</Text>
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
  );
}

/**
 * Un jour de la semaine, en petit carré : plein à la couleur du sport quand une séance arrive ce jour-là, contour d'alerte pendant une période déclarée
 * (blessure, maladie : la légende l'écrit sous la liste), « R » pour un jour de repos. Purement visuel : le texte de la ligne dit la même chose.
 */
function PastilleJour({ jour }: { jour: JourSemaine }) {
  const p = usePalette();
  const sport = jour.sports[0];
  return (
    <View
      style={[
        styles.pastille,
        { borderColor: jour.periode ? p.danger : sport ? couleurSport(p, sport) : p.traitFort, borderWidth: jour.periode ? 1.5 : 1, backgroundColor: sport ? couleurSport(p, sport) : 'transparent' },
      ]}
    >
      {!sport && jour.repos ? <Text style={[typo.micro, { color: p.texteDoux, fontSize: 9, lineHeight: 11 }]}>R</Text> : null}
    </View>
  );
}

function Chevron({ ouvert, couleur }: { ouvert: boolean; couleur: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={ouvert ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  bulle: { borderRadius: rayon.bulle + 2, padding: espace.e3, gap: espace.e3 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  semaine: { borderTopWidth: StyleSheet.hairlineWidth },
  semaineTete: { flexDirection: 'row', alignItems: 'center', gap: espace.e2, minHeight: 48, paddingVertical: 4 },
  jours: { flexDirection: 'row', gap: 4, flex: 1, justifyContent: 'center' },
  pastille: { width: 13, height: 13, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  volume: { minWidth: 52, textAlign: 'right', fontVariant: ['tabular-nums'] },
  echantillon: { width: 12, height: 10, borderRadius: 3, borderWidth: 1.5 },
  legende: { flexDirection: 'row', alignItems: 'center', gap: espace.e2, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: espace.e2 },
  ligneDuPlan: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: espace.e2, gap: espace.e2 },
  ligneHaut: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  etiquette2: { flexDirection: 'row' },
  etiquette: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 },
  detail: { minHeight: 44, minWidth: 44, paddingHorizontal: espace.e3, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  ticket: { borderWidth: StyleSheet.hairlineWidth, borderRadius: rayon.carte, overflow: 'hidden' },
  autres: { borderTopWidth: StyleSheet.hairlineWidth, minHeight: 44, justifyContent: 'center' },
  etat: { gap: espace.e2 },
  valider: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  boutons: { flexDirection: 'row', gap: espace.e2 },
  secondaire: { flex: 1, minHeight: 44, paddingHorizontal: espace.e2, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
