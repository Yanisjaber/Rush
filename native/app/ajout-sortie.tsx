import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { EcranAjout } from '@/components/EcranAjout';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { SelecteurDate } from '@/components/SelecteurDate';
import { cleDuType, distanceEnMetres, formulaireSortieVide, typeDeCle, validerSortie } from '@/data/ajouts';
import { dateIsoLocale } from '@/data/format';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { espace, rayon } from '@/theme/couleurs';
import { SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Noter à la main une sortie déjà faite qui ne vient pas de Strava (ligne de activities, source « manual ») : sport, nom, heure, durée, distance, dénivelé, FC, effort, notes.
// Une sortie ne peut pas être dans le futur : pour ça, il y a « Séance prévue ».
export default function EcranAjoutSortie() {
  const p = usePalette();
  const router = useRouter();
  const { creerSortie } = useAjouts();
  const aujourdhui = dateIsoLocale(new Date());
  const depart = useDateAjout();
  const [date, setDate] = useState(depart > aujourdhui ? aujourdhui : depart);
  const [f, setF] = useState(formulaireSortieVide());
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const change = (suite: typeof f) => {
    setF(suite);
    setErreur('');
  };
  const nomSport = (type: string) => SPORTS[cleDuType(type) as CleSport].nom;

  async function enregistrer() {
    const r = validerSortie(f, date, aujourdhui, nomSport(f.type));
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = await creerSortie(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  const champ = [typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }];
  const etiquette = (t: string) => <Text style={[typo.micro, { color: p.texteDoux }]}>{t}</Text>;
  return (
    <EcranAjout titre="Sortie déjà faite" bouton="Enregistrer" enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
      <SelecteurDate etiquette="Date" date={date} onChange={(iso) => { setDate(iso > aujourdhui ? aujourdhui : iso); setErreur(''); }} />
      <View style={styles.ligne}>
        <View style={{ flex: 1.4, gap: 6 }}>
          {etiquette('Sport')}
          <MenuDeroulantSport valeur={cleDuType(f.type)} avecTous={false} onChoisir={(cle) => change({ ...f, type: typeDeCle(cle ?? 'autre') })} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {etiquette('Heure')}
          <TextInput value={f.heure} onChangeText={(t) => change({ ...f, heure: t })} keyboardType="numbers-and-punctuation" maxLength={5} placeholder="07:30" placeholderTextColor={p.texteMuet} accessibilityLabel="Heure" style={champ} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {etiquette('Nom (facultatif)')}
        <TextInput value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={120} placeholder={nomSport(f.type)} placeholderTextColor={p.texteMuet} returnKeyType="done" accessibilityLabel="Nom de la sortie" style={champ} />
      </View>
      <View style={{ gap: 6 }}>
        {etiquette('Durée')}
        <View style={styles.duree}>
          <TextInput value={f.heures} onChangeText={(t) => change({ ...f, heures: t })} keyboardType="number-pad" maxLength={2} accessibilityLabel="Heures" style={[...champ, styles.centre]} />
          <Text style={[typo.corps, { color: p.texteDoux }]}>h</Text>
          <TextInput value={f.minutes} onChangeText={(t) => change({ ...f, minutes: t })} keyboardType="number-pad" maxLength={2} accessibilityLabel="Minutes" style={[...champ, styles.centre]} />
          <Text style={[typo.corps, { color: p.texteDoux }]}>min</Text>
        </View>
      </View>
      <View style={styles.ligne}>
        <View style={{ flex: 1, gap: 6 }}>
          {etiquette(distanceEnMetres(f.type) ? 'Distance (m)' : 'Distance (km)')}
          <TextInput value={f.distance} onChangeText={(t) => change({ ...f, distance: t })} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(f.type) ? 'Distance en mètres' : 'Distance en kilomètres'} style={champ} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {etiquette('Dénivelé (m)')}
          <TextInput value={f.dplus} onChangeText={(t) => change({ ...f, dplus: t })} keyboardType="number-pad" maxLength={5} accessibilityLabel="Dénivelé positif en mètres" style={champ} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          {etiquette('FC moy.')}
          <TextInput value={f.fc} onChangeText={(t) => change({ ...f, fc: t })} keyboardType="number-pad" maxLength={3} accessibilityLabel="Fréquence cardiaque moyenne" style={champ} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {etiquette('Effort ressenti (facultatif)')}
        <View style={styles.effort} accessibilityRole="radiogroup" accessibilityLabel="Effort ressenti de 1 à 10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            const actif = f.rpe === n;
            return (
              <Pressable
                key={n}
                onPress={() => change({ ...f, rpe: actif ? null : n })}
                accessibilityRole="radio"
                accessibilityState={{ selected: actif }}
                accessibilityLabel={`Effort ${n} sur 10`}
                style={[styles.note, { backgroundColor: actif ? p.texte : p.surface2 }]}
              >
                <Text style={[typo.corpsFort, { color: actif ? p.fond : p.texte }]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[typo.petit, { color: p.texteDoux }]}>1 = très facile, 10 = effort maximal. Il sert à estimer la charge de la sortie.</Text>
      </View>
      <View style={{ gap: 6 }}>
        {etiquette('Notes (facultatif)')}
        <TextInput value={f.notes} onChangeText={(t) => change({ ...f, notes: t })} maxLength={2000} multiline placeholder="Un mot sur la sortie…" placeholderTextColor={p.texteMuet} accessibilityLabel="Notes" style={[...champ, { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 }]} />
      </View>
    </EcranAjout>
  );
}

const styles = StyleSheet.create({
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
  centre: { flex: 1, textAlign: 'center' },
  ligne: { flexDirection: 'row', gap: espace.e2 },
  duree: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
  effort: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { width: '18%', minHeight: 44, borderRadius: rayon.base, alignItems: 'center', justifyContent: 'center' },
});
