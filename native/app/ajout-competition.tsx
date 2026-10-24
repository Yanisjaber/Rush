import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PastillesChoix } from '@/components/ChampsFeuille';
import { ChampDate } from '@/components/ChampDate';
import { nomDuType } from '@/data/catalogue-sports';
import { ChampHeure } from '@/components/ChampHeure';
import { ChampParcoursGpx, type ParcoursChoisi } from '@/components/ChampParcoursGpx';
import { ChampTexte } from '@/components/ChampTexte';
import { ChoixEffort } from '@/components/ChoixEffort';
import { Dossard } from '@/components/Dossard';
import { EcranAjout } from '@/components/EcranAjout';
import { MenuDeroulantChoix } from '@/components/MenuDeroulantChoix';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { OngletsSegment } from '@/components/OngletsSegment';
import { cleDuType, distanceEnMetres, formulaireCompetitionVide, validerCompetition } from '@/data/ajouts';
import { aUnFormat, allureMoyenne, champNiveau, federationsDuSport, FORMATS_TRI, lireTempsCible, TYPES_EPREUVE_VELO } from '@/data/competition';
import { formatDateCourte, formatJoursAvant, joursAvant } from '@/data/format';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { useMenu } from '@/stores/menu';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ajouter une compétition (une ligne de activity_planned, catégorie « competition »). Le dossard en haut se remplit pendant la saisie ; dessous, trois onglets :
// Épreuve (nom, sport, priorité, date, heure, type, fédération, niveau, format), Parcours (temps cible, distance, dénivelé, tours, GPX) et Objectif (charge, effort, notes).
type Onglet = 'epreuve' | 'parcours' | 'objectif';
const ONGLETS: { cle: Onglet; nom: string }[] = [
  { cle: 'epreuve', nom: 'Épreuve' },
  { cle: 'parcours', nom: 'Parcours' },
  { cle: 'objectif', nom: 'Objectif' },
];

