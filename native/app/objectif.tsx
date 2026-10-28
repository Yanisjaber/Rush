import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { ChampTexte } from '@/components/ChampTexte';
import { MenuMesure } from '@/components/MenuMesure';
import { CATALOGUE, estManuel, modele, NOM_SPORT_BILAN, SPORTS_OBJECTIFS, validerObjectif } from '@/data/bilan/bilan';
import { useEcrituresObjectifs } from '@/hooks/useObjectifs';
import { useGardeSortie } from '@/hooks/useGardeSortie';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Créer ou modifier un objectif annuel : un sport, ce qu'on mesure, une cible, et pour un objectif de performance (FTP, chrono, 1RM…) la valeur actuelle.
// On y arrive depuis le Bilan. Pour une modification, le Bilan passe l'objectif en paramètres (id, sport, template, cible, actuel) : pas de nouveau chargement.
// Le sport et l'objectif ne se changent pas après coup (on supprime et on recrée), comme sur le site.
const unNombre = (v: string | undefined) => (v && /^\d+(\.\d+)?$/.test(v) ? v.replace('.', ',') : '');

export default function EcranObjectif() {
  const p = usePalette();
  const router = useRouter();
  const bas = useSafeAreaInsets().bottom;
  const params = useLocalSearchParams<{ id?: string; annee?: string; sport?: string; template?: string; cible?: string; actuel?: string }>();
  const annee = /^\d{4}$/.test(String(params.annee ?? '')) ? Number(params.annee) : new Date().getFullYear();
  const id = params.id ? String(params.id) : null;
  const { creer, modifier, supprimer } = useEcrituresObjectifs();

  // Modification : le modèle doit exister dans le catalogue ; création : le sport proposé (celui du filtre du Bilan) ou « tous »
  const sportDepart = params.sport && Object.hasOwn(CATALOGUE, params.sport) ? params.sport : 'tous';
  const modeleExistant = id ? modele(sportDepart, String(params.template ?? '')) : null;
  const [sport, setSport] = useState(sportDepart);
  const [template, setTemplate] = useState(modeleExistant?.id ?? CATALOGUE[sportDepart][0].id);
  const [cible, setCible] = useState(id ? unNombre(params.cible) : '');
  const [actuel, setActuel] = useState(id ? unNombre(params.actuel) : '');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const envoi = useRef(false); // un double appui part deux fois avant que `enCours` ne soit à jour : ce verrou ne bouge pas avec le rendu
  const autoriser = useGardeSortie({ sport, template, cible, actuel });

  const m = modele(sport, template);
  const modeles = CATALOGUE[sport] ?? [];

  async function enregistrer() {
    const r = validerObjectif({ sport, template, cible, actuel });
    setErreurs(r.erreurs);
    setErreur('');
    if (!r.valeurs || envoi.current) return;
    envoi.current = true;
    setEnCours(true);
    const e = id ? await modifier(id, r.valeurs) : await creer(annee, r.valeurs);
    envoi.current = false;
    setEnCours(false);
    if (e) return setErreur(e);
    autoriser();
    router.back();
  }

  function confirmerSuppression() {
    if (!id) return;
    Alert.alert('Supprimer cet objectif ?', "L'objectif disparaît du Bilan. Tes séances ne sont pas touchées.", [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (envoi.current) return;
          envoi.current = true;
          setEnCours(true);
          const e = await supprimer(id);
          envoi.current = false;
          setEnCours(false);
          if (e) return setErreur(e);
          autoriser();
          router.back();
        },
      },
    ]);
  }

  if (id && !modeleExistant) {
    return (
      <View style={styles.centre}>
        <Text accessibilityRole="alert" style={[typo.corps, { color: p.texteDoux, textAlign: 'center' }]}>
          Objectif introuvable.
        </Text>
      </View>
    );
  }

  const etiquetteChamp = [typo.petit, { color: p.texteDoux, paddingLeft: 16, fontFamily: police.texte600 }];
  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + espace.e5 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text accessibilityRole="header" style={[typo.titre3, { color: p.texte }]}>
        {id ? `Modifier l'objectif ${annee}` : `Nouvel objectif ${annee}`}
      </Text>

      <View style={{ gap: 6 }}>
        <Text style={etiquetteChamp}>Sport</Text>
        {id ? (
          <Text style={[typo.corps, { color: p.texte, paddingLeft: 16 }]}>{NOM_SPORT_BILAN[sport]}</Text>
        ) : (
          <View style={styles.pastille}>
            <MenuMesure
              etiquette="Sport de l'objectif"
              valeur={sport}
              options={SPORTS_OBJECTIFS.map(([cle, nom]) => ({ cle, nom }))}
              onChoisir={(c) => {
                setSport(c);
                if (!modele(c, template)) setTemplate(CATALOGUE[c][0].id); // le premier objectif du sport, sauf si celui-ci convient déjà
                setErreurs({});
              }}
            />
          </View>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={etiquetteChamp}>Objectif</Text>
        {id ? (
          <Text style={[typo.corps, { color: p.texte, paddingLeft: 16 }]}>{m?.label}</Text>
        ) : (
          <View style={styles.pastille}>
            <MenuMesure
              etiquette="Ce que mesure l'objectif"
              valeur={template}
              options={modeles.map((x) => ({ cle: x.id, nom: x.unit ? `${x.label} (${x.unit})` : x.label }))}
              onChoisir={(c) => {
                setTemplate(c);
                setErreurs({});
              }}
            />
          </View>
        )}
        {erreurs.template ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, paddingLeft: 16 }]}>{erreurs.template}</Text> : null}
        {m ? (
          <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16 }]}>
            {estManuel(m) ? (m.calc === 'manual_lower' ? 'Tu saisis ta performance actuelle : plus elle est basse, mieux c\u2019est.' : m.calc === 'manual_proche' ? 'Tu saisis ta valeur actuelle : on mesure l\u2019écart avec la cible, que tu montes ou que tu descendes.' : 'Tu saisis ta performance actuelle.') : "Calculé automatiquement à partir de tes sorties de l'année."}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <ChampTexte
          etiquette={`Cible${m?.unit ? ` (${m.unit})` : ''}`}
          value={cible}
          onChangeText={(t) => {
            setCible(t);
            setErreurs({});
          }}
          keyboardType="decimal-pad"
          placeholder="ex. 1500"
          maxLength={12}
        />
        {erreurs.cible ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, paddingLeft: 16 }]}>{erreurs.cible}</Text> : null}
      </View>
      {m && estManuel(m) ? (
        <View style={{ gap: 6 }}>
          <ChampTexte
            etiquette={`Performance actuelle${m.unit ? ` (${m.unit})` : ''}`}
            value={actuel}
            onChangeText={(t) => {
              setActuel(t);
              setErreurs({});
            }}
            keyboardType="decimal-pad"
            maxLength={12}
          />
          {erreurs.actuel ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, paddingLeft: 16 }]}>{erreurs.actuel}</Text> : null}
        </View>
      ) : null}

      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
          {erreur}
        </Text>
      ) : null}
      <Bouton disabled={enCours} onPress={() => void enregistrer()}>
        {enCours ? 'Enregistrement…' : id ? 'Enregistrer' : "Créer l'objectif"}
      </Bouton>
      {id ? (
        <Bouton variante="discret" disabled={enCours} onPress={confirmerSuppression}>
          Supprimer cet objectif
        </Bouton>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espace.e5 },
  contenu: { padding: espace.e4, gap: espace.e4 },
  pastille: { alignSelf: 'flex-start' },
});
