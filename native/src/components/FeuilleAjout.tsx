import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { ChoixCouleur, PastillesChoix } from '@/components/ChampsFeuille';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { SelecteurDate } from '@/components/SelecteurDate';
import {
  distanceEnMetres,
  formulaireCompetitionVide,
  formulaireNoteVide,
  formulaireSeanceVide,
  PALETTE_NOTE,
  SPORTS_AJOUT,
  TEXTE_MAX_NOTE,
  TYPES_NOTE,
  validerCompetition,
  validerNote,
  validerSeance,
} from '@/data/ajouts';
import { COULEURS_CYCLE, NOM_MAX_CYCLE, validerCycle } from '@/data/cycles';
import { dateIsoLocale } from '@/data/format';
import { useAjouts } from '@/hooks/useAjouts';
import { useCycles } from '@/hooks/useCycles';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La feuille du « + » du détail d'un jour : elle monte du bas et propose de créer, pour ce jour, une séance prévue, une compétition, une note ou un cycle.
// Un onglet par type ; chaque formulaire est vérifié avant l'envoi (voir data/ajouts.ts et data/cycles.ts) et dit clairement ce qui ne va pas.
type Onglet = 'seance' | 'competition' | 'note' | 'cycle';
const ONGLETS: { cle: Onglet; nom: string }[] = [
  { cle: 'seance', nom: 'Séance' },
  { cle: 'competition', nom: 'Compétition' },
  { cle: 'note', nom: 'Note' },
  { cle: 'cycle', nom: 'Cycle' },
];

const decaler = (iso: string, jours: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return dateIsoLocale(d);
};

