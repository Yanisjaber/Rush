import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CarteTrace } from '@/components/graphes/CarteTrace';
import { EnteteFlottante, HAUT_ENTETE } from '@/components/graphes/EnteteFlottante';
import { ProfilCurseur } from '@/components/graphes/ProfilCurseur';
import type { PointCarte, RegionCarte } from '@/data/calendrier/apercu-import';
import { longueurKm, pointAuFraction, regionPourZone } from '@/data/outils/trace';
import { espace, rayon } from '@/theme/couleurs';
import { usePalette } from '@/theme/usePalette';

// L'écran d'un parcours (maquette « Profil sur la carte ») : la carte en plein fond avec la trace entière visible, le retour et le titre flottants en haut,
// et une feuille en bas avec le profil d'altitude (on y glisse le doigt : un point suit sur la carte) et les chiffres clés.
interface Props {
  trace: PointCarte[];
  region: RegionCarte;
  profil: number[];
  altitudeMin: number;
  altitudeMax: number;
  km: number | null;
  couleur: string;
  /** Le titre flottant en haut, à côté du bouton retour. S'il est trop long pour la pastille, un appui l'affiche en entier dans une fenêtre. */
  titre: string;
  /** Sous le profil : les chiffres clés. */
  chiffres?: ReactNode;
  /** Le crayon en haut à droite : ouvre le formulaire de modification. */
  onModifier?: () => void;
}

export function VueParcours({ trace, region, profil, altitudeMin, altitudeMax, km, couleur, titre, chiffres, onModifier }: Props) {
  const p = usePalette();
  const { top: haut, bottom: bas } = useSafeAreaInsets();
  const [dims, setDims] = useState({ page: 0, feuille: 0 });
  const [fraction, setFraction] = useState<number | null>(null);
  // L'axe suit la longueur réelle du parcours (celle de la trace), pas la distance saisie sur la séance : le profil et la trace couvrent le même tracé
  const kmTrace = useMemo(() => longueurKm(trace), [trace]);
  const curseur = useMemo(() => (fraction == null ? null : pointAuFraction(trace, fraction)), [trace, fraction]);
  // La trace doit rester entière dans la zone libre (sous l'en-tête, au-dessus de la feuille) : on décale la carte en conséquence
  const regionAffichee = useMemo(() => regionPourZone(region, { hauteur: dims.page, haut: haut + HAUT_ENTETE, bas: dims.feuille }), [region, dims, haut]);

  return (
    <View style={styles.page} onLayout={(e: LayoutChangeEvent) => setDims((d) => ({ ...d, page: e.nativeEvent.layout.height }))}>
      <CarteTrace plein trace={trace} region={regionAffichee} couleur={couleur} curseur={curseur} />
      <EnteteFlottante titre={titre} onModifier={onModifier} />
      <View
        onLayout={(e: LayoutChangeEvent) => setDims((d) => ({ ...d, feuille: e.nativeEvent.layout.height }))}
        style={[styles.feuille, { backgroundColor: p.fond, borderColor: p.trait, paddingBottom: bas + espace.e4 }]}
      >
        <ProfilCurseur profil={profil} min={altitudeMin} max={altitudeMax} km={kmTrace > 0 ? kmTrace : km} couleur={couleur} hauteur={110} onChange={setFraction} />
        {chiffres}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  feuille: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: rayon.bloc, borderTopRightRadius: rayon.bloc, borderTopWidth: 1, padding: espace.e4, gap: espace.e3 },
});
