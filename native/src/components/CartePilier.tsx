import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CourbeLissee } from '@/components/CourbeLissee';
import type { Niveau } from '@/data/forme-sante';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La carte de l'écran Santé : la MÊME pour chaque pilier de l'état de forme et chaque suivi (corps, nutrition).
//   ligne 1 : le nom, et où il en est (un point de couleur ET un mot : la couleur ne se lit jamais seule) ;
//   ligne 2 : la valeur du jour, l'écart à ta moyenne, la mini courbe des 14 derniers jours.
// Sans donnée, la carte dit quoi faire pour en avoir. Un appui ouvre le détail.
const MOT: Record<Niveau, string> = { bon: 'Bon', moyen: 'Moyen', faible: 'Faible' };

interface Props {
  nom: string;
  valeur: string;
  unite: string;
  ecart: string | null;
  niveau?: Niveau | null;
  courbe: number[];
  manquant?: string | null;
  onPress: () => void;
}

export function CartePilier({ nom, valeur, unite, ecart, niveau = null, courbe, manquant = null, onPress }: Props) {
  const p = usePalette();
  const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.texteMuet;
  const etiquette = [nom, niveau ? MOT[niveau] : '', manquant ?? `${valeur} ${unite}`, ecart ?? ''].filter(Boolean).join(', ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiquette} accessibilityHint="Ouvre le détail" style={[styles.carte, { backgroundColor: p.surface }]}>
      <View style={styles.haut}>
        <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flex: 1 }]}>
          {nom}
        </Text>
        {niveau ? (
          <View style={styles.niveau}>
            <View style={[styles.point, { backgroundColor: couleur }]} />
            <Text style={[styles.mot, { color: p.texte }]}>{MOT[niveau]}</Text>
          </View>
        ) : (
          <View style={[styles.fleche, { borderColor: p.texteDoux }]} />
        )}
      </View>
      {manquant ? (
        <Text style={[typo.petit, { color: p.texteDoux, marginTop: 4 }]}>{manquant}</Text>
      ) : (
        <View style={styles.bas}>
          <Text numberOfLines={1} style={[styles.valeur, { color: p.texte }]}>
            {valeur}
            {unite ? <Text style={[typo.petit, { color: p.texteDoux }]}> {unite}</Text> : null}
          </Text>
          <Text numberOfLines={2} style={[typo.petit, styles.ecart, { color: p.texteDoux }]}>
            {ecart ?? ''}
          </Text>
          {courbe.length > 1 ? (
            <View style={styles.courbe}>
              <CourbeLissee valeurs={courbe} couleur={p.texteDoux} largeur={100} hauteur={40} aire={false} pointFinal={false} epaisseur={2.2} etiquette={`${nom} sur les ${courbe.length} derniers jours`} />
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: { borderRadius: rayon.bloc, paddingHorizontal: 18, paddingVertical: 14, minHeight: 84 },
  haut: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  niveau: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  point: { width: 10, height: 10, borderRadius: 5 },
  mot: { fontFamily: police.texte600, fontSize: 14, lineHeight: 20 },
  bas: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  valeur: { fontFamily: police.titre700, fontSize: 30, lineHeight: 36, fontVariant: ['tabular-nums'], flexShrink: 0 },
  ecart: { flex: 1, minWidth: 0 },
  courbe: { width: 72 },
  fleche: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, transform: [{ rotate: '45deg' }] },
});
