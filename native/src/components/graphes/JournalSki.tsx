import { StyleSheet, Text, View } from 'react-native';
import type { EtapeSki } from '@/data/outils/descentes-ski';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La journée de ski en chronologie (maquette 8 « Journal de la journée ») : l'heure, une pastille (couleur du sport pour une descente, grise pour une remontée),
// le nom, puis le dénivelé et la durée (et la vitesse moyenne d'une descente, de A à B). Sans heure de départ connue, on écrit le temps écoulé depuis le début.
interface Props {
  etapes: EtapeSki[];
  couleur: string;
  /** L'heure de départ, en minutes depuis minuit ; null si elle n'est pas connue (saisie sans heure). */
  departMin: number | null;
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

function heure(departMin: number | null, debutS: number): string {
  if (departMin == null) return `+${Math.floor(debutS / 3600)}h${deuxChiffres(Math.floor((debutS % 3600) / 60))}`;
  const m = (departMin + Math.round(debutS / 60)) % (24 * 60);
  return `${deuxChiffres(Math.floor(m / 60))}:${deuxChiffres(m % 60)}`;
}

function duree(s: number): string {
  const m = Math.max(1, Math.round(s / 60));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${deuxChiffres(m % 60)}`;
}

export function JournalSki({ etapes, couleur, departMin }: Props) {
  const p = usePalette();
  if (!etapes.length) return null;
  let descentes = 0;
  return (
    <View style={[styles.bloc, { backgroundColor: p.surface }]}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>LA JOURNÉE</Text>
      {etapes.map((e, i) => {
        const nom = e.type === 'descente' ? `Descente ${++descentes}` : 'Remontée';
        const detail = `${e.deniveleM} m · ${duree(e.dureeS)}${e.vmoyKmh ? ` · ${e.vmoyKmh} km/h` : ''}`;
        return (
          <View key={i} accessible accessibilityLabel={`${heure(departMin, e.debutS)}, ${nom}, ${detail}`} style={styles.ligne}>
            <Text style={[styles.heure, { color: p.texteMuet }]}>{heure(departMin, e.debutS)}</Text>
            <View style={[styles.pastille, { backgroundColor: e.type === 'descente' ? couleur : p.traitFort }]} />
            <Text numberOfLines={1} style={[styles.nom, { color: p.texte }]}>{nom}</Text>
            <Text numberOfLines={1} style={[styles.detail, { color: p.texteDoux }]}>{detail}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { borderRadius: rayon.base, padding: espace.e3, gap: 2 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2, minHeight: 30 },
  heure: { width: 46, fontFamily: police.texte500, fontSize: 12, fontVariant: ['tabular-nums'] },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  nom: { fontFamily: police.titre700, fontSize: 13 },
  detail: { flex: 1, textAlign: 'right', fontFamily: police.texte400, fontSize: 12, fontVariant: ['tabular-nums'] },
});