export function FeuilleAjout({ ouvert, jour, titre, onFermer }: { ouvert: boolean; jour: string; titre: string; onFermer: () => void }) {
  const p = usePalette();
  const bas = useSafeAreaInsets().bottom;
  const { creerPrevue, creerNote } = useAjouts();
  const { cycles, creer: creerCycle } = useCycles();

  const [onglet, setOnglet] = useState<Onglet>('seance');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [seance, setSeance] = useState(formulaireSeanceVide());
  const [comp, setComp] = useState(formulaireCompetitionVide());
  const [note, setNote] = useState(formulaireNoteVide(jour));
  const [cycle, setCycle] = useState<{ nom: string; fin: string; couleur: string; sport: string | null }>({ nom: '', fin: decaler(jour, 27), couleur: COULEURS_CYCLE[0].hex, sport: null });

  // À chaque ouverture, on repart d'un formulaire vide pour le jour choisi
  useEffect(() => {
    if (!ouvert) return;
    setOnglet('seance');
    setErreur('');
    setEnCours(false);
    setSeance(formulaireSeanceVide());
    setComp(formulaireCompetitionVide());
    setNote(formulaireNoteVide(jour));
    setCycle({ nom: '', fin: decaler(jour, 27), couleur: COULEURS_CYCLE[0].hex, sport: null });
  }, [ouvert, jour]);

  const nomSport = (type: string) => {
    const cle = SPORTS_AJOUT.find((s) => s.type === type)?.cle as CleSport | undefined;
    return cle ? SPORTS[cle].nom : SPORTS.autre.nom;
  };

  async function enregistrer() {
    setErreur('');
    let message = '';
    if (onglet === 'seance') {
      const r = validerSeance(seance, jour, nomSport(seance.type));
      if (!r.ok) return setErreur(r.erreur);
      setEnCours(true);
      message = await creerPrevue(r.ligne);
    } else if (onglet === 'competition') {
      const r = validerCompetition(comp, jour);
      if (!r.ok) return setErreur(r.erreur);
      setEnCours(true);
      message = await creerPrevue(r.ligne);
    } else if (onglet === 'note') {
      const r = validerNote(note);
      if (!r.ok) return setErreur(r.erreur);
      setEnCours(true);
      message = await creerNote(r.ligne);
    } else {
      const r = validerCycle({ name: cycle.nom, from_date: jour, to_date: cycle.fin, color: cycle.couleur, sport: cycle.sport }, cycles);
      if (!r.ok) return setErreur(r.erreur);
      setEnCours(true);
      message = await creerCycle(r.valeur);
    }
    setEnCours(false);
    if (message) return setErreur(message);
    onFermer();
  }

  const champ = [typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }];
  const modifie = (fn: () => void) => {
    fn();
    setErreur('');
  };

  // Les pastilles et la ligne de couleurs : un choix efface l'erreur affichée
  const pastilles = <T extends string>(valeurs: { cle: T; nom: string }[], actuel: T, choisir: (v: T) => void, etiquette: string) => (
    <PastillesChoix valeurs={valeurs} actuel={actuel} onChoisir={(v) => modifie(() => choisir(v))} etiquette={etiquette} />
  );

  const ligneSports = (type: string, choisir: (t: string) => void) =>
    pastilles(
      SPORTS_AJOUT.map((s) => ({ cle: s.type, nom: SPORTS[s.cle as CleSport].court })),
      type,
      choisir,
      'Sport',
    );

  const couleurs = (liste: { hex: string; nom: string }[], actuelle: string, choisir: (hex: string) => void) => (
    <ChoixCouleur couleurs={liste} actuelle={actuelle} onChoisir={(hex) => modifie(() => choisir(hex))} />
  );

  const etiquette = (texte: string) => <Text style={[typo.micro, { color: p.texteDoux }]}>{texte}</Text>;

  return (
    <Modal visible={ouvert} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.conteneur} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[styles.feuille, { backgroundColor: p.surface, borderColor: p.traitFort, paddingBottom: bas + espace.e4 }]}>
          <View style={[styles.poignee, { backgroundColor: p.traitFort }]} />
          <Text accessibilityRole="header" numberOfLines={1} style={[typo.titre3, { color: p.texte }]}>
            {titre}
          </Text>
          {pastilles(
            ONGLETS.map((o) => ({ cle: o.cle, nom: o.nom })),
            onglet,
            setOnglet,
            'Ce que tu ajoutes',
          )}
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: espace.e3, paddingBottom: espace.e2 }}>
            {onglet === 'seance' ? (
              <>
                {etiquette('Sport')}
                {ligneSports(seance.type, (t) => setSeance({ ...seance, type: t }))}
                {etiquette('Nom (facultatif)')}
                <TextInput value={seance.nom} onChangeText={(t) => modifie(() => setSeance({ ...seance, nom: t }))} maxLength={120} placeholder={nomSport(seance.type)} placeholderTextColor={p.texteMuet} returnKeyType="done" accessibilityLabel="Nom de la séance" style={champ} />
                <View style={styles.ligne}>
                  <View style={{ flex: 1, gap: 6 }}>
                    {etiquette('Durée (min)')}
                    <TextInput value={seance.duree} onChangeText={(t) => modifie(() => setSeance({ ...seance, duree: t }))} keyboardType="number-pad" maxLength={4} accessibilityLabel="Durée en minutes" style={champ} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {etiquette('Heure')}
                    <TextInput value={seance.heure} onChangeText={(t) => modifie(() => setSeance({ ...seance, heure: t }))} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="18:00" placeholderTextColor={p.texteMuet} accessibilityLabel="Heure" style={champ} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    {etiquette(distanceEnMetres(seance.type) ? 'Distance (m)' : 'Distance (km)')}
                    <TextInput value={seance.distance} onChangeText={(t) => modifie(() => setSeance({ ...seance, distance: t }))} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(seance.type) ? 'Distance en mètres' : 'Distance en kilomètres'} style={champ} />
                  </View>
                </View>
              </>
            ) : null}

            {onglet === 'competition' ? (
              <>
                {etiquette('Sport')}
                {ligneSports(comp.type, (t) => setComp({ ...comp, type: t }))}
                {etiquette('Nom')}
                <TextInput value={comp.nom} onChangeText={(t) => modifie(() => setComp({ ...comp, nom: t }))} maxLength={120} placeholder="Marathon de Toulouse" placeholderTextColor={p.texteMuet} returnKeyType="done" accessibilityLabel="Nom de la compétition" style={champ} />
                {etiquette('Priorité')}
                {pastilles(
                  [
                    { cle: 'A' as const, nom: 'Objectif' },
                    { cle: 'B' as const, nom: 'Préparation' },
                  ],
                  comp.priorite,
                  (v) => setComp({ ...comp, priorite: v }),
                  'Priorité',
                )}
                <View style={styles.ligne}>
                  <View style={{ flex: 1, gap: 6 }}>
                    {etiquette("Type d'épreuve")}
                    <TextInput value={comp.epreuve} onChangeText={(t) => modifie(() => setComp({ ...comp, epreuve: t }))} maxLength={60} placeholder="Route, trail…" placeholderTextColor={p.texteMuet} accessibilityLabel="Type d'épreuve" style={champ} />
                  </View>
                  <View style={{ width: 120, gap: 6 }}>
                    {etiquette(distanceEnMetres(comp.type) ? 'Distance (m)' : 'Distance (km)')}
                    <TextInput value={comp.distance} onChangeText={(t) => modifie(() => setComp({ ...comp, distance: t }))} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(comp.type) ? 'Distance en mètres' : 'Distance en kilomètres'} style={champ} />
                  </View>
                </View>
              </>
            ) : null}

            {onglet === 'note' ? (
              <>
                {pastilles(
                  TYPES_NOTE.map((t) => ({ cle: t.cle, nom: t.nom })),
                  note.type,
                  (v) => setNote({ ...note, type: v, couleur: TYPES_NOTE.find((t) => t.cle === v)?.couleur ?? note.couleur }),
                  'Type de note',
                )}
                {etiquette(note.type === 'texte' ? 'Ta note' : 'Précision (facultatif)')}
                <TextInput
                  value={note.texte}
                  onChangeText={(t) => modifie(() => setNote({ ...note, texte: t }))}
                  maxLength={TEXTE_MAX_NOTE}
                  multiline
                  placeholder="Un mot sur ta journée…"
                  placeholderTextColor={p.texteMuet}
                  accessibilityLabel="Texte de la note"
                  style={[...champ, { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }]}
                />
                <SelecteurDate etiquette="Jusqu'au" date={note.a} onChange={(iso) => modifie(() => setNote({ ...note, a: iso < jour ? jour : iso }))} />
                {etiquette('Couleur')}
                {couleurs(PALETTE_NOTE.map((hex) => ({ hex, nom: hex })), note.couleur, (hex) => setNote({ ...note, couleur: hex }))}
              </>
            ) : null}

            {onglet === 'cycle' ? (
              <>
                {etiquette('Nom')}
                <TextInput value={cycle.nom} onChangeText={(t) => modifie(() => setCycle({ ...cycle, nom: t }))} maxLength={NOM_MAX_CYCLE} placeholder="Bloc force, Prépa spécifique, Affûtage…" placeholderTextColor={p.texteMuet} autoCorrect={false} returnKeyType="done" accessibilityLabel="Nom du cycle" style={champ} />
                <SelecteurDate etiquette="Fin du cycle (il commence ce jour)" date={cycle.fin} onChange={(iso) => modifie(() => setCycle({ ...cycle, fin: iso < jour ? jour : iso }))} />
                {etiquette('Sport')}
                <MenuDeroulantSport valeur={cycle.sport} onChoisir={(v) => modifie(() => setCycle({ ...cycle, sport: v, couleur: v ? couleurSport(p, v) : cycle.couleur }))} etiquette="Sport du cycle" />
                {etiquette('Couleur')}
                {couleurs(COULEURS_CYCLE, cycle.couleur, (hex) => setCycle({ ...cycle, couleur: hex }))}
              </>
            ) : null}
          </ScrollView>
          {erreur ? (
            <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
              {erreur}
            </Text>
          ) : null}
          <Bouton onPress={() => void enregistrer()}>
            {enCours ? 'Enregistrement…' : { seance: 'Planifier', competition: 'Ajouter la compétition', note: 'Ajouter la note', cycle: 'Créer le cycle' }[onglet]}
          </Bouton>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  conteneur: { flex: 1, justifyContent: 'flex-end' },
  feuille: { maxHeight: '90%', borderTopWidth: 1, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
  ligne: { flexDirection: 'row', gap: 8 },
});
