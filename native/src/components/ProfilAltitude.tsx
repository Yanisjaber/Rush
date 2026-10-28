import { StyleSheet, Text, View } from 'react-native';
import { CourbeLissee } from '@/components/CourbeLissee';
import { formatKm, formatNombre } from '@/data/outils/format';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le profil d'altitude d'un parcours : l'axe est la distance (les altitudes sont déjà prises à pas de distance réguliers, voir profilAltitude).
interface Props {
  profil: number[];
  min: number;
  max: number;
  /** Longueur du parcours en km, pour l'axe. */
  km: number | null;
  couleur: string;
  /** Hauteur du dessin (sur une largeur de 320). */
  hauteur?: number;
}

export function ProfilAltitude({ profil, min, max, km, couleur, hauteur = 90 }: Props) {
  const p = usePalette();
  return (
    <View>
      <View style={styles.ligne}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>Profil d'altitude</Text>
        <Text style={[typo.petit, { color: p.texteDoux }]}>
          {formatNombre(min)} – {formatNombre(max)} m
        </Text>
      </View>
      <CourbeLissee valeurs={profil} couleur={couleur} largeur={320} hauteur={hauteur} pointFinal={false} min={min} max={max} etiquette={`Profil d'altitude, de ${formatNombre(min)} à ${formatNombre(max)} mètres`} />
      {km != null && km > 0 ? (
        <View style={styles.ligne}>
          <Text style={[typo.petit, { color: p.texteMuet }]}>0 km</Text>
          <Text style={[typo.petit, { color: p.texteMuet }]}>{formatKm(km, km >= 100 ? 0 : 1)} km</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