export default function EcranAjoutCompetition() {
  const p = usePalette();
  const router = useRouter();
  const { creerPrevue } = useAjouts();
  const { filtre, familles } = useMenu(); // le sport où l'on était (ou le premier de la barre sur « Tous ») est pré-sélectionné
  const [onglet, setOnglet] = useState<Onglet>('epreuve');
  const [date, setDate] = useState(useDateAjout());
  const [f, setF] = useState(() => formulaireCompetitionVide(filtre, familles));
  const [parcours, setParcours] = useState<ParcoursChoisi | null>(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const change = (suite: typeof f) => {
    setF(suite);
    setErreur('');
  };

  // Changer de sport : une fédération, un format ou un niveau qui n'existent pas pour le nouveau sport sont retirés
  function changerSport(type: string) {
    const federation = federationsDuSport(type).includes(f.federation) ? f.federation : '';
    change({ ...f, type, federation, niveau: federation === f.federation ? f.niveau : '', format: aUnFormat(type) ? f.format : '', tours: type === 'Ride' ? f.tours : '', epreuve: (type === 'Ride') === TYPES_EPREUVE_VELO.includes(f.epreuve) ? f.epreuve : '' }); // en vélo : un des trois types ; ailleurs : un texte libre
  }

  async function enregistrer() {
    const r = validerCompetition(f, date, parcours?.fichier ?? null);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = await creerPrevue(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  // Le dossard du haut : nom, jour et heure, sport, fédération, type d'épreuve, distance, et le compte à rebours
  const distance = f.distance.trim() ? `${f.distance.trim()} ${distanceEnMetres(f.type) ? 'm' : 'km'}` : '';
  const detail = [`${formatDateCourte(date)} · ${f.heure}`, nomDuType(f.type), f.federation, f.epreuve.trim(), distance].filter(Boolean).join(' · ');

  const federations = federationsDuSport(f.type);
  const niveau = champNiveau(f.federation);
  const cible = lireTempsCible(f.cible);
  const km = Number(f.distance.replace(',', '.'));
  const allure = cible.ok ? allureMoyenne(f.type, distanceEnMetres(f.type) ? km / 1000 : km, cible.minutes) : null;

  const etiquette = (t: string) => <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{t}</Text>;

  const entete = (
    <>
      <Dossard
        taille="m"
        sport={cleDuType(f.type)}
        etiquette={f.priorite === 'A' ? 'Compétition · Objectif' : 'Compétition · Préparation'}
        nom={f.nom.trim() || 'Ta course'}
        detail={detail}
        valeur={formatJoursAvant(joursAvant(date))}
      />
      <OngletsSegment onglets={ONGLETS} actuel={onglet} onChoisir={setOnglet} etiquette="Sections de la compétition" />
    </>
  );

  return (
    <EcranAjout bouton="Ajouter la compétition" enCours={enCours} erreur={erreur} onValider={() => void enregistrer()} entete={entete}>
      {onglet === 'epreuve' ? (
        <>
          <ChampTexte etiquette="Nom" value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={120} placeholder="Marathon de Toulouse" returnKeyType="done" />
          <View style={{ gap: 6 }}>
            {etiquette('Sport')}
            <MenuDeroulantSport parType valeur={f.type} avecTous={false} onChoisir={(type) => changerSport(type ?? 'Run')} />
          </View>
          <View style={{ gap: 6 }}>
            {etiquette('Priorité')}
            <PastillesChoix
              valeurs={[
                { cle: 'A' as const, nom: 'Objectif' },
                { cle: 'B' as const, nom: 'Préparation' },
              ]}
              actuel={f.priorite}
              onChoisir={(v) => change({ ...f, priorite: v })}
              etiquette="Priorité"
            />
            <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16 }]}>{f.priorite === 'A' ? 'Ta course principale : la préparation vise cette date.' : 'Une course pour te tester, sans viser le pic de forme.'}</Text>
          </View>
          <ChampDate date={date} onChange={(iso) => { setDate(iso); setErreur(''); }} />
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <ChampHeure etiquette="Heure de départ" valeur={f.heure} onChange={(h) => change({ ...f, heure: h })} />
            </View>
            <View style={{ flex: 1.3 }}>
              {f.type === 'Ride' ? (
                <MenuDeroulantChoix etiquette="Type d'épreuve" valeur={f.epreuve} options={TYPES_EPREUVE_VELO.map((t) => ({ cle: t, nom: t }))} onChoisir={(t) => change({ ...f, epreuve: t })} />
              ) : (
                <ChampTexte etiquette="Type d'épreuve" value={f.epreuve} onChangeText={(t) => change({ ...f, epreuve: t })} maxLength={60} placeholder="Route, trail…" />
              )}
            </View>
          </View>
          {federations.length ? (
            <View style={styles.ligne}>
              <View style={{ flex: 1 }}>
                <MenuDeroulantChoix etiquette="Fédération" valeur={f.federation} options={federations.map((x) => ({ cle: x, nom: x }))} onChoisir={(x) => change({ ...f, federation: x, niveau: '' })} />
              </View>
              <View style={{ flex: 1.3 }}>
                {niveau.liste ? (
                  <MenuDeroulantChoix etiquette="Catégorie" valeur={f.niveau} options={niveau.liste.map(([code, nom]) => ({ cle: code, nom }))} onChoisir={(x) => change({ ...f, niveau: x })} />
                ) : (
                  <ChampTexte etiquette="Niveau" value={f.niveau} onChangeText={(t) => change({ ...f, niveau: t })} maxLength={60} placeholder={niveau.exemple} />
                )}
              </View>
            </View>
          ) : null}
          {aUnFormat(f.type) ? <MenuDeroulantChoix etiquette="Format" valeur={f.format} options={FORMATS_TRI.map((x) => ({ cle: x, nom: x }))} onChoisir={(x) => change({ ...f, format: x })} /> : null}
        </>
      ) : null}

      {onglet === 'parcours' ? (
        <>
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <ChampTexte etiquette="Temps cible" value={f.cible} onChangeText={(t) => change({ ...f, cible: t })} maxLength={8} placeholder="3h45" autoCapitalize="none" accessibilityLabel="Temps cible, par exemple 3h45" />
            </View>
            <View style={{ flex: 1 }}>
              <ChampTexte etiquette={distanceEnMetres(f.type) ? 'Distance (m)' : 'Distance (km)'} value={f.distance} onChangeText={(t) => change({ ...f, distance: t })} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(f.type) ? 'Distance en mètres' : 'Distance en kilomètres'} />
            </View>
          </View>
          <View style={styles.ligne}>
            <View style={{ flex: 1 }}>
              <ChampTexte etiquette="Dénivelé + (m)" value={f.dplus} onChangeText={(t) => change({ ...f, dplus: t })} keyboardType="number-pad" maxLength={5} accessibilityLabel="Dénivelé positif en mètres" />
            </View>
            {f.type === 'Ride' ? (
              <View style={{ flex: 1 }}>
                <ChampTexte etiquette="Nombre de tours" value={f.tours} onChangeText={(t) => change({ ...f, tours: t })} keyboardType="number-pad" maxLength={3} accessibilityLabel="Nombre de tours" />
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
          {allure ? (
            <Text accessibilityLabel={`${allure.libelle} ${allure.valeur}`} style={[typo.corps, { color: p.texteDoux, paddingLeft: 16 }]}>
              {allure.libelle} <Text style={{ fontFamily: police.texte600, color: p.texte }}>{allure.valeur}</Text>
            </Text>
          ) : null}
          <ChampParcoursGpx
            etiquette="Parcours GPX (facultatif)"
            parcours={parcours}
            onChange={setParcours}
            onErreur={setErreur}
            onReprendre={({ distanceKm, denivele }) =>
              change({ ...f, distance: distanceEnMetres(f.type) ? String(Math.round(distanceKm * 1000)) : String(distanceKm).replace('.', ','), dplus: denivele != null ? String(denivele) : f.dplus })
            }
          />
        </>
      ) : null}

      {onglet === 'objectif' ? (
        <>
          <ChampTexte etiquette="Charge estimée (pts, facultatif)" value={f.tss} onChangeText={(t) => change({ ...f, tss: t })} keyboardType="number-pad" maxLength={4} accessibilityLabel="Charge estimée en points" />
          <ChoixEffort valeur={f.rpe} onChange={(v) => change({ ...f, rpe: v })} etiquette="Effort estimé (facultatif)" />
          <ChampTexte etiquette="Notes (facultatif)" value={f.notes} onChangeText={(t) => change({ ...f, notes: t })} maxLength={2000} multiline placeholder="Stratégie, observations, objectifs…" />
        </>
      ) : null}
    </EcranAjout>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  ligne: { flexDirection: 'row', gap: espace.e2 },
});
