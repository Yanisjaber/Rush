import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { nomDuType } from '@/data/catalogue-sports';
import { ChampHeure } from '@/components/ChampHeure';
import { ChampTexte } from '@/components/ChampTexte';
import { ChoixEffort } from '@/components/ChoixEffort';
import { EcranAjout } from '@/components/EcranAjout';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { ChampDate } from '@/components/ChampDate';
import { chargeEstimeeSortie, distanceEnMetres, formulaireDepuisSortie, formulaireSortieVide, ligneDeModification, sortieModifiable, SPORTS_AJOUT, validerSortie } from '@/data/ajouts';
import { champsValides } from '@/data/import-activite';
import { dateIsoLocale } from '@/data/format';
import { dureeDepuisHeure, heureDepuisDuree, texteDureeSaisie } from '@/data/heure';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { useSeance } from '@/hooks/useSeance';
import { useGardeSortie } from '@/hooks/useGardeSortie';
import { viderImport, lireImport } from '@/stores/import-en-attente';
import { useMenu } from '@/stores/menu';
import { espace } from '@/theme/couleurs';
import type { Seance } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Noter à la main une sortie déjà faite qui ne vient pas de Strava (ligne de activities, source « manual ») : sport, nom, heure, durée, distance, dénivelé, FC, effort, notes.
// Une sortie ne peut pas être dans le futur : pour ça, il y a « Séance prévue ».
// Avec un paramètre « id », c'est la modification d'une activité déjà saisie à la main : le formulaire part de ses valeurs.
export default function EcranAjoutSortie() {
  const p = usePalette();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const modif = id ? String(id) : '';
  const { seance, chargement, erreur } = useSeance(modif);
  if (modif && chargement) {
    return (
      <View accessible accessibilityLabel="Chargement" style={styles.centre}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (modif && (!seance || !sortieModifiable(seance))) {
    return (
      <View style={styles.centre}>
        <Text accessibilityRole="alert" style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>
          {seance ? 'Seule une activité saisie à la main peut se modifier.' : erreur || 'Activité introuvable.'}
        </Text>
      </View>
    );
  }
  return <FormulaireSortie key={modif || 'nouvelle'} seance={modif ? seance : null} />;
}

function FormulaireSortie({ seance }: { seance: Seance | null }) {
  const p = usePalette();
  const router = useRouter();
  const { creerSortie, modifierSortie } = useAjouts();
  const { filtre, familles } = useMenu(); // le sport où l'on était (ou le premier de la barre sur « Tous ») est pré-sélectionné
  const aujourdhui = dateIsoLocale(new Date());
  const depart = useDateAjout();
  const ouverture = seance ? formulaireDepuisSortie(seance) : null;
  // Venu d'un jour à venir : la date passe à aujourd'hui, et on le dit (sinon le changement surprend)
  const [ramene] = useState(!seance && depart > aujourdhui);
  const [date, setDate] = useState(ouverture ? ouverture.date : depart > aujourdhui ? aujourdhui : depart);
  const params = useLocalSearchParams(); // venant de « Importer » : les champs lus dans le fichier, relus ici (paramètres non fiables)
  const [f, setF] = useState(() => ouverture?.f ?? { ...formulaireSortieVide(filtre, familles), ...champsValides(params, SPORTS_AJOUT.map((s) => s.type)) });
  // Les données lourdes du fichier (flux, trace, tours) ne sont reprises que si on arrive depuis « Importer », et oubliées en quittant l'écran
  const [importe] = useState(() => (!seance && params.import === '1' ? lireImport() : null));
  useEffect(() => () => viderImport(), []);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const autoriser = useGardeSortie({ date, f }); // quitter avec une saisie non enregistrée demande confirmation

  const change = (suite: typeof f) => {
    setF(suite);
    setErreur('');
  };
  const charge = chargeEstimeeSortie(f); // l'estimation, avant même d'enregistrer
  const nomSport = nomDuType;

  async function enregistrer() {
    const r = validerSortie(f, date, aujourdhui, nomSport(f.type), importe);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = seance ? await modifierSortie(seance.id, ligneDeModification(seance, r.ligne)) : await creerSortie(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    autoriser();
    router.back();
  }

  const etiquette = (t: string) => <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{t}</Text>;
  return (
    <EcranAjout bouton="Enregistrer" enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
      {seance ? <Stack.Screen options={{ title: "Modifier l'activité" }} /> : null}
      {ramene ? <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16 }]}>Ce jour n'est pas encore passé : j'ai mis aujourd'hui. Pour un jour à venir, utilise « Séance prévue ».</Text> : null}
      <ChampDate date={date} max={aujourdhui} onChange={(iso) => { setDate(iso > aujourdhui ? aujourdhui : iso); setErreur(''); }} />
      <View style={styles.ligne}>
        <View style={{ flex: 1.4, gap: 6 }}>
          {etiquette('Sport')}
          <MenuDeroulantSport parType valeur={f.type} avecTous={false} onChoisir={(type) => change({ ...f, type: type ?? 'Run' })} />
        </View>
        <View style={{ flex: 1 }}>
          <ChampHeure valeur={f.heure} onChange={(h) => change({ ...f, heure: h })} />
        </View>
      </View>
      <ChampTexte etiquette="Nom (facultatif)" value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={120} placeholder={nomSport(f.type)} returnKeyType="done" />
      {/* La durée se choisit sur les roues d'Apple (heures et minutes), comme l'heure ; le champ montre « 4 h 37 min ». À côté, la charge : vide = estimée (le gris donne l'estimation) */}
      <View style={styles.ligne}>
        <View style={{ flex: 1.4 }}>
          <ChampHeure
            etiquette="Durée"
            valeur={heureDepuisDuree(f.heures, f.minutes)}
            affichage={texteDureeSaisie(f.heures, f.minutes)}
            onChange={(h) => change({ ...f, ...dureeDepuisHeure(h) })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <ChampTexte
            etiquette="Charge (pts)"
            value={f.tss}
            onChangeText={(t) => change({ ...f, tss: t })}
            keyboardType="number-pad"
            maxLength={4}
            placeholder={charge != null ? `≈ ${charge}` : ''}
            accessibilityLabel="Charge en points (laisse vide pour l'estimation)"
          />
        </View>
      </View>
      <View style={styles.ligne}>
        <View style={{ flex: 1 }}>
          <ChampTexte etiquette={distanceEnMetres(f.type) ? 'Distance (m)' : 'Distance (km)'} value={f.distance} onChangeText={(t) => change({ ...f, distance: t })} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(f.type) ? 'Distance en mètres' : 'Distance en kilomètres'} />
        </View>
        <View style={{ flex: 1 }}>
          <ChampTexte etiquette="Dénivelé (m)" value={f.dplus} onChangeText={(t) => change({ ...f, dplus: t })} keyboardType="number-pad" maxLength={5} accessibilityLabel="Dénivelé positif en mètres" />
        </View>
        <View style={{ flex: 1 }}>
          <ChampTexte etiquette="FC moy." value={f.fc} onChangeText={(t) => change({ ...f, fc: t })} keyboardType="number-pad" maxLength={3} accessibilityLabel="Fréquence cardiaque moyenne" />
        </View>
      </View>
      <ChoixEffort valeur={f.rpe} onChange={(v) => change({ ...f, rpe: v })} etiquette="Effort ressenti (facultatif)" />
      <ChampTexte etiquette="Notes (facultatif)" value={f.notes} onChangeText={(t) => change({ ...f, notes: t })} maxLength={2000} multiline placeholder="Un mot sur l'activité…" />
    </EcranAjout>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  ligne: { flexDirection: 'row', gap: espace.e2 },
});
