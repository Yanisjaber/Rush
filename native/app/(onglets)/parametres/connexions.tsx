import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { EcranSection } from '@/components/EcranSection';
import { chargerConnexions, type ConnexionStrava } from '@/data/api';
import { useAuth } from '@/stores/auth';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Adresse du site : la connexion à Strava passe encore par le web. Elle arrivera dans l'app avec l'ouverture du lien OAuth.
const ADRESSE_SITE = 'https://yanisjaber.github.io/Rush/';

const texteDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Les connexions du compte, en lecture : le statut de Strava et les nuits Garmin déjà importées.
export default function Connexions() {
  const p = usePalette();
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [etat, setEtat] = useState<{ strava: ConnexionStrava | null; nbActivites: number; nbNuits: number } | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (demo || !userId) return;
    let annule = false;
    chargerConnexions(userId).then((r) => {
      if (annule) return;
      setEtat(r.data);
      setErreur(r.erreur);
    });
    return () => {
      annule = true;
    };
  }, [demo, userId]);

  const strava = etat?.strava ?? null;
  const statut = !strava ? 'Non connecté' : strava.last_sync_status === 'error' ? 'Erreur de synchro' : 'Connecté';
  const couleur = !strava ? p.texteDoux : strava.last_sync_status === 'error' ? p.danger : p.ok;
  const detail = strava
    ? [strava.athlete_name, pluriel(etat?.nbActivites ?? 0, 'activité'), texteDate(strava.last_sync_at) ? `synchro ${texteDate(strava.last_sync_at)}` : ''].filter(Boolean).join(' · ')
    : 'Importe automatiquement tes activités, puissances et courbes.';

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        {demo ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : aucune connexion.</Text> : null}
        {erreur ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>{erreur}</Text> : null}
        <Bloc titre="Strava">
          {!demo && !etat && !erreur ? <ActivityIndicator color={p.texteDoux} /> : (
            <>
              <Text style={[typo.corpsFort, { color: couleur }]}>{demo ? 'Non connecté' : statut}</Text>
              <Text style={[typo.petit, { color: p.texteDoux, marginTop: 4 }]}>{demo ? 'Importe automatiquement tes activités, puissances et courbes.' : detail}</Text>
              {!strava ? (
                <View style={{ marginTop: espace.e3 }}>
                  <Bouton variante="discret" onPress={() => void Linking.openURL(ADRESSE_SITE)}>Connecter depuis le site</Bouton>
                </View>
              ) : null}
            </>
          )}
        </Bloc>
        <Bloc titre="Garmin">
          <Text style={[typo.corpsFort, { color: p.texteDoux }]}>Bientôt disponible</Text>
          <Text style={[typo.petit, { color: p.texteDoux, marginTop: 4 }]}>
            La connexion officielle Garmin arrive plus tard.
            {etat && etat.nbNuits > 0 ? ` ${pluriel(etat.nbNuits, 'nuit')} déjà importée${etat.nbNuits > 1 ? 's' : ''}, à retrouver dans Santé.` : ''}
          </Text>
        </Bloc>
      </View>
    </EcranSection>
  );
}
