import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/Bouton';
import { EcranSection } from '@/components/EcranSection';
import { SelecteurSports } from '@/components/SelecteurSports';
import { basculerSport } from '@/data/sports-choisis';
import { useSportsChoisis } from '@/hooks/useSportsChoisis';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les sports du compte : ils décident des onglets de la barre du haut et des widgets de l'Accueil.
// Les sports que tes séances révèlent (muscu, Hyrox…) apparaissent déjà cochés. L'ordre des pastilles = l'ordre où tu coches.
export default function MesSports() {
  const p = usePalette();
  const { choisis, setChoisis, erreur, envoi, appliquer, demo } = useSportsChoisis();
  const [initial, setInitial] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  if (!choisis) {
    return (
      <EcranSection>
        <View accessible accessibilityLabel="Chargement de tes sports" style={styles.attente}>
          <ActivityIndicator color={p.texteDoux} />
        </View>
      </EcranSection>
    );
  }
  // La référence « enregistré » est la liste telle qu'elle était au premier affichage de l'écran
  const etatActuel = JSON.stringify(choisis);
  const reference = initial ?? etatActuel;
  if (initial === null) setInitial(reference);
  const sale = etatActuel !== reference;

  const basculer = (cle: string) => {
    const suite = basculerSport(choisis ?? [], cle);
    setMessage(suite ? '' : 'Garde au moins un sport.');
    if (suite) setChoisis(suite);
  };

  async function enregistrer() {
    if (await appliquer(choisis ?? [])) {
      setInitial(etatActuel);
      setMessage(demo ? 'Mode démo : gardé en mémoire seulement.' : 'Enregistré. Ton Accueil se met à jour.');
    }
  }

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        <Text style={[typo.corps, { color: p.texteDoux }]}>Coche les sports que tu pratiques : ils composent ton Accueil et la barre du haut.</Text>
        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}
        <SelecteurSports choisis={choisis} onBasculer={basculer} />
        <Bouton onPress={() => void enregistrer()}>{envoi ? 'Enregistrement…' : sale ? 'Enregistrer' : 'Enregistré'}</Bouton>
        {message ? (
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: message.startsWith('Garde') ? p.alerte : p.ok }]}>
            {message}
          </Text>
        ) : null}
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
});
