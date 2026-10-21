import { useRouter, type Href } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/Bouton';
import { CadreWidget } from '@/components/CadreWidget';
import { Boite, Emplacement, GrilleWidgets } from '@/components/GrilleWidgets';
import { Tuile } from '@/components/Tuile';
import type { Connexion, Tuile as ResumeTuile } from '@/data/parametres';
import { useResumeParametres } from '@/hooks/useResumeParametres';
import { deconnexion, quitterDemo, useAuth } from '@/stores/auth';
import { espace } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const ADRESSE_CONFIDENTIALITE = 'https://yanisjaber.github.io/Rush/#/confidentialite';

// Paramètres : une carte « compte » en dossard, puis une tuile par section avec sa valeur clé et ses points de complétion.
// Même langage que Santé : le chiffre et la forme parlent, peu de phrases. Un appui sur une tuile ouvre la section.
export default function Parametres() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, demo } = useAuth();
  const { resume } = useResumeParametres();
  const aller = (vers: Href) => router.push(vers);

  const tuile = (vers: Href, titre: string, t: ResumeTuile) => (
    <Emplacement taille="s">
      <Pressable
        onPress={() => aller(vers)}
        accessibilityRole="button"
        accessibilityLabel={`${titre} : ${t.valeur} ${t.unite ?? ''} ${t.note}. ${t.remplis} sur ${t.total} renseigné${t.remplis > 1 ? 's' : ''}`.replace(/\s+/g, ' ').trim()}
        accessibilityHint="Ouvre la section"
      >
        <Boite taille="s">
          <Tuile gros titre={titre} valeur={t.valeur} unite={t.unite} note={t.note || undefined}>
            <PointsRemplis remplis={t.remplis} total={t.total} />
          </Tuile>
        </Boite>
      </Pressable>
    </Emplacement>
  );

  return (
    <ScrollView style={{ backgroundColor: p.fond }} contentContainerStyle={[styles.contenu, { paddingTop: insets.top + espace.e4, paddingBottom: insets.bottom + 72 }]}>
      <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
        Paramètres
      </Text>

      <Boite taille="m" heros={{ couleur: couleurSport(p) }}>
        <CadreWidget titre="Compte" serre>
          <CarteCompte prenom={resume.prenom} email={demo ? null : session?.user.email ?? null} demo={demo} />
        </CadreWidget>
      </Boite>

      <GrilleWidgets>
        {tuile('/parametres/profil', 'Profil', resume.profil)}
        {tuile('/parametres/physiologie', 'Physiologie', resume.physiologie)}
        {tuile('/parametres/zones', 'Zones', resume.zones)}
        {tuile('/parametres/sports', 'Mes sports', resume.sports)}
        <Emplacement taille="m">
          <Pressable onPress={() => aller('/parametres/connexions')} accessibilityRole="button" accessibilityLabel={`Connexions : ${resume.connexions.note}`} accessibilityHint="Ouvre la section">
            <Boite taille="m">
              <Tuile gros titre="Connexions" valeur="Strava" note={resume.connexions.note.replace(/^Strava( · |$)/, '') || undefined}>
                <PastilleEtat etat={resume.connexions.etat} />
              </Tuile>
            </Boite>
          </Pressable>
        </Emplacement>
      </GrilleWidgets>

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Bouton variante="discret" onPress={() => void Linking.openURL(ADRESSE_CONFIDENTIALITE)}>
            Confidentialité
          </Bouton>
        </View>
        <View style={{ flex: 1 }}>
          <Bouton variante="discret" onPress={demo ? quitterDemo : () => void deconnexion()}>
            {demo ? 'Quitter la démo' : 'Se déconnecter'}
          </Bouton>
        </View>
      </View>
    </ScrollView>
  );
}

// Le contenu de la carte compte : le prénom en grand, l'e-mail dessous. Dans un composant à part : il lit la palette du cadre (inversée en dossard).
function CarteCompte({ prenom, email, demo }: { prenom: string; email: string | null; demo: boolean }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={demo ? "Compte : mode démo, des données d'exemple" : `Compte : ${prenom || 'sans prénom'}, ${email ?? ''}`} style={styles.compte}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.prenom, { color: p.texte }]}>
        {demo ? 'Mode démo' : prenom || 'Toi'}
      </Text>
      <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
        {demo ? "Données d'exemple" : email ?? ''}
      </Text>
    </View>
  );
}

// Les points de complétion d'une tuile : rempli = renseigné. Donne envie de compléter, sans phrase.
function PointsRemplis({ remplis, total }: { remplis: number; total: number }) {
  const p = usePalette();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.points}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.point, { backgroundColor: i < remplis ? p.texte : p.traitFort }]} />
      ))}
    </View>
  );
}

// La pastille d'état d'une connexion : verte connectée, rouge en erreur, grise absente
function PastilleEtat({ etat }: { etat: Connexion['etat'] }) {
  const p = usePalette();
  const c = etat === 'connecte' ? p.ok : etat === 'erreur' ? p.danger : p.traitFort;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.pastille, { backgroundColor: c }]} />;
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
  compte: { flex: 1, justifyContent: 'center', gap: 4 },
  prenom: { fontFamily: police.titre800, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  points: { flexDirection: 'row', gap: 5 },
  point: { width: 9, height: 9, borderRadius: 5 },
  pastille: { width: 28, height: 28, borderRadius: 14, alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', gap: espace.e3 },
});
