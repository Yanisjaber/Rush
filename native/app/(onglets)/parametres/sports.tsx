import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { EcranSection } from '@/components/EcranSection';
import { chargerSportsChoisis, enregistrerSportsChoisis } from '@/data/api';
import { GROUPES_SPORTS, nettoyerSports, sportsCoches } from '@/data/sports-choisis';
import { useAuth } from '@/stores/auth';
import { useMenu } from '@/stores/menu';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les sports du compte : ils décident des onglets de la barre du haut et des widgets de l'Accueil.
// Les sports que tes séances révèlent (muscu, Hyrox…) apparaissent déjà cochés. L'ordre des pastilles = l'ordre où tu coches.
export default function MesSports() {
  const p = usePalette();
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const { familles } = useMenu();
  const [choisis, setChoisis] = useState<string[] | null>(null);
  const [initial, setInitial] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      const liste = demo || !userId ? null : nettoyerSports((await chargerSportsChoisis(userId)).data);
      if (annule) return;
      const coches = sportsCoches(liste, familles);
      setChoisis(coches);
      setInitial(JSON.stringify(coches));
    })();
    return () => {
      annule = true;
    };
    // familles : lues une seule fois au chargement (sinon la saisie en cours serait écrasée)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, userId]);

  const basculer = (cle: string) => {
    setMessage('');
    setChoisis((l) => (l ? (l.includes(cle) ? l.filter((s) => s !== cle) : [...l, cle]) : l));
  };

  async function enregistrer() {
    if (!choisis || envoi) return;
    setErreur('');
    setMessage('');
    const propre = nettoyerSports(choisis) ?? [];
    if (demo) {
      setInitial(JSON.stringify(choisis));
      setMessage('Mode démo : rien n’est enregistré.');
      return;
    }
    if (!userId) return;
    setEnvoi(true);
    const r = await enregistrerSportsChoisis(userId, propre);
    setEnvoi(false);
    if (r.erreur) setErreur(r.erreur);
    else {
      setInitial(JSON.stringify(choisis));
      setMessage('Enregistré. Tire l’Accueil vers le bas pour le mettre à jour.');
    }
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
  const sale = JSON.stringify(choisis) !== initial;
  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        <Text style={[typo.corps, { color: p.texteDoux }]}>Coche les sports que tu pratiques : ils composent ton Accueil et la barre du haut.</Text>
        {erreur ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
          </View>
        ) : null}
        {GROUPES_SPORTS.map((g) => (
          <Bloc key={g.titre} titre={g.titre}>
            <View style={styles.puces}>
              {g.sports.map((cle) => {
                const actif = choisis.includes(cle);
                const s = SPORTS[cle as CleSport];
                const couleur = couleurSport(p, cle);
                return (
                  <Pressable
                    key={cle}
                    onPress={() => basculer(cle)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: actif }}
                    accessibilityLabel={s?.nom ?? cle}
                    style={[styles.puce, actif ? { backgroundColor: couleur, borderColor: couleur } : { borderColor: p.contourChamp }]}
                  >
                    <Text style={[typo.corpsFort, { color: actif ? p.encreSurCouleur : p.texte }]}>{s?.nom ?? cle}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Bloc>
        ))}
        <Bouton onPress={() => void enregistrer()}>{envoi ? 'Enregistrement…' : sale ? 'Enregistrer' : 'Enregistré'}</Bouton>
        {message ? (
          <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: p.ok }]}>
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
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { minHeight: 44, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14, justifyContent: 'center' },
});
