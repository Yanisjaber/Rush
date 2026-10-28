import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bloc } from '@/components/feuilles/Bloc';
import { Bouton } from '@/components/ui/Bouton';
import { joursDuCycle } from '@/data/calendrier/cycles';
import { dateIsoLocale } from '@/data/outils/format';
import { useCycles } from '@/hooks/useCycles';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Tes cycles d'entraînement : la liste (les plus récents d'abord), un appui pour en modifier un, un bouton pour en créer. Ceux en cours sont marqués.
const courte = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export default function EcranCycles() {
  const p = usePalette();
  const router = useRouter();
  const bas = useSafeAreaInsets().bottom;
  const { cycles, chargement, erreur } = useCycles();
  const aujourdhui = dateIsoLocale(new Date());

  return (
    <ScrollView contentContainerStyle={[styles.contenu, { paddingBottom: bas + espace.e5 }]}>
      <Bouton onPress={() => router.push('/cycle')}>+ Nouveau cycle</Bouton>
      {erreur ? (
        <View accessibilityRole="alert" style={[styles.avis, { backgroundColor: p.surface, borderLeftColor: p.alerte }]}>
          <Text style={[typo.petit, { color: p.texte }]}>{erreur}</Text>
        </View>
      ) : null}
      {chargement ? (
        <View accessible accessibilityLabel="Chargement des cycles" style={styles.attente}>
          <ActivityIndicator color={p.texteDoux} />
        </View>
      ) : (
        <Bloc titre="Mes cycles">
          {cycles.length ? (
            cycles.map((c, i) => {
              const enCours = String(c.from_date).slice(0, 10) <= aujourdhui && aujourdhui <= String(c.to_date).slice(0, 10);
              const n = joursDuCycle(c);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push({ pathname: '/cycle', params: { id: c.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, du ${courte(c.from_date)} au ${courte(c.to_date)}, ${n} jour${n > 1 ? 's' : ''}${enCours ? ', en cours' : ''}`}
                  style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}
                >
                  <View style={[styles.pastille, { backgroundColor: c.color }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte }]}>
                      {c.name}
                    </Text>
                    <Text style={[typo.petit, { color: p.texteDoux }]}>
                      {courte(c.from_date)} – {courte(c.to_date)} · {n} jour{n > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {enCours ? (
                    <View style={[styles.badge, { backgroundColor: p.surface2 }]}>
                      <Text style={[typo.micro, { color: p.texte }]}>En cours</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={[typo.corps, { color: p.texteDoux }]}>
              Pas encore de cycle. Un cycle est une période que tu nommes et colores (« Bloc force », « Affûtage »…) : le calendrier l'affiche en bande de couleur sous chaque jour qu'il couvre. Deux cycles au plus le même jour.
            </Text>
          )}
        </Bloc>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { padding: espace.e4, gap: espace.e3 },
  avis: { borderRadius: rayon.base, borderLeftWidth: 4, paddingHorizontal: 14, paddingVertical: 12 },
  attente: { alignItems: 'center', paddingVertical: espace.e7 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e3, minHeight: 56, paddingVertical: 6 },
  pastille: { width: 14, height: 36, borderRadius: 4 },
  badge: { borderRadius: rayon.rond, paddingHorizontal: 10, paddingVertical: 3 },
});
