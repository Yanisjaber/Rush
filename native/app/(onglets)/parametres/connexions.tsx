import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { Pastille } from '@/components/ui/Pastille';
import { chargerConnexions, type ConnexionStrava } from '@/data/acces/api';
import { useAuth } from '@/stores/auth';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Adresse du site : la connexion à Strava passe encore par le web. Elle arrivera dans l'app avec l'ouverture du lien OAuth.
const ADRESSE_SITE = 'https://yanisjaber.github.io/Rush/';

const texteDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Les connexions du compte, en lecture : une pastille d'état (verte, rouge ou grise), un mot, et des puces avec les chiffres. Peu de phrases.
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

  const strava = demo ? null : (etat?.strava ?? null);
  const enErreur = strava?.last_sync_status === 'error';
  const mot = !strava ? 'Non connecté' : enErreur ? 'Erreur de synchro' : 'Connecté';
  const couleur = !strava ? p.traitFort : enErreur ? p.danger : p.ok;
  const puces = strava ? [strava.athlete_name, pluriel(etat?.nbActivites ?? 0, 'activité'), texteDate(strava.last_sync_at) ? `synchro ${texteDate(strava.last_sync_at)}` : ''].filter((x): x is string => !!x) : [];
  const nuits = etat?.nbNuits ?? 0;

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        {demo ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : aucune connexion.</Text> : null}
        {erreur ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>{erreur}</Text> : null}
        {erreur && !etat ? null : (
        <Bloc titre="Strava">
          {!demo && !etat ? (
            <ActivityIndicator color={p.texteDoux} />
          ) : (
            <>
              <View accessible accessibilityLabel={`Strava : ${mot}`} style={styles.statut}>
                <View style={[styles.pastille, { backgroundColor: couleur }]} />
                <Text style={[styles.mot, { color: strava ? p.texte : p.texteDoux }]}>{mot}</Text>
              </View>
              {puces.length ? (
                <View style={styles.puces}>
                  {puces.map((x) => (
                    <View key={x} style={[styles.puce, { borderColor: p.traitFort }]}>
                      <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>{x}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {!strava ? (
                <View style={{ marginTop: espace.e3, alignItems: 'flex-start' }}>
                  <Pastille nom="Connecter depuis le site" actif={false} onPress={() => void Linking.openURL(ADRESSE_SITE)} aide="Ouvre le site dans le navigateur" />
                </View>
              ) : null}
            </>
          )}
        </Bloc>
        )}
        <Bloc titre="Garmin">
          <View accessible accessibilityLabel="Garmin : bientôt disponible" style={styles.statut}>
            <View style={[styles.pastille, { backgroundColor: p.traitFort }]} />
            <Text style={[styles.mot, { color: p.texteDoux }]}>Bientôt</Text>
          </View>
          {nuits > 0 ? (
            <View style={styles.puces}>
              <View style={[styles.puce, { borderColor: p.traitFort }]}>
                <Text style={[typo.petit, { color: p.texteDoux }]}>{pluriel(nuits, 'nuit')} importée{nuits > 1 ? 's' : ''}</Text>
              </View>
            </View>
          ) : null}
        </Bloc>
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  statut: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pastille: { width: 22, height: 22, borderRadius: 11 },
  mot: { fontSize: 26, lineHeight: 30, fontFamily: police.titre700 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  puce: { borderWidth: 1, borderRadius: rayon.rond, paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', maxWidth: '100%' },
});
