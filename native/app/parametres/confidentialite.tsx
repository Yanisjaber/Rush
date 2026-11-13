import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { CONTACT, DATE_MAJ, SECTIONS, type SectionConfidentialite } from '@/data/confidentialite';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Confidentialité : le texte de la politique, une section par sujet, dépliable (le Coach IA est ouvert au départ).
// Le texte vit dans src/data/confidentialite.ts (copie de docs/POLITIQUE_CONFIDENTIALITE.md).
function Chevron({ ouvert, couleur }: { ouvert: boolean; couleur: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: ouvert ? '180deg' : '0deg' }] }}>
      <Path d="M6 9l6 6 6-6" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Section({ section, premiere }: { section: SectionConfidentialite; premiere: boolean }) {
  const p = usePalette();
  const [ouvert, setOuvert] = useState(!!section.ouverte);
  return (
    <View style={premiere ? undefined : { borderTopWidth: 1, borderTopColor: p.trait }}>
      <Pressable
        onPress={() => setOuvert((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: ouvert }}
        accessibilityLabel={section.titre}
        style={({ pressed }) => [styles.entete, { backgroundColor: pressed ? p.surface2 : 'transparent' }]}
      >
        <Text style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>{section.titre}</Text>
        <Chevron ouvert={ouvert} couleur={p.texteMuet} />
      </Pressable>
      {ouvert ? (
        <View style={styles.corps}>
          {section.paragraphes?.map((t, i) => (
            <Text key={`p${i}`} style={[typo.petit, { color: p.texteDoux }]}>{t}</Text>
          ))}
          {section.puces?.map((t, i) => (
            <View key={`b${i}`} style={styles.puce}>
              <Text style={[typo.petit, { color: p.texteMuet }]}>•</Text>
              <Text style={[typo.petit, { color: p.texteDoux, flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function Confidentialite() {
  const p = usePalette();
  return (
    <EcranSection>
      <View style={{ gap: espace.e3 }}>
        <View style={[styles.liste, { backgroundColor: p.surface, borderColor: p.trait }]}>
          {SECTIONS.map((s, i) => (
            <Section key={s.id} section={s} premiere={i === 0} />
          ))}
        </View>
        <View style={[styles.contact, { backgroundColor: p.surface, borderColor: p.trait }]}>
          <Text accessibilityRole="header" style={[typo.corpsFort, { color: p.texte }]}>Contact</Text>
          <Text style={[typo.petit, { color: p.texteDoux }]}>Une question, une demande d’accès, de correction ou de suppression ? Écris à Yanis.</Text>
          <Pressable
            onPress={() => void Linking.openURL(`mailto:${CONTACT}`).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`Écrire à ${CONTACT}`}
            style={styles.lien}
          >
            <Text selectable style={[typo.corpsFort, { color: p.texte, textDecorationLine: 'underline' }]}>{CONTACT}</Text>
          </Pressable>
        </View>
        <Text style={[typo.micro, { color: p.texteMuet, textTransform: 'none', letterSpacing: 0 }]}>Les conseils du Coach IA ne remplacent pas un avis médical.</Text>
        <Text style={[typo.micro, { color: p.texteMuet }]}>DERNIÈRE MISE À JOUR : {DATE_MAJ.toUpperCase()}</Text>
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  liste: { borderWidth: 1, borderRadius: rayon.l, overflow: 'hidden' },
  entete: { minHeight: 56, paddingHorizontal: espace.e4, paddingVertical: espace.e3, flexDirection: 'row', alignItems: 'center', gap: espace.e3 },
  corps: { paddingHorizontal: espace.e4, paddingBottom: espace.e4, gap: espace.e2 },
  puce: { flexDirection: 'row', gap: espace.e2 },
  contact: { borderWidth: 1, borderRadius: rayon.l, padding: espace.e4, gap: espace.e2 },
  lien: { minHeight: 44, justifyContent: 'center' },
});
