import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { CarteStrava } from '@/components/ecrans/CarteStrava';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { chargerConnexions, type ConnexionStrava } from '@/data/acces/api';
import { useAuth } from '@/stores/auth';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Les connexions du compte : la carte Strava (la même que sur le site, voir CarteStrava) et Garmin (bientôt, avec les nuits déjà importées).
export default function Connexions() {
  const p = usePalette();
  const { session, demo } = useAuth();
  const userId = session?.user.id ?? null;
  const [etat, setEtat] = useState<{ strava: ConnexionStrava | null; nbActivites: number; nbNuits: number } | null>(null);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    if (demo || !userId) return;
    const r = await chargerConnexions(userId);
    setEtat(r.data);
    setErreur(r.erreur);
  }, [demo, userId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const strava = demo ? null : (etat?.strava ?? null);
  const nuits = etat?.nbNuits ?? 0;

  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        {demo ? <Text style={[typo.petit, { color: p.texteMuet }]}>Mode démo : aucune connexion.</Text> : null}
        {erreur ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>{erreur}</Text> : null}
        {!demo && !etat && !erreur ? <ActivityIndicator color={p.texteDoux} /> : null}
        {demo || etat ? <CarteStrava strava={strava} nbActivites={etat?.nbActivites ?? 0} demo={demo} onChange={() => void charger()} /> : null}
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
