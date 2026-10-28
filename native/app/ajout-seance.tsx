import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { nomDuType } from '@/data/sports/catalogue-sports';
import { ChampHeure } from '@/components/ChampHeure';
import { ChampParcoursGpx, type ParcoursChoisi } from '@/components/ChampParcoursGpx';
import { ChampTexte } from '@/components/ChampTexte';
import { ChoixEffort } from '@/components/ChoixEffort';
import { EcranAjout } from '@/components/EcranAjout';
import { FeuilleBloc } from '@/components/FeuilleBloc';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { ProfilSeance } from '@/components/ProfilSeance';
import { ChampDate } from '@/components/ChampDate';
import { AvecPrevue } from '@/components/AvecPrevue';
import type { PrevueComplete } from '@/data/types';
import { blocsDePrevue, chargeEstimee, distanceEnMetres, formulaireDepuisSeance, formulaireSeanceVide, parcoursDePrevue, validerSeance } from '@/data/calendrier/ajouts';
import { deplacerBloc, nomDuBloc, peutAjouterBloc } from '@/data/calendrier/blocs-formulaire';
import { resumerGpx, type ResumeGpx } from '@/data/outils/gpx';
import { COULEURS_ZONE, indiceZone, metriquesDuSport, milieu, NOM_TYPE, resume, sportAvecStructure, texteCible, texteDuree, tousSegments, type Bloc } from '@/data/calendrier/structure';
import { heureDepuisDuree, heuresMinutesDepuis, minutesDepuisHeure, texteDureeSaisie } from '@/data/outils/heure';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { useGardeSortie } from '@/hooks/useGardeSortie';
import { useReferences } from '@/hooks/useReferences';
import { useMenu } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Planifier une séance : sport, nom, heure, et pour le vélo, la course et la natation, des blocs (échauffement, intervalles, retour au calme…) dont la durée et la charge
// se calculent. Sans bloc, on saisit simplement une durée. La séance est écrite dans activity_planned, comme sur le site.
// Avec un paramètre « id », c'est la modification d'une séance déjà enregistrée : le formulaire part de ses valeurs (voir AvecPrevue).
export default function EcranAjoutSeance() {
  return <AvecPrevue>{(prevue) => <FormulaireSeance key={prevue?.id ?? 'nouvelle'} prevue={prevue} />}</AvecPrevue>;
}

