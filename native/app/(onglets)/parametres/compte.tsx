import { useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { EcranSection } from '@/components/EcranSection';
import { supprimerMonCompte } from '@/data/acces/api';
import { confirmationValide, MOT_CONFIRMATION } from '@/data/acces/suppression-compte';
import { deconnexion } from '@/stores/auth';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const ADRESSE_SITE = 'https://yanisjaber.github.io/Rush/';

// Mon compte : changer le mot de passe et exporter les données se font sur le site (même compte) ; la suppression se fait ici, comme sur le site.
export default function MonCompte() {
  const p = usePalette();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [pct, setPct] = useState(0);
  const [etape, setEtape] = useState('');
  const [erreur, setErreur] = useState('');

  async function supprimer() {
    if (enCours || !confirmationValide(texte)) return;
    setEnCours(true);
    setErreur('');
    const r = await supprimerMonCompte(texte.trim(), ({ pct: x, texte: t }) => {
      setPct(x);
      setEtape(t);
    });
    setEnCours(false);
    if (!r.ok) return setErreur(r.message);
    await deconnexion(true); // le compte n'existe plus : on ferme seulement la session de ce téléphone
  }

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        <Bloc titre="Mot de passe et données">
          <Text style={[typo.petit, { color: p.texteDoux, marginBottom: espace.e3 }]}>Changer ton mot de passe et exporter tes données (fichier JSON) se fait sur le site, avec le même compte.</Text>
          <View style={{ gap: espace.e2 }}>
            <Bouton variante="discret" onPress={() => void Linking.openURL(`${ADRESSE_SITE}#/mot-de-passe`).catch(() => {})}>Changer mon mot de passe</Bouton>
            <Bouton variante="discret" onPress={() => void Linking.openURL(`${ADRESSE_SITE}#/parametres/general`).catch(() => {})}>Exporter mes données</Bouton>
          </View>
        </Bloc>

        <Bloc titre="Supprimer mon compte">
          {enCours ? (
            <View accessibilityLiveRegion="polite" style={{ gap: espace.e2 }}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>{etape}</Text>
              <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} style={[styles.piste, { backgroundColor: p.trait }]}>
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: p.texte, borderRadius: 7 }} />
              </View>
              <Text style={[typo.petit, { color: p.texteDoux }]}>{pct} % · Ne ferme pas l'app.</Text>
            </View>
          ) : !ouvert ? (
            <>
              <Text style={[typo.petit, { color: p.texteDoux, marginBottom: espace.e3 }]}>Efface ton compte, tes séances et tous tes réglages. Définitif.</Text>
              <Bouton variante="discret" onPress={() => setOuvert(true)}>Supprimer mon compte et mes données</Bouton>
            </>
          ) : (
            <View style={{ gap: espace.e3 }}>
              <Text style={[typo.petit, { color: p.texte }]}>Action définitive : ton compte, tes séances, ton sommeil, tes programmes, tes tests et tes réglages seront effacés, et l'accès de Rush à ton Strava sera retiré. Exporte tes données avant si tu veux les garder.</Text>
              <Text style={[typo.micro, { color: p.texteDoux }]}>Pour confirmer, tape {MOT_CONFIRMATION}</Text>
              <TextInput
                value={texte}
                onChangeText={setTexte}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel={`Tape ${MOT_CONFIRMATION} pour confirmer`}
                style={[styles.champ, typo.corps, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }]}
              />
              {erreur ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>{erreur}</Text> : null}
              <Bouton disabled={!confirmationValide(texte)} onPress={() => void supprimer()}>Supprimer définitivement</Bouton>
              <Bouton variante="discret" onPress={() => { setOuvert(false); setTexte(''); setErreur(''); }}>Annuler</Bouton>
            </View>
          )}
        </Bloc>
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: espace.e3 },
  piste: { height: 14, borderRadius: 7, overflow: 'hidden' },
});
