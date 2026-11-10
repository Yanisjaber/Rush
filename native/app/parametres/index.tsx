import { FondDegrade } from '@/components/ui/FondDegrade';
import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Bouton } from '@/components/ui/Bouton';
import { BoutonRetour } from '@/components/ui/BoutonRetour';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { Pastille } from '@/components/ui/Pastille';
import type { Connexion } from '@/data/reglages/parametres';
import { useResumeParametres } from '@/hooks/useResumeParametres';
import { deconnexion, quitterDemo, useAuth } from '@/stores/auth';
import { definirTheme } from '@/stores/theme';
import { definirPrevuesAujourdhui, PREVUES_AUJOURDHUI, useReglagesDemo } from '@/stores/reglages-demo';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const ADRESSE_SITE = 'https://yanisjaber.github.io/Rush/';

const ouvrirSite = (chemin: string) => void Linking.openURL(`${ADRESSE_SITE}${chemin}`).catch(() => {});

// Mon compte : un en-tête (initiale, titre, e-mail), puis des menus en lignes groupés (profil, connexions, préférences, sécurité, session).
// Les réglages détaillés s'ouvrent dans leur propre écran ; mot de passe, export et confidentialité passent par le site (même compte).
export default function Parametres() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, demo } = useAuth();
  const { resume: resumeBrut, chargement, erreurProfil, erreurConnexions } = useResumeParametres();
  // Une lecture en erreur n'affiche ni « — » ni « non connecté » : on le dit, sans toucher aux autres lignes
  const connexions = erreurConnexions
    ? { etat: 'absente' as const, note: 'Illisible pour le moment' }
    : chargement && !demo
      ? { etat: 'absente' as const, note: 'Chargement…' }
      : resumeBrut.connexions;
  const resume = { ...resumeBrut, connexions };
  const aller = (vers: Href) => router.push(vers);
  const email = demo ? null : session?.user.email ?? null;
  const initiale = (resume.prenom || email || (demo ? 'D' : 'R')).trim().charAt(0).toUpperCase();
  const note = (t: { note: string; valeur: string; unite?: string }) => [t.valeur !== '—' ? [t.valeur, t.unite].filter(Boolean).join(' ') : '', t.note].filter(Boolean).join(' · ') || 'À renseigner';

  return (
    <View style={{ flex: 1 }}>
      <FondDegrade />
      <ScrollView style={{ backgroundColor: 'transparent' }} contentContainerStyle={[styles.contenu, { paddingTop: insets.top + espace.e4, paddingBottom: insets.bottom + 72 }]}>
        <BoutonRetour />

        <View accessible accessibilityRole="header" accessibilityLabel={demo ? "Mon compte, mode démo, des données d'exemple" : `Mon compte, ${resume.prenom || 'sans prénom'}, ${email ?? ''}`} style={styles.entete}>
          <View style={[styles.avatar, { backgroundColor: p.texte }]}>
            <Text style={[styles.initiale, { color: p.fond }]}>{initiale}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[typo.titre1, { color: p.texte }]}>Mon compte</Text>
            <Text numberOfLines={1} style={[typo.corps, { color: p.texteDoux }]}>{demo ? "Mode démo · données d'exemple" : email ?? ''}</Text>
          </View>
        </View>

        {erreurProfil || erreurConnexions ? (
          <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
            <Text style={[typo.petit, { color: p.texte }]}>{[erreurProfil, erreurConnexions].filter(Boolean).join(' ')}</Text>
          </View>
        ) : null}

        {demo ? <ReglagesDemo /> : null}

        <Groupe titre="Mon profil">
          <Ligne titre="Profil" detail={note(resume.profil)} onPress={() => aller('/parametres/profil')} />
          <Ligne titre="Physiologie" detail={note(resume.physiologie)} onPress={() => aller('/parametres/physiologie')} />
          <Ligne titre="Zones" detail={note(resume.zones)} onPress={() => aller('/parametres/zones')} />
          <Ligne titre="Mes sports" detail={note(resume.sports)} onPress={() => aller('/parametres/sports')} />
        </Groupe>

        <Groupe titre="Connexions">
          <Ligne titre="Strava et synchro" detail={resume.connexions.note || 'Non connecté'} droite={<PastilleEtat etat={resume.connexions.etat} />} onPress={() => aller('/parametres/connexions')} />
        </Groupe>

        <Groupe titre="Préférences">
          <Apparence />
        </Groupe>

        <Groupe titre="Sécurité et données">
          {demo ? null : <Ligne titre="Changer mon mot de passe" detail="Ouvre le site" externe onPress={() => ouvrirSite('#/mot-de-passe')} />}
          {demo ? null : <Ligne titre="Exporter mes données" detail="Fichier JSON, via le site" externe onPress={() => ouvrirSite('#/parametres/general')} />}
          <Ligne titre="Confidentialité" detail="Ouvre le site" externe onPress={() => ouvrirSite('#/confidentialite')} />
        </Groupe>

        <Groupe titre="Session">
          <Ligne titre={demo ? 'Quitter la démo' : 'Se déconnecter'} onPress={demo ? quitterDemo : () => void deconnexion()} />
          {demo ? null : <Ligne titre="Supprimer mon compte" danger onPress={() => aller('/parametres/compte')} />}
        </Groupe>
      </ScrollView>
    </View>
  );
}

