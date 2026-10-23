import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EcranAjout } from '@/components/EcranAjout';
import { FeuilleBloc } from '@/components/FeuilleBloc';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { ProfilSeance } from '@/components/ProfilSeance';
import { SelecteurDate } from '@/components/SelecteurDate';
import { cleDuType, distanceEnMetres, formulaireSeanceVide, typeDeCle, validerSeance } from '@/data/ajouts';
import { deplacerBloc, nomDuBloc, peutAjouterBloc } from '@/data/blocs-formulaire';
import { COULEURS_ZONE, indiceZone, metriquesDuSport, milieu, NOM_TYPE, resume, sportAvecStructure, texteCible, texteDuree, tousSegments, type Bloc } from '@/data/structure';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { useReferences } from '@/hooks/useReferences';
import { espace, rayon } from '@/theme/couleurs';
import { SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Planifier une séance : sport, nom, heure, et pour le vélo, la course et la natation, des blocs (échauffement, intervalles, retour au calme…) dont la durée et la charge
// se calculent. Sans bloc, on saisit simplement une durée. La séance est écrite dans activity_planned, comme sur le site.
export default function EcranAjoutSeance() {
  const p = usePalette();
  const router = useRouter();
  const { creerPrevue } = useAjouts();
  const reference = useReferences();
  const [date, setDate] = useState(useDateAjout());
  const [f, setF] = useState(formulaireSeanceVide());
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [edition, setEdition] = useState<{ index: number | null } | null>(null); // le bloc ouvert dans la feuille (null = fermée, index null = nouveau)
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const metriques = metriquesDuSport(f.type);
  const aStructure = sportAvecStructure(f.type);
  const calcul = blocs.length && aStructure ? resume(blocs, reference, f.type) : null;
  const nomSport = (type: string) => SPORTS[cleDuType(type) as CleSport].nom;

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
    const r = validerSeance(f, date, nomSport(f.type), blocs, reference);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = await creerPrevue(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  const enregistrerBloc = (b: Bloc) => {
    setBlocs((liste) => (edition?.index == null ? [...liste, b] : liste.map((x, i) => (i === edition.index ? b : x))));
    setEdition(null);
    setErreur('');
  };

  const champ = [typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }];
  const etiquette = (t: string) => <Text style={[typo.micro, { color: p.texteDoux }]}>{t}</Text>;
  const dureeBloc = (b: Bloc) => tousSegments([b]).reduce((t, { seg }) => t + seg.min, 0);
  const blocEdite = edition?.index != null ? blocs[edition.index] ?? null : null;

  return (
    <>
      <EcranAjout titre="Nouvelle séance" bouton="Planifier" enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
        <SelecteurDate etiquette="Date" date={date} onChange={(iso) => { setDate(iso); setErreur(''); }} />
        <View style={styles.ligne}>
          <View style={{ flex: 1.4, gap: 6 }}>
            {etiquette('Sport')}
            <MenuDeroulantSport valeur={cleDuType(f.type)} avecTous={false} onChoisir={(cle) => changerSport(typeDeCle(cle ?? 'autre'))} />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {etiquette('Heure')}
            <TextInput value={f.heure} onChangeText={(t) => change({ ...f, heure: t })} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="18:00" placeholderTextColor={p.texteMuet} accessibilityLabel="Heure" style={champ} />
          </View>
        </View>
        <View style={{ gap: 6 }}>
          {etiquette('Nom (facultatif)')}
          <TextInput value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={120} placeholder={nomSport(f.type)} placeholderTextColor={p.texteMuet} returnKeyType="done" accessibilityLabel="Nom de la séance" style={champ} />
        </View>

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
            <View style={{ flex: 1, gap: 6 }}>
              {etiquette('Durée (min)')}
              <TextInput value={f.duree} onChangeText={(t) => change({ ...f, duree: t })} keyboardType="number-pad" maxLength={4} accessibilityLabel="Durée en minutes" style={champ} />
            </View>
          ) : null}
          <View style={{ flex: 1, gap: 6 }}>
            {etiquette(distanceEnMetres(f.type) ? 'Distance (m)' : 'Distance (km)')}
            <TextInput value={f.distance} onChangeText={(t) => change({ ...f, distance: t })} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(f.type) ? 'Distance en mètres' : 'Distance en kilomètres'} style={champ} />
          </View>
        </View>
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
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
  ligne: { flexDirection: 'row', gap: espace.e2 },
  profil: { borderRadius: rayon.bloc, padding: espace.e3 },
  pastilles: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pastille: { height: 32, borderRadius: rayon.rond, paddingHorizontal: 12, justifyContent: 'center' },
  bloc: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: rayon.base, paddingHorizontal: 12, paddingVertical: 8 },
  barreZone: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  ajout: { minHeight: 48, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
