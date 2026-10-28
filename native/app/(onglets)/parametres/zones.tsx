import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { EcranSection } from '@/components/EcranSection';
import { Pastille } from '@/components/Pastille';
import { calculerZones, MODELES_ZONES, referenceCardio, texteAllure, type ModeleZones } from '@/data/reglages/profil';
import { useProfilSection } from '@/hooks/useProfilSection';
import { avecAlpha, espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les zones d'entraînement : toujours recalculées à partir du profil (FTP, FC au seuil, vitesse seuil), jamais stockées.
// Une barre colorée par modèle (les zones de la plus douce à la plus dure), puis une ligne par zone avec sa plage.
export default function Zones() {
  const p = usePalette();
  const router = useRouter();
  const { ligne, chargement } = useProfilSection('physiologie');
  const extras = (ligne?.extras ?? {}) as Record<string, unknown>;
  const cardio = referenceCardio(ligne);
  // La couleur de la rampe : le sport du modèle (puissance = vélo, allure = course), le rouge pour le cardio
  const refs: { modele: ModeleZones; valeur: unknown; couleur: string; estimee?: boolean }[] = [
    { modele: 'puissance', valeur: ligne?.ftp, couleur: p.sportVelo },
    { modele: 'cardio', valeur: cardio?.bpm, couleur: p.danger, estimee: cardio?.estimee },
    { modele: 'allure', valeur: extras.threshold_speed, couleur: p.sportCourse },
  ];
  if (chargement) return <EcranSection><Text style={[typo.corps, { color: p.texteDoux }]}>Chargement…</Text></EcranSection>;
  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        {refs.map(({ modele, valeur, couleur, estimee }) => {
          const m = MODELES_ZONES[modele];
          const zones = calculerZones(modele, valeur);
          // De la plus douce (transparente) à la plus dure (pleine)
          const teinte = (i: number, n: number) => avecAlpha(couleur, 0.3 + (0.7 * i) / Math.max(1, n - 1));
          return (
            <Bloc key={modele} titre={m.titre}>
              {zones ? (
                <>
                  <View style={styles.reference}>
                    <Text style={[typo.corpsFort, { color: p.texte }]}>
                      {m.reference} {Number(valeur)} {m.unite}
                    </Text>
                    {estimee ? (
                      // Estimée depuis la FC max (92 %) : on le dit en un mot, l'affiner se fait dans Physiologie
                      <View accessible accessibilityLabel="Estimée depuis ta FC max. Renseigne ta FC au seuil pour l'affiner." style={[styles.etiquette, { borderColor: p.alerte }]}>
                        <Text style={[typo.micro, { color: p.alerte }]}>estimée</Text>
                      </View>
                    ) : null}
                  </View>
                  <View accessible accessibilityLabel={`Les ${zones.length} zones de ${m.titre.toLowerCase()}, de la plus douce à la plus dure`} style={styles.barre}>
                    {zones.map((z, i) => (
                      <View key={z.nom} style={{ flex: Math.max(1, Math.min(z.haut, 130) - z.bas), backgroundColor: teinte(i, zones.length) }} />
                    ))}
                  </View>
                  {zones.map((z, i) => (
                    <View key={z.nom} style={[styles.ligne, { borderTopColor: p.trait }]}>
                      <View style={[styles.puce, { backgroundColor: teinte(i, zones.length) }]} />
                      <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{z.nom}</Text>
                      <Text style={[typo.corpsFort, { color: p.texte }]}>
                        {modele === 'allure' ? `${texteAllure(z.a)} – ${texteAllure(z.de)}` : `${z.de} – ${z.a} ${m.unite}`}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                // Pas de référence : un tiret et un raccourci vers la saisie, sans phrase
                <View style={styles.vide}>
                  <Text style={[styles.tiret, { color: p.texteMuet }]}>—</Text>
                  <Pastille nom={`Renseigner ${m.reference}`} actif={false} onPress={() => router.push('/parametres/physiologie')} aide="Ouvre la physiologie" />
                </View>
              )}
            </Bloc>
          );
        })}
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  reference: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  etiquette: { borderWidth: 1, borderRadius: rayon.rond, paddingHorizontal: 10, paddingVertical: 2 },
  barre: { flexDirection: 'row', height: 14, borderRadius: rayon.rond, overflow: 'hidden', gap: 2, marginBottom: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth },
  puce: { width: 12, height: 12, borderRadius: 6 },
  vide: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tiret: { fontSize: 32, lineHeight: 36 },
});
