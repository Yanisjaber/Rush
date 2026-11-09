import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CarteTrace } from '@/components/graphes/CarteTrace';
import { ProfilAltitude } from '@/components/graphes/ProfilAltitude';
import { OngletsSegment } from '@/components/menus/OngletsSegment';
import type { PointCarte, RegionCarte } from '@/data/calendrier/apercu-import';
import { espace, rayon } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// Le parcours et le plan d'une séance prévue, en trois onglets : Carte (grande carte avec départ, arrivée et ouverture dans Plans posés dessus), Profil (altitude) et Plan (les blocs, passés en `plan`).
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
  /** Le contenu de l'onglet Plan (profil de séance et blocs) ; absent si la séance n'a pas de blocs. */
  plan?: ReactNode;
}

const NOMS: Record<Onglet, string> = { carte: 'Carte', profil: 'Profil', plan: 'Plan' };

/** Vrai si le parcours a de quoi remplir au moins la carte ou le profil. */
export function aUnParcours(parcours: Parcours | null): boolean {
  if (!parcours) return false;
  return (!!parcours.region && parcours.trace.length > 1) || (parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null);
}

export function ParcoursOnglets({ parcours, couleur, km, plan }: Props) {
  const p = usePalette();
  const aCarte = !!parcours?.region && parcours.trace.length > 1;
  const aProfil = !!parcours && parcours.profil.length > 1 && parcours.altitudeMin != null && parcours.altitudeMax != null;
  const disponibles: Onglet[] = [...(aCarte ? (['carte'] as const) : []), ...(aProfil ? (['profil'] as const) : []), ...(plan ? (['plan'] as const) : [])];
  const [choix, setChoix] = useState<Onglet>(disponibles[0] ?? 'plan');
  if (!disponibles.length) return null;
  const actuel = disponibles.includes(choix) ? choix : disponibles[0];

  return (
    <View style={styles.cadre}>
      {disponibles.length > 1 ? <OngletsSegment onglets={disponibles.map((cle) => ({ cle, nom: NOMS[cle] }))} actuel={actuel} onChoisir={setChoix} etiquette="Vue de la séance" /> : null}

      {actuel === 'carte' && parcours?.region ? (
        <CarteTrace trace={parcours.trace} region={parcours.region} couleur={couleur} hauteur={400} />
      ) : null}

      {actuel === 'profil' && parcours && parcours.altitudeMin != null && parcours.altitudeMax != null ? (
        <View style={[styles.carteProfil, { backgroundColor: p.surface }]}>
          <ProfilAltitude profil={parcours.profil} min={parcours.altitudeMin} max={parcours.altitudeMax} km={km ?? null} couleur={couleur} hauteur={160} />
        </View>
      ) : null}

      {actuel === 'plan' ? plan : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { gap: espace.e3 },
  carteProfil: { borderRadius: rayon.bloc, padding: espace.e3 },
});
