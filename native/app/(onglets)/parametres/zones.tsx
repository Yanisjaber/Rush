import { StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { EcranSection } from '@/components/EcranSection';
import { calculerZones, MODELES_ZONES, referenceCardio, texteAllure, type ModeleZones } from '@/data/profil';
import { useProfilSection } from '@/hooks/useProfilSection';
import { espace } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les zones d'entraînement : toujours recalculées à partir du profil (FTP, FC au seuil, vitesse seuil), jamais stockées.
export default function Zones() {
  const p = usePalette();
  const { ligne, chargement } = useProfilSection('physiologie');
  const extras = (ligne?.extras ?? {}) as Record<string, unknown>;
  const cardio = referenceCardio(ligne);
  const refs: { modele: ModeleZones; valeur: unknown; note?: string }[] = [
    { modele: 'puissance', valeur: ligne?.ftp },
    { modele: 'cardio', valeur: cardio?.bpm, note: cardio?.estimee ? 'Estimée depuis ta FC max (92 %). Renseigne ta FC au seuil pour l’affiner.' : undefined },
    { modele: 'allure', valeur: extras.threshold_speed },
  ];
  if (chargement) return <EcranSection><Text style={[typo.corps, { color: p.texteDoux }]}>Chargement…</Text></EcranSection>;
  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        {refs.map(({ modele, valeur, note }) => {
          const m = MODELES_ZONES[modele];
          const zones = calculerZones(modele, valeur);
          return (
            <Bloc key={modele} titre={m.titre}>
              {zones ? (
                <>
                  <Text style={[typo.petit, { color: p.texteDoux }]}>
                    {m.reference} : {Number(valeur)} {m.unite}
                  </Text>
                  {note ? <Text style={[typo.petit, { color: p.texteMuet }]}>{note}</Text> : null}
                  {zones.map((z) => (
                    <View key={z.nom} style={[styles.ligne, { borderTopColor: p.trait }]}>
                      <Text style={[typo.corps, { color: p.texte, flex: 1 }]}>{z.nom}</Text>
                      <Text style={[typo.corpsFort, { color: p.texte }]}>
                        {modele === 'allure' ? `${texteAllure(z.a)} – ${texteAllure(z.de)}` : `${z.de} – ${z.a} ${m.unite}`}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={[typo.corps, { color: p.texteDoux }]}>Renseigne ta {m.reference} dans Physiologie pour voir tes zones.</Text>
              )}
            </Bloc>
          );
        })}
      </View>
    </EcranSection>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth },
});
