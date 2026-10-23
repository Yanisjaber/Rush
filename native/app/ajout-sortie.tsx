import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChampHeure } from '@/components/ChampHeure';
import { ChampTexte } from '@/components/ChampTexte';
import { ChoixEffort } from '@/components/ChoixEffort';
import { EcranAjout } from '@/components/EcranAjout';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { ChampDate } from '@/components/ChampDate';
import { cleDuType, distanceEnMetres, formulaireSortieVide, typeDeCle, validerSortie } from '@/data/ajouts';
import { dateIsoLocale } from '@/data/format';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { useMenu } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { SPORTS, type CleSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Noter à la main une sortie déjà faite qui ne vient pas de Strava (ligne de activities, source « manual ») : sport, nom, heure, durée, distance, dénivelé, FC, effort, notes.
// Une sortie ne peut pas être dans le futur : pour ça, il y a « Séance prévue ».
export default function EcranAjoutSortie() {
  const p = usePalette();
  const router = useRouter();
  const { creerSortie } = useAjouts();
  const { filtre, familles } = useMenu(); // le sport où l'on était (ou le premier de la barre sur « Tous ») est pré-sélectionné
  const aujourdhui = dateIsoLocale(new Date());
  const depart = useDateAjout();
  const [date, setDate] = useState(depart > aujourdhui ? aujourdhui : depart);
  const [f, setF] = useState(() => formulaireSortieVide(filtre, familles));
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

  const etiquette = (t: string) => <Text style={[typo.petit, styles.etiquette, { color: p.texteDoux }]}>{t}</Text>;
  return (
    <EcranAjout bouton="Enregistrer" enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
      <ChampDate date={date} max={aujourdhui} onChange={(iso) => { setDate(iso > aujourdhui ? aujourdhui : iso); setErreur(''); }} />
      <View style={styles.ligne}>
        <View style={{ flex: 1.4, gap: 6 }}>
          {etiquette('Sport')}
          <MenuDeroulantSport valeur={cleDuType(f.type)} avecTous={false} onChoisir={(cle) => change({ ...f, type: typeDeCle(cle ?? 'autre') })} />
        </View>
        <View style={{ flex: 1 }}>
          <ChampHeure valeur={f.heure} onChange={(h) => change({ ...f, heure: h })} />
        </View>
      </View>
      <ChampTexte etiquette="Nom (facultatif)" value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={120} placeholder={nomSport(f.type)} returnKeyType="done" />
      <View style={{ gap: 6 }}>
        {etiquette('Durée')}
        <View style={styles.duree}>
          <View style={{ flex: 1 }}>
            <ChampTexte value={f.heures} onChangeText={(t) => change({ ...f, heures: t })} keyboardType="number-pad" maxLength={2} accessibilityLabel="Heures" style={styles.centre} />
          </View>
          <Text style={[typo.corps, { color: p.texteDoux }]}>h</Text>
          <View style={{ flex: 1 }}>
            <ChampTexte value={f.minutes} onChangeText={(t) => change({ ...f, minutes: t })} keyboardType="number-pad" maxLength={2} accessibilityLabel="Minutes" style={styles.centre} />
          </View>
          <Text style={[typo.corps, { color: p.texteDoux }]}>min</Text>
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
      <ChampTexte etiquette="Notes (facultatif)" value={f.notes} onChangeText={(t) => change({ ...f, notes: t })} maxLength={2000} multiline placeholder="Un mot sur la sortie…" />
    </EcranAjout>
  );
}

const styles = StyleSheet.create({
  etiquette: { paddingLeft: 16, fontFamily: police.texte600 },
  centre: { textAlign: 'center' },
  ligne: { flexDirection: 'row', gap: espace.e2 },
  duree: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
});
