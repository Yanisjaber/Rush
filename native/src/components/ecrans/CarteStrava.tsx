import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { POWERED_BY_STRAVA_BLANC, POWERED_BY_STRAVA_ORANGE } from '@/components/ecrans/strava-logos';
import { Bouton } from '@/components/ui/Bouton';
import { deconnecterStrava, type ConnexionStrava } from '@/data/acces/api';
import { espace, rayon, sombre } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La carte Strava des Connexions, la même que sur le site (app/src/lib/parametres/Connexions.svelte) : le bandeau orange avec le logo Strava, le nom et une pastille d'état,
// une ligne de détail (compte, activités, dernière synchro), « Re-synchroniser » et « Déconnecter », et la mention « Powered by Strava » de la charte Strava.
// Re-synchroniser ouvre l'écran de synchro (le calcul des flux et des courbes). La connexion à Strava passe encore par le site.
const ADRESSE_SITE = 'https://yanisjaber.github.io/Rush/';
const ORANGE_STRAVA = '#fc4c02';
// Le tracé du logo Strava (Simple Icons), le même que sur le site
const TRACE_STRAVA = 'M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169';

const texteDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

/** La ligne de détail du site : « Sami Jaber · 2 986 activités · synchro 30 oct., 12:55 », ou la phrase d'accroche si Strava n'est pas connecté. */
export function detailStrava(conn: ConnexionStrava | null, nbActivites: number): string {
  if (!conn) return 'Importe automatiquement tes activités, puissances et courbes.';
  const date = texteDate(conn.last_sync_at);
  return [conn.athlete_name, pluriel(nbActivites, 'activité'), date ? `synchro ${date}` : ''].filter((x): x is string => !!x).join(' · ');
}

interface Props {
  strava: ConnexionStrava | null;
  nbActivites: number;
  /** Relit les connexions (après une déconnexion). */
  onChange: () => void;
}

export function CarteStrava({ strava, nbActivites, onChange }: Props) {
  const p = usePalette();
  const router = useRouter();
  const [choix, setChoix] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [info, setInfo] = useState('');
  const [erreur, setErreur] = useState('');

  const enErreur = strava?.last_sync_status === 'error';
  const pastille = !strava ? { mot: 'Non connecté', couleur: p.texteDoux } : enErreur ? { mot: 'Erreur de synchro', couleur: p.danger } : { mot: 'Connecté', couleur: p.ok };
  const logoPowered = p.fond === sombre.fond ? POWERED_BY_STRAVA_BLANC : POWERED_BY_STRAVA_ORANGE;

  const deconnecter = async (effacer: boolean) => {
    setErreur('');
    setEnCours(true);
    const r = await deconnecterStrava(effacer);
    setEnCours(false);
    setChoix(false);
    setConfirmer(false);
    if (r.erreur) return setErreur(r.erreur);
    setInfo(effacer ? 'Strava déconnecté et données supprimées.' : 'Strava déconnecté. Tes données sont conservées.');
    onChange();
  };

  return (
    <View style={[styles.carte, { backgroundColor: p.surface }]}>
      <View accessible accessibilityRole="image" accessibilityLabel="Logo Strava" style={styles.logo}>
        <Svg width={64} height={64} viewBox="0 0 24 24">
          <Path d={TRACE_STRAVA} fill="#ffffff" />
        </Svg>
      </View>

      <View style={styles.corps}>
        <View style={styles.entete}>
          <Text accessibilityRole="header" style={[typo.titre2, { color: p.texte }]}>Strava</Text>
          <View accessible accessibilityLabel={`Strava : ${pastille.mot}`} style={[styles.pastille, { borderColor: strava ? pastille.couleur : p.traitFort }]}>
            <Text style={[typo.petit, { fontFamily: police.texte600, color: pastille.couleur }]}>{pastille.mot}</Text>
          </View>
        </View>
        <Text style={[typo.corps, { color: p.texteDoux }]}>{detailStrava(strava, nbActivites)}</Text>

        {choix ? (
          <View style={[styles.choix, { backgroundColor: p.surface2, borderColor: p.traitFort }]}>
            <Text style={[typo.corpsFort, { color: p.texte }]}>Déconnecter Strava</Text>
            {confirmer ? (
              <>
                <Text style={[typo.petit, { color: p.danger }]}>Action irréversible : toutes tes activités, ta charge et tes records seront supprimés. Tu devras tout re-télécharger.</Text>
                <Bouton variante="discret" disabled={enCours} onPress={() => void deconnecter(true)}>Oui, tout supprimer</Bouton>
                <Bouton variante="discret" disabled={enCours} onPress={() => setConfirmer(false)}>Non, retour</Bouton>
              </>
            ) : (
              <>
                <Pressable accessibilityRole="button" disabled={enCours} onPress={() => void deconnecter(false)} style={[styles.option, { borderColor: p.traitFort, backgroundColor: p.fond }]}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>Déconnecter seulement</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>Coupe la synchro mais garde tes données déjà importées. Tu pourras reconnecter sans tout re-télécharger.</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={enCours} onPress={() => setConfirmer(true)} style={[styles.option, { borderColor: p.danger, backgroundColor: p.fond }]}>
                  <Text style={[typo.corpsFort, { color: p.texte }]}>Déconnecter et supprimer les données</Text>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>Coupe la synchro et efface définitivement tes données Strava.</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setChoix(false)} style={styles.texte}>
                  <Text style={[typo.corpsFort, { color: p.texteDoux }]}>Annuler</Text>
                </Pressable>
              </>
            )}
            {enCours ? <ActivityIndicator color={p.texteDoux} /> : null}
          </View>
        ) : (
          <View style={styles.actions}>
            {strava ? (
              <>
                <Bouton onPress={() => router.push('/parametres/synchro')}>Re-synchroniser</Bouton>
                {enErreur ? <Bouton variante="discret" onPress={() => void Linking.openURL(ADRESSE_SITE)}>Reconnecter depuis le site</Bouton> : null}
                <Pressable accessibilityRole="button" onPress={() => setChoix(true)} style={styles.texte}>
                  <Text style={[typo.corpsFort, { color: p.texteDoux }]}>Déconnecter</Text>
                </Pressable>
              </>
            ) : (
              <Bouton variante="discret" onPress={() => void Linking.openURL(ADRESSE_SITE)}>Connecter depuis le site</Bouton>
            )}
          </View>
        )}

        {erreur ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>{erreur}</Text> : null}
        {info ? <Text accessibilityRole="alert" style={[typo.petit, { color: p.texteDoux }]}>{info}</Text> : null}

        {/* La mention de la charte Strava : logo officiel, petit, jamais modifié */}
        <SvgXml xml={logoPowered} width={146} height={15} accessibilityLabel="Powered by Strava" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: rayon.bloc, overflow: 'hidden' },
  logo: { height: 132, alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE_STRAVA },
  corps: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, gap: espace.e3 },
  entete: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espace.e2 },
  pastille: { borderWidth: 1, borderRadius: rayon.rond, paddingHorizontal: 12, minHeight: 28, justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espace.e2 },
  texte: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  choix: { borderWidth: 1, borderRadius: rayon.l, padding: 14, gap: espace.e3 },
  option: { minHeight: 44, borderWidth: 1, borderRadius: rayon.l, padding: 12, gap: 4 },
});
