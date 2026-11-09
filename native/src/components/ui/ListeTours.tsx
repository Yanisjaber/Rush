import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { LigneTour } from '@/data/calendrier/seance-detail';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les tours (laps) d'une sortie : numéro, temps, nom et distance, allure ou vitesse. Trois états : chargement, erreur (un message), liste ou « pas de tour ».
interface Props {
  lignes: LigneTour[];
  chargement: boolean;
  erreur: string;
}

export function ListeTours({ lignes, chargement, erreur }: Props) {
  const p = usePalette();
  if (chargement) {
    return (
      <View accessible accessibilityLabel="Chargement des tours" style={styles.attente}>
        <ActivityIndicator color={p.texteDoux} />
        <Text style={[typo.petit, { color: p.texteDoux }]}>Chargement des tours…</Text>
      </View>
    );
  }
  if (erreur) return <Text style={[typo.corps, { color: p.texteDoux }]}>{erreur}</Text>;
  if (!lignes.length) return <Text style={[typo.corps, { color: p.texteDoux }]}>Pas de tour sur cette séance. Ils apparaissent quand ta montre en marque (bouton « lap »).</Text>;
  return (
    <View style={[styles.liste, { backgroundColor: p.surface }]}>
      {lignes.map((l, i) => (
        <View
          key={l.cle}
          accessible
          accessibilityLabel={`Tour ${l.numero}${l.nom ? `, ${l.nom}` : ''}, ${l.duree}${l.distance ? `, ${l.distance}` : ''}${l.rythme ? `, ${l.rythme}` : ''}`}
          style={[styles.tour, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
        >
          <Text style={[typo.petit, styles.numero, { color: p.texteDoux }]}>{l.numero}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.duree, { color: p.texte }]}>{l.duree}</Text>
            {l.nom || l.distance ? (
              <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
                {[l.nom, l.distance].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          {l.rythme ? <Text style={[typo.corpsFort, { color: p.texte }]}>{l.rythme}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  attente: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  liste: { borderRadius: 14, paddingHorizontal: espace.e3 },
  tour: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, minHeight: 52, paddingVertical: 6 },
  numero: { width: 24, fontFamily: police.texte600, fontVariant: ['tabular-nums'] },
  duree: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
});
