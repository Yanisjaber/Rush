import { Link, type Href } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/Bloc';
import { Bouton } from '@/components/Bouton';
import { deconnexion, quitterDemo, useAuth } from '@/stores/auth';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

const ADRESSE_CONFIDENTIALITE = 'https://yanisjaber.github.io/Rush/#/confidentialite';

const SECTIONS: { href: Href; titre: string; detail: string }[] = [
  { href: '/parametres/profil', titre: 'Profil', detail: 'Prénom, naissance, taille, poids' },
  { href: '/parametres/physiologie', titre: 'Physiologie', detail: 'FC, FTP, VMA, natation' },
  { href: '/parametres/zones', titre: 'Zones', detail: 'Puissance, cardio, allure (calculées)' },
  { href: '/parametres/sports', titre: 'Mes sports', detail: 'Ce qui compose ton Accueil' },
  { href: '/parametres/connexions', titre: 'Connexions', detail: 'Strava, Garmin' },
];

// Paramètres : la liste des sections, puis le compte.
export default function Parametres() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { session, demo } = useAuth();

  return (
    <ScrollView style={{ backgroundColor: p.fond }} contentContainerStyle={[styles.contenu, { paddingTop: insets.top + espace.e4, paddingBottom: insets.bottom + 72 }]}>
      <Text accessibilityRole="header" style={[typo.titre1, { color: p.texte }]}>
        Paramètres
      </Text>
      <View style={[styles.liste, { backgroundColor: p.surface }]}>
        {SECTIONS.map((s, i) => (
          <Link key={s.titre} href={s.href} asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={`${s.titre}, ${s.detail}`} style={({ pressed }) => [styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }, pressed && { backgroundColor: p.surface2 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[typo.corpsFort, { color: p.texte }]}>{s.titre}</Text>
                <Text style={[typo.petit, { color: p.texteDoux }]}>{s.detail}</Text>
              </View>
              <View style={[styles.chevron, { borderColor: p.texteMuet }]} />
            </Pressable>
          </Link>
        ))}
      </View>
      <Bloc titre="Compte">
        <Text style={[typo.petit, { color: p.texteDoux }]}>{demo ? "Tu es en mode démo : des données d'exemple, aucun compte." : 'Connecté en tant que'}</Text>
        {!demo ? <Text style={[typo.corpsFort, { color: p.texte, marginTop: 2 }]}>{session?.user.email ?? ''}</Text> : null}
        <View style={{ marginTop: espace.e4, gap: espace.e3 }}>
          <Bouton variante="discret" onPress={() => void Linking.openURL(ADRESSE_CONFIDENTIALITE)}>
            Confidentialité
          </Bouton>
          <Bouton variante="discret" onPress={demo ? quitterDemo : () => void deconnexion()}>
            {demo ? 'Quitter la démo' : 'Se déconnecter'}
          </Bouton>
        </View>
      </Bloc>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace.e4, gap: espace.e4 },
  liste: { borderRadius: 6, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  chevron: { width: 10, height: 10, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },
});
