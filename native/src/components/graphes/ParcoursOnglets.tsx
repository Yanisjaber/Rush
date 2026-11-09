import { useState, type ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/ui/Bouton';
import { CarteTrace } from '@/components/graphes/CarteTrace';
import { ProfilAltitude } from '@/components/graphes/ProfilAltitude';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import type { PointCarte, RegionCarte } from '@/data/calendrier/apercu-import';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le parcours et le plan d'une séance prévue, en trois onglets : Carte (trace, départ, arrivée, ouverture dans Plans), Profil (altitude) et Plan (les blocs, passés en `plan`).
// Seuls les onglets qui ont du contenu s'affichent ; s'il n'y en a qu'un, on le montre directement, sans barre d'onglets.
type Onglet = 'carte' | 'profil' | 'plan';

interface Parcours {
  trace: PointCarte[];
  region: RegionCarte | null;
  profil: number[];
  altitudeMin: number | null;
  altitudeMax: number | null;
}

interface Props {
  parcours: Parcours | null;
  couleur: string;
  km?: number | null;
  nomFichier?: string | null;
  /** Le contenu de l'onglet Plan (profil de séance et blocs) ; absent si la séance n'a pas de blocs. */
  plan?: ReactNode;
}

const NOMS: Record<Onglet, string> = { carte: 'Carte', profil: 'Profil', plan: 'Plan' };

export function ParcoursOnglets({ parcours, couleur, km, nomFichier, plan }: Props) {
  const p = usePalette();
  const aCarte = !!parcours?.region && parcours.trace.length > 1;
  const aProfil = !!parcours && parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null;
  const disponibles: Onglet[] = [...(aCarte ? (['carte'] as const) : []), ...(aProfil ? (['profil'] as const) : []), ...(plan ? (['plan'] as const) : [])];
  const [choix, setChoix] = useState<Onglet>(disponibles[0] ?? 'plan');
  if (!disponibles.length) return null;
  const actuel = disponibles.includes(choix) ? choix : disponibles[0];

  const ouvrirDansPlans = () => {
    const depart = parcours?.trace[0];
    if (!depart) return;
    void Linking.openURL(`https://maps.apple.com/?ll=${depart.latitude},${depart.longitude}&q=${encodeURIComponent('Départ')}`);
  };

  return (
    <View style={styles.cadre}>
      {disponibles.length > 1 ? <OngletsSegment onglets={disponibles.map((cle) => ({ cle, nom: NOMS[cle] }))} actuel={actuel} onChoisir={setChoix} etiquette="Vue de la séance" /> : null}

      {actuel === 'carte' && parcours?.region ? (
        <View style={{ gap: espace.e2 }}>
          <CarteTrace trace={parcours.trace} region={parcours.region} couleur={couleur} hauteur={340} />
          <View style={styles.legende}>
            <View style={[styles.pastille, { backgroundColor: p.surface2 }]}>
              <View style={[styles.point, { backgroundColor: p.texte }]} />
              <Text style={[typo.petit, { color: p.texte }]}>Départ</Text>
            </View>
            <View style={[styles.pastille, { backgroundColor: p.surface2 }]}>
              <View style={[styles.point, { backgroundColor: couleur }]} />
              <Text style={[typo.petit, { color: p.texte }]}>Arrivée</Text>
            </View>
          </View>
          <Bouton variante="discret" onPress={ouvrirDansPlans}>
            Ouvrir dans Plans
          </Bouton>
        </View>
      ) : null}

      {actuel === 'profil' && parcours && parcours.altitudeMin != null && parcours.altitudeMax != null ? (
        <View style={{ gap: espace.e2 }}>
          <ProfilAltitude profil={parcours.profil} min={parcours.altitudeMin} max={parcours.altitudeMax} km={km ?? null} couleur={couleur} hauteur={140} />
          {nomFichier ? <Text style={[typo.petit, { color: p.texteDoux }]}>{nomFichier}</Text> : null}
        </View>
      ) : null}

      {actuel === 'plan' ? plan : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { gap: espace.e3 },
  legende: { flexDirection: 'row', gap: espace.e2 },
  pastille: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, borderRadius: rayon.base, paddingHorizontal: 10 },
  point: { width: 9, height: 9, borderRadius: 5 },
});
