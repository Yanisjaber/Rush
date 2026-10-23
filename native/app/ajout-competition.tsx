import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PastillesChoix } from '@/components/ChampsFeuille';
import { EcranAjout } from '@/components/EcranAjout';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { ChampDate } from '@/components/ChampDate';
import { cleDuType, distanceEnMetres, formulaireCompetitionVide, typeDeCle, validerCompetition } from '@/data/ajouts';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ajouter une compétition (une ligne de activity_planned, catégorie « competition ») : sport, nom, priorité (Objectif ou Préparation), type d'épreuve, distance.
export default function EcranAjoutCompetition() {
  const p = usePalette();
  const router = useRouter();
  const { creerPrevue } = useAjouts();
  const [date, setDate] = useState(useDateAjout());
  const [f, setF] = useState(formulaireCompetitionVide());
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const change = (suite: typeof f) => {
    setF(suite);
    setErreur('');
  };

  async function enregistrer() {
    const r = validerCompetition(f, date);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = await creerPrevue(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  const champ = [typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }];
  return (
    <EcranAjout bouton="Ajouter la compétition" enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
      <ChampDate date={date} onChange={(iso) => { setDate(iso); setErreur(''); }} />
      <View style={{ gap: 6 }}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>Sport</Text>
        <MenuDeroulantSport valeur={cleDuType(f.type)} avecTous={false} onChoisir={(cle) => change({ ...f, type: typeDeCle(cle ?? 'autre') })} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>Nom</Text>
        <TextInput value={f.nom} onChangeText={(t) => change({ ...f, nom: t })} maxLength={120} placeholder="Marathon de Toulouse" placeholderTextColor={p.texteMuet} returnKeyType="done" accessibilityLabel="Nom de la compétition" style={champ} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>Priorité</Text>
        <PastillesChoix
          valeurs={[
            { cle: 'A' as const, nom: 'Objectif' },
            { cle: 'B' as const, nom: 'Préparation' },
          ]}
          actuel={f.priorite}
          onChoisir={(v) => change({ ...f, priorite: v })}
          etiquette="Priorité"
        />
        <Text style={[typo.petit, { color: p.texteDoux }]}>{f.priorite === 'A' ? 'Ta course principale : la préparation vise cette date.' : 'Une course pour te tester, sans viser le pic de forme.'}</Text>
      </View>
      <View style={styles.ligne}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[typo.micro, { color: p.texteDoux }]}>Type d'épreuve (facultatif)</Text>
          <TextInput value={f.epreuve} onChangeText={(t) => change({ ...f, epreuve: t })} maxLength={60} placeholder="Route, trail, cyclosportive…" placeholderTextColor={p.texteMuet} accessibilityLabel="Type d'épreuve" style={champ} />
        </View>
        <View style={{ width: 130, gap: 6 }}>
          <Text style={[typo.micro, { color: p.texteDoux }]}>{distanceEnMetres(f.type) ? 'Distance (m)' : 'Distance (km)'}</Text>
          <TextInput value={f.distance} onChangeText={(t) => change({ ...f, distance: t })} keyboardType="decimal-pad" maxLength={8} accessibilityLabel={distanceEnMetres(f.type) ? 'Distance en mètres' : 'Distance en kilomètres'} style={champ} />
        </View>
      </View>
    </EcranAjout>
  );
}

const styles = StyleSheet.create({
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
  ligne: { flexDirection: 'row', gap: 8 },
});
