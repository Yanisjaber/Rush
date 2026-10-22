import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { Bloc } from '@/components/Bloc';
import { SelecteurDate } from '@/components/SelecteurDate';
import { COULEURS_CYCLE, joursDuCycle, NOM_MAX_CYCLE, validerCycle } from '@/data/cycles';
import { dateIsoLocale } from '@/data/format';
import { useCycles } from '@/hooks/useCycles';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Créer ou modifier un cycle d'entraînement : un nom, un début, une fin, une couleur. Au plus deux cycles le même jour : si ce n'est pas possible, on dit lesquels.
// On y arrive depuis l'écran des cycles (pour créer, ou en touchant un cycle) ou depuis le détail d'un jour du calendrier.
const decaler = (iso: string, jours: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return dateIsoLocale(d);
};

export default function EcranCycle() {
  const p = usePalette();
  const router = useRouter();
  const bas = useSafeAreaInsets().bottom;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { cycles, chargement, creer, modifier, supprimer } = useCycles();
  const existant = useMemo(() => (id ? cycles.find((c) => c.id === id) ?? null : null), [id, cycles]);

  const aujourdhui = dateIsoLocale(new Date());
  const [nom, setNom] = useState('');
  const [debut, setDebut] = useState(aujourdhui);
  const [fin, setFin] = useState(decaler(aujourdhui, 27)); // quatre semaines : un cycle d'entraînement typique
  const [couleur, setCouleur] = useState(COULEURS_CYCLE[0].hex);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  // Quand on modifie un cycle, le formulaire se remplit une fois qu'il est chargé
  const [rempli, setRempli] = useState(false);
  useEffect(() => {
    if (existant && !rempli) {
      setNom(existant.name);
      setDebut(String(existant.from_date).slice(0, 10));
      setFin(String(existant.to_date).slice(0, 10));
      setCouleur(existant.color);
      setRempli(true);
    }
  }, [existant, rempli]);

  const jours = fin >= debut ? joursDuCycle({ from_date: debut, to_date: fin }) : 0;
  const changerDebut = (iso: string) => {
    setDebut(iso);
    if (fin < iso) setFin(iso); // la fin ne reste jamais avant le début
    setErreur('');
  };
  const changerFin = (iso: string) => {
    setFin(iso);
    if (iso < debut) setDebut(iso);
    setErreur('');
  };

  async function enregistrer() {
    const r = validerCycle({ name: nom, from_date: debut, to_date: fin, color: couleur }, cycles, existant?.id);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = existant ? await modifier(existant.id, r.valeur) : await creer(r.valeur);
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  function confirmerSuppression() {
    if (!existant) return;
    Alert.alert(`Supprimer « ${existant.name} » ?`, 'Le cycle disparaît du calendrier. Tes séances ne sont pas touchées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setEnCours(true);
          const e = await supprimer(existant.id);
          setEnCours(false);
          if (e) return setErreur(e);
          router.back();
        },
      },
    ]);
  }

  if (id && chargement) {
    return (
      <View accessible accessibilityLabel="Chargement du cycle" style={styles.centre}>
        <ActivityIndicator color={p.texteDoux} />
      </View>
    );
  }
  if (id && !existant) {
    return (
      <View style={styles.centre}>
        <Text accessibilityRole="alert" style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>
          Cycle introuvable.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + espace.e5 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Bloc titre={existant ? 'Modifier le cycle' : 'Nouveau cycle'}>
        <View style={{ gap: espace.e4 }}>
          <View style={{ gap: 6 }}>
            <Text style={[typo.micro, { color: p.texteDoux }]}>Nom</Text>
            <TextInput
              value={nom}
              onChangeText={(t) => {
                setNom(t);
                setErreur('');
              }}
              maxLength={NOM_MAX_CYCLE}
              placeholder="Bloc force, Prépa spécifique, Affûtage…"
              placeholderTextColor={p.texteMuet}
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel="Nom du cycle"
              style={[typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }]}
            />
          </View>
          <SelecteurDate etiquette="Début" date={debut} onChange={changerDebut} />
          <SelecteurDate etiquette="Fin" date={fin} onChange={changerFin} />
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.texteDoux }]}>
            {jours ? `${jours} jour${jours > 1 ? 's' : ''}` : ''}
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={[typo.micro, { color: p.texteDoux }]}>Couleur</Text>
            <View style={styles.couleurs} accessibilityRole="radiogroup">
              {COULEURS_CYCLE.map((c) => (
                <Pressable
                  key={c.hex}
                  onPress={() => {
                    setCouleur(c.hex);
                    setErreur('');
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: couleur === c.hex }}
                  accessibilityLabel={c.nom}
                  style={[styles.pastille, { backgroundColor: c.hex, borderColor: couleur === c.hex ? p.texte : 'transparent' }]}
                />
              ))}
            </View>
          </View>
          {erreur ? (
            <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
              {erreur}
            </Text>
          ) : null}
          <Bouton onPress={() => void enregistrer()}>{enCours ? 'Enregistrement…' : existant ? 'Enregistrer' : 'Créer le cycle'}</Bouton>
          {existant ? (
            <Bouton variante="discret" onPress={confirmerSuppression}>
              Supprimer ce cycle
            </Bouton>
          ) : null}
        </View>
      </Bloc>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  contenu: { padding: espace.e4, gap: espace.e3 },
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
  couleurs: { flexDirection: 'row', flexWrap: 'wrap', gap: espace.e3 },
  pastille: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
});
