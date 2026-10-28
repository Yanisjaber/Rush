import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { CalendrierPeriode } from '@/components/CalendrierPeriode';
import { ChoixCouleur } from '@/components/ChampsFeuille';
import { ChampTexte } from '@/components/ChampTexte';
import { MenuDeroulantSport } from '@/components/MenuDeroulantSport';
import { COULEURS_CYCLE, NOM_MAX_CYCLE, validerCycle } from '@/data/calendrier/cycles';
import { dateIsoLocale } from '@/data/outils/format';
import { useCycles } from '@/hooks/useCycles';
import { useGardeSortie } from '@/hooks/useGardeSortie';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
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
  const { id, debut: debutParam } = useLocalSearchParams<{ id?: string; debut?: string }>();
  const { cycles, chargement, erreur: erreurChargement, creer, modifier, supprimer } = useCycles();
  const existant = useMemo(() => (id ? cycles.find((c) => c.id === id) ?? null : null), [id, cycles]);

  // Un nouveau cycle commence le jour d'où l'on vient (paramètre « debut »), sinon aujourd'hui
  const aujourdhui = /^\d{4}-\d{2}-\d{2}$/.test(String(debutParam ?? '')) ? String(debutParam) : dateIsoLocale(new Date());
  const [nom, setNom] = useState('');
  const [debut, setDebut] = useState(aujourdhui);
  const [fin, setFin] = useState(decaler(aujourdhui, 27)); // quatre semaines : un cycle d'entraînement typique
  const [couleur, setCouleur] = useState(COULEURS_CYCLE[0].hex);
  const [sport, setSport] = useState<string | null>(null); // null : tous les sports
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
      setSport(existant.sport ?? null);
      setRempli(true);
    }
  }, [existant, rempli]);
  // La garde de sortie attend que la fiche soit remplie (sinon le remplissage compterait comme une modification)
  const autoriser = useGardeSortie(id && !rempli ? null : { nom, debut, fin, couleur, sport });

  async function enregistrer() {
    const r = validerCycle({ name: nom, from_date: debut, to_date: fin, color: couleur, sport }, cycles, existant?.id);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = existant ? await modifier(existant.id, r.valeur) : await creer(r.valeur);
    setEnCours(false);
    if (e) return setErreur(e);
    autoriser();
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
          autoriser();
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
          {erreurChargement || 'Cycle introuvable.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + espace.e5 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
        {existant ? 'Modifier le cycle' : 'Nouveau cycle'}
      </Text>
      <ChampTexte
        etiquette="Nom"
        value={nom}
        onChangeText={(t) => {
          setNom(t);
          setErreur('');
        }}
        maxLength={NOM_MAX_CYCLE}
        placeholder="Bloc force, Prépa spécifique, Affûtage…"
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel="Nom du cycle"
      />
      <View style={{ gap: 6 }}>
        <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16, fontFamily: police.texte600 }]}>Période</Text>
        <CalendrierPeriode
          debut={debut}
          fin={fin}
          couleur={couleur}
          onChange={(d, f) => {
            setDebut(d);
            setFin(f);
            setErreur('');
          }}
        />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16, fontFamily: police.texte600 }]}>Sport</Text>
        <MenuDeroulantSport
          valeur={sport}
          onChoisir={(v) => {
            setSport(v);
            if (v) setCouleur(couleurSport(p, v)); // un cycle de sport prend la couleur de son sport (on peut encore la changer)
            setErreur('');
          }}
          etiquette="Sport du cycle"
        />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16, fontFamily: police.texte600 }]}>Couleur</Text>
        <ChoixCouleur
          couleurs={COULEURS_CYCLE}
          actuelle={couleur}
          onChoisir={(hex) => {
            setCouleur(hex);
            setErreur('');
          }}
        />
      </View>
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
          {erreur}
        </Text>
      ) : null}
      <Bouton disabled={enCours} onPress={() => void enregistrer()}>{enCours ? 'Enregistrement…' : existant ? 'Enregistrer' : 'Créer le cycle'}</Bouton>
      {existant ? (
        <Bouton variante="discret" onPress={confirmerSuppression}>
          Supprimer ce cycle
        </Bouton>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  contenu: { padding: espace.e4, gap: espace.e4 },
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14 },
});