function FormulaireSeance({ prevue }: { prevue: PrevueComplete | null }) {
  const p = usePalette();
  const router = useRouter();
  const { creerPrevue, modifierPrevue } = useAjouts();
  const reference = useReferences();
  const { filtre, familles } = useMenu(); // le sport où l'on était (ou le premier de la barre sur « Tous ») est pré-sélectionné
  const dateParDefaut = useDateAjout();
  const [date, setDate] = useState(prevue?.date ?? dateParDefaut);
  const [f, setF] = useState(() => (prevue ? formulaireDepuisSeance(prevue) : formulaireSeanceVide(filtre, familles)));
  const [blocs, setBlocs] = useState<Bloc[]>(() => (prevue ? blocsDePrevue(prevue) : []));
  const [edition, setEdition] = useState<{ index: number | null } | null>(null); // le bloc ouvert dans la feuille (null = fermée, index null = nouveau)
  const [parcours, setParcours] = useState<ParcoursChoisi | null>(() => {
    const fichier = prevue ? parcoursDePrevue(prevue) : null;
    const lu = fichier ? resumerGpx(fichier.contenu) : null;
    return fichier && lu?.ok ? { fichier, resume: lu.resume } : null;
  }); // le GPX choisi
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const autoriser = useGardeSortie({ date, f, blocs, gpx: parcours?.fichier.nom ?? null });

  const metriques = metriquesDuSport(f.type);
  const aStructure = sportAvecStructure(f.type);
  const calcul = blocs.length && aStructure ? resume(blocs, reference, f.type) : null;
  const dureeSaisie = heuresMinutesDepuis(f.duree);
  const charge = chargeEstimee(f, blocs, reference); // la charge estimée, avant même d'enregistrer
  const nomSport = nomDuType;

  const change = (suite: typeof f) => {
    setF(suite);
    setErreur('');
  };

  // Changer de sport : sans structure (muscu, Hyrox…) les blocs disparaissent ; sinon leur mesure s'adapte au sport (watts → allure en passant du vélo à la course)
  function changerSport(type: string) {
    change({ ...f, type });
    if (!sportAvecStructure(type)) return setBlocs([]);
    const permises = metriquesDuSport(type);
    setBlocs((liste) => liste.map((b) => (permises.includes(b.metric) ? b : { ...b, metric: permises[0], unit: b.unit })));
  }

  async function enregistrer() {
    const r = validerSeance(f, date, nomSport(f.type), blocs, reference, parcours?.fichier ?? null);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = prevue ? await modifierPrevue(prevue.id, r.ligne) : await creerPrevue(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    autoriser();
    router.back();
  }

  // Reprendre la distance et le dénivelé du parcours dans les champs (en mètres pour la natation)
  const utiliserParcours = ({ distanceKm, denivele }: ResumeGpx) => {
    change({
      ...f,
      distance: distanceEnMetres(f.type) ? String(Math.round(distanceKm * 1000)) : String(distanceKm).replace('.', ','),
      dplus: denivele != null ? String(denivele) : f.dplus,
    });
  };

  const enregistrerBloc = (b: Bloc) => {
    setBlocs((liste) => (edition?.index == null ? [...liste, b] : liste.map((x, i) => (i === edition.index ? b : x))));
    setEdition(null);
    setErreur('');
  };

  const etiquette = (t: string) => <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{t}</Text>;
  const dureeBloc = (b: Bloc) => tousSegments([b]).reduce((t, { seg }) => t + seg.min, 0);
  const blocEdite = edition?.index != null ? blocs[edition.index] ?? null : null;

  return (
    <>
      <Stack.Screen options={{ title: prevue ? 'Modifier la séance' : 'Séance prévue' }} />
      <EcranAjout bouton={prevue ? 'Enregistrer' : 'Planifier'} enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
        <ChampDate date={date} onChange={(iso) => { setDate(iso); setErreur(''); }} />
        <View style={styles.ligne}>
          <View style={{ flex: 1.4, gap: 6 }}>
            {etiquette('Sport')}
            <MenuDeroulantSport parType valeur={f.type} avecTous={false} onChoisir={(type) => changerSport(type ?? 'Run')} />
          </View>
          <View style={{ flex: 1 }}>
            <ChampHeure valeur={f.heure} onChange={(h) => change({ ...f, heure: h })} />
          </View>
        </View>
        <ChampTexte etiquette="Nom (facultatif)" value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={120} placeholder={nomSport(f.type)} returnKeyType="done" />

        {calcul ? (
          <View style={{ gap: espace.e3 }}>
            <View style={[styles.profil, { backgroundColor: p.surface }]}>
              <ProfilSeance blocs={blocs} hauteur={46} />
            </View>
            <View style={styles.pastilles}>
              <View accessible accessibilityLabel={`${calcul.dureeMin} minutes`} style={[styles.pastille, { backgroundColor: p.surface2 }]}>
                <Text style={[typo.corpsFort, { color: p.texte }]}>
                  {texteDuree(calcul.dureeMin)} <Text style={[typo.petit, { color: p.texteDoux }]}>durée</Text>
                </Text>
              </View>
              <View accessible accessibilityLabel={`${calcul.tss} points de charge estimés`} style={[styles.pastille, { backgroundColor: p.surface2 }]}>
                <Text style={[typo.corpsFort, { color: p.texte }]}>
                  {calcul.tss} <Text style={[typo.petit, { color: p.texteDoux }]}>pts estimés</Text>
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {aStructure ? (
          <View style={{ gap: espace.e2 }}>
            {blocs.map((b, i) => {
              const z = indiceZone(milieu(b.work), b.metric);
              return (
                <Pressable
                  key={i}
                  onPress={() => setEdition({ index: i })}
                  accessibilityRole="button"
                  accessibilityLabel={`${nomDuBloc(b, NOM_TYPE)}, ${texteDuree(dureeBloc(b))}. Modifier`}
                  style={[styles.bloc, { backgroundColor: p.surface }]}
                >
                  <View style={[styles.barreZone, { backgroundColor: COULEURS_ZONE[Math.min(z, COULEURS_ZONE.length - 1)] }]} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                      {b.type === 'interval' ? `${nomDuBloc(b, NOM_TYPE)} · ${b.reps} fois` : nomDuBloc(b, NOM_TYPE)}
                    </Text>
                    <Text numberOfLines={2} style={[typo.petit, { color: p.texteDoux }]}>
                      {texteDuree(b.work.min)} {texteCible(b.work, b.metric, reference, f.type)}
                      {b.type === 'interval' && b.rec ? ` · récup ${texteDuree(b.rec.min)}` : ''}
                    </Text>
                  </View>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>{texteDuree(dureeBloc(b))}</Text>
                </Pressable>
              );
            })}
            {peutAjouterBloc(blocs.length) ? (
              <Pressable onPress={() => setEdition({ index: null })} accessibilityRole="button" accessibilityLabel="Ajouter un bloc" style={[styles.ajout, { borderColor: p.traitFort }]}>
                <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{blocs.length ? '+ Ajouter un bloc' : '+ Construire la séance par blocs'}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.ligne}>
          {!calcul ? (
            <View style={{ flex: 1 }}>
              {/* Comme « Activité déjà faite » : la durée se choisit sur les roues d'Apple (heures et minutes) */}
              <ChampHeure
                etiquette="Durée"
                valeur={heureDepuisDuree(dureeSaisie.heures, dureeSaisie.minutes)}
                affichage={texteDureeSaisie(dureeSaisie.heures, dureeSaisie.minutes)}
                onChange={(h) => change({ ...f, duree: minutesDepuisHeure(h) })}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <ChampTexte etiquette={distanceEnMetres(f.type) ? 'Distance (m)' : 'Distance (km)'} value={f.distance} onChangeText={(t) => change({ ...f, distance: t })} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(f.type) ? 'Distance en mètres' : 'Distance en kilomètres'} />
          </View>
        </View>
        <View style={styles.ligne}>
          <View style={{ flex: 1 }}>
            <ChampTexte etiquette="Dénivelé + (m)" value={f.dplus} onChangeText={(t) => change({ ...f, dplus: t })} keyboardType="number-pad" maxLength={5} accessibilityLabel="Dénivelé positif en mètres" />
          </View>
          {!calcul ? (
            <View style={{ flex: 1 }}>
              <ChampTexte etiquette="Charge (pts)" value={f.tss} onChangeText={(t) => change({ ...f, tss: t })} keyboardType="number-pad" maxLength={4} placeholder={charge != null ? `≈ ${charge}` : ''} accessibilityLabel="Charge en points (laisse vide pour l'estimation)" />
            </View>
          ) : null}
        </View>
        <ChoixEffort valeur={f.rpe} onChange={(v) => change({ ...f, rpe: v })} etiquette="Effort estimé (facultatif)" />
        <View style={{ gap: 6 }}>
          <ChampParcoursGpx etiquette="Parcours GPX (facultatif)" parcours={parcours} onChange={setParcours} onErreur={setErreur} onReprendre={utiliserParcours} />
        </View>
        <ChampTexte etiquette="Notes (facultatif)" value={f.notes} onChangeText={(t) => change({ ...f, notes: t })} maxLength={2000} multiline />
      </EcranAjout>
      <FeuilleBloc
        ouvert={edition !== null}
        bloc={blocEdite}
        metriques={metriques}
        sport={f.type}
        reference={reference}
        onFermer={() => setEdition(null)}
        onValider={enregistrerBloc}
        onSupprimer={
          edition?.index != null
            ? () => {
                setBlocs((l) => l.filter((_, i) => i !== edition.index));
                setEdition(null);
              }
            : undefined
        }
        onDupliquer={
          edition?.index != null && peutAjouterBloc(blocs.length)
            ? () => {
                setBlocs((l) => [...l.slice(0, edition.index! + 1), l[edition.index!], ...l.slice(edition.index! + 1)]);
                setEdition(null);
              }
            : undefined
        }
        onDeplacer={
          edition?.index != null
            ? (sens) => {
                const i = edition.index!;
                setBlocs((l) => deplacerBloc(l, i, sens));
                setEdition({ index: Math.min(blocs.length - 1, Math.max(0, i + sens)) });
              }
            : undefined
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  ligne: { flexDirection: 'row', gap: espace.e2 },
  profil: { borderRadius: rayon.bloc, padding: espace.e3 },
  pastilles: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pastille: { height: 32, borderRadius: rayon.rond, paddingHorizontal: 12, justifyContent: 'center' },
  bloc: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: rayon.base, paddingHorizontal: 12, paddingVertical: 8 },
  barreZone: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  ajout: { minHeight: 48, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: rayon.rond, alignItems: 'center', justifyContent: 'center' },
});
