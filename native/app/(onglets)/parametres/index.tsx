import { FondDegrade } from '@/components/ui/FondDegrade';
import { useRouter, type Href } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bouton } from '@/components/ui/Bouton';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { Boite, Emplacement, GrilleWidgets } from '@/components/widgets/GrilleWidgets';
import { Pastille } from '@/components/ui/Pastille';
import { Tuile } from '@/components/ui/Tuile';
import type { Connexion, Tuile as ResumeTuile } from '@/data/reglages/parametres';
import { useResumeParametres } from '@/hooks/useResumeParametres';
import { deconnexion, quitterDemo, useAuth } from '@/stores/auth';
import { definirTheme } from '@/stores/theme';
import { definirPrevuesAujourdhui, PREVUES_AUJOURDHUI, useReglagesDemo } from '@/stores/reglages-demo';
import { espace, rayon } from '@/theme/couleurs';
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
  const { resume: resumeBrut, chargement, erreurProfil, erreurConnexions } = useResumeParametres();
  // Une lecture en erreur n'affiche ni « — » ni « non connecté » : on le dit, sans toucher aux autres tuiles
  const resume = {
    ...resumeBrut,
    connexions: erreurConnexions
      ? { etat: 'absente' as const, note: 'Illisible pour le moment' }
      : chargement && !demo
        ? { etat: 'absente' as const, note: 'Chargement…' }
        : resumeBrut.connexions,
  };
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
    <View style={{ flex: 1 }}>
      <FondDegrade />
      <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={[styles.contenu, { paddingTop: insets.top + espace.e4, paddingBottom: insets.bottom + 72 }]}>
      <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
        Paramètres
      </Text>

      <Boite taille="m" heros={{ couleur: couleurSport(p) }}>
        <CadreWidget titre="Compte" serre>
          <CarteCompte prenom={resume.prenom} email={demo ? null : session?.user.email ?? null} demo={demo} />
        </CadreWidget>
      </Boite>

      {erreurProfil || erreurConnexions ? (
        <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
          <Text style={[typo.petit, { color: p.texte }]}>{[erreurProfil, erreurConnexions].filter(Boolean).join(' ')}</Text>
        </View>
      ) : null}

      {demo ? <ReglagesDemo /> : null}

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

      <Apparence />

      {demo ? null : (
        <Bouton variante="discret" onPress={() => aller('/parametres/compte')}>
          Mon compte
        </Bouton>
      )}

      <View style={styles.actions}>
        <View style={{ flex: 1 }}>
          <Bouton variante="discret" onPress={() => void Linking.openURL(ADRESSE_CONFIDENTIALITE).catch(() => {})}>
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
    </View>
  );
}

// Apparence : Sombre ou Clair, gardé sur le téléphone. Le bouton actif est celui du thème en cours (celui du téléphone tant que rien n'est choisi).
function Apparence() {
  const p = usePalette();
  const clair = useColorScheme() === 'light';
  // Sans boîte de grille : la carte garde sa hauteur naturelle (deux boutons, pas 160 pt)
  return (
    <CadreWidget titre="Apparence">
      <View style={styles.choix} accessibilityRole="radiogroup">
        <Pastille role="radio" nom="Sombre" couleur={p.texte} actif={!clair} onPress={() => definirTheme('sombre')} aide="Thème sombre" />
        <Pastille role="radio" nom="Clair" couleur={p.texte} actif={clair} onPress={() => definirTheme('clair')} aide="Thème clair" />
      </View>
    </CadreWidget>
  );
}

// Réglage de la démo (visible seulement en démo) : combien de séances sont prévues aujourd'hui, pour voir chaque cas de la « Séance du jour ».
function ReglagesDemo() {
  const p = usePalette();
  const { prevuesAujourdhui } = useReglagesDemo();
  const router = useRouter();
  return (
    <CadreWidget titre="Réglage de la démo">
      <Text style={[typo.petit, { color: p.texteDoux, marginBottom: 10 }]}>Séances prévues aujourd'hui</Text>
      <View style={styles.choix} accessibilityRole="radiogroup">
        {PREVUES_AUJOURDHUI.map((n) => (
          <Pastille role="radio" key={n} nom={String(n)} couleur={p.texte} actif={prevuesAujourdhui === n} onPress={() => definirPrevuesAujourdhui(n)} aide={n === 0 ? "Rien de prévu aujourd'hui" : `${n} séance${n > 1 ? 's' : ''} prévue${n > 1 ? 's' : ''} aujourd'hui`} />
        ))}
      </View>
      <View style={{ marginTop: 14 }}>
        <Bouton variante="discret" onPress={() => router.push('/parametres/widgets')}>Catalogue des widgets</Bouton>
      </View>
    </CadreWidget>
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
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  choix: { flexDirection: 'row', gap: espace.e2, flexWrap: 'wrap' },
});