// Un groupe de lignes : une étiquette en micro-capitales, puis un bloc de lignes séparées par un trait fin.
function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  const p = usePalette();
  const lignes = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={{ gap: espace.e2 }}>
      <Text accessibilityRole="header" style={[typo.micro, { color: p.texteMuet }]}>{titre.toUpperCase()}</Text>
      <View style={[styles.groupe, { backgroundColor: p.surface, borderColor: p.trait }]}>
        {lignes.map((l, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: p.trait } : undefined}>{l}</View>
        ))}
      </View>
    </View>
  );
}

// Une ligne de menu : titre, détail en dessous, puis un chevron (› ouvre un écran, ↗ ouvre le site). Cible de 52 pt au moins.
function Ligne({ titre, detail, onPress, danger, externe, droite }: { titre: string; detail?: string; onPress: () => void; danger?: boolean; externe?: boolean; droite?: ReactNode }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${titre}. ${detail}` : titre}
      accessibilityHint={externe ? 'Ouvre le site' : undefined}
      style={({ pressed }) => [styles.ligne, { backgroundColor: pressed ? p.surface2 : 'transparent' }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[typo.corpsFort, { color: danger ? p.danger : p.texte }]}>{titre}</Text>
        {detail ? <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>{detail}</Text> : null}
      </View>
      {droite}
      {danger ? null : (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Path d={externe ? 'M7 17L17 7M9 7h8v8' : 'M9 5l7 7-7 7'} stroke={p.texteMuet} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </Pressable>
  );
}

// Apparence : Sombre ou Clair, gardé sur le téléphone. Le bouton actif est celui du thème en cours (celui du téléphone tant que rien n'est choisi).
function Apparence() {
  const p = usePalette();
  const clair = useColorScheme() === 'light';
  return (
    <View style={styles.ligne}>
      <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>Apparence</Text>
      <View style={styles.choix} accessibilityRole="radiogroup">
        <Pastille role="radio" nom="Sombre" couleur={p.texte} actif={!clair} onPress={() => definirTheme('sombre')} aide="Thème sombre" />
        <Pastille role="radio" nom="Clair" couleur={p.texte} actif={clair} onPress={() => definirTheme('clair')} aide="Thème clair" />
      </View>
    </View>
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

// La pastille d'état d'une connexion : verte connectée, rouge en erreur, grise absente
function PastilleEtat({ etat }: { etat: Connexion['etat'] }) {
  const p = usePalette();
  const c = etat === 'connecte' ? p.ok : etat === 'erreur' ? p.danger : p.traitFort;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.pastille, { backgroundColor: c }]} />;
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace.e4 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  initiale: { fontFamily: police.titre800, fontSize: 34, lineHeight: 40 },
  groupe: { borderWidth: 1, borderRadius: rayon.base, overflow: 'hidden' },
  ligne: { minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pastille: { width: 14, height: 14, borderRadius: 7 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  choix: { flexDirection: 'row', gap: espace.e2, flexWrap: 'wrap' },
});
