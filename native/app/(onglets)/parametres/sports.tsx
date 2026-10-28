import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/Bouton';
import { EcranSection } from '@/components/EcranSection';
import { SelecteurSports } from '@/components/SelecteurSports';
import { basculerSport } from '@/data/sports/sports-choisis';
import { useSportsChoisis } from '@/hooks/useSportsChoisis';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les sports du compte : ils décident des onglets de la barre du haut et des widgets de l'Accueil.
// Les sports que tes séances révèlent (muscu, Hyrox…) apparaissent déjà cochés. L'ordre des pastilles = l'ordre où tu coches.
export default function MesSports() {
  const p = usePalette();
  const { choisis, setChoisis, erreur, envoi, appliquer, demo, lectureEchouee } = useSportsChoisis();
  const [initial, setInitial] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  // Liste enregistrée illisible : on montre seulement l'erreur, car enregistrer maintenant écraserait ta vraie liste
  if (lectureEchouee) {
    return (
      <EcranSection>
        <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
          <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
        </View>
      </EcranSection>
    );
  }
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
        <View accessible accessibilityLabel={`${choisis.length} sport${choisis.length > 1 ? 's' : ''} coché${choisis.length > 1 ? 's' : ''}. Ils composent ton Accueil et la barre du haut.`} style={styles.compteur}>
          <Text style={[styles.nombre, { color: p.texte }]}>{choisis.length}</Text>
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>{choisis.length > 1 ? 'sports' : 'sport'}</Text>
        </View>
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
  compteur: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  nombre: { fontFamily: police.titre800, fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
});
