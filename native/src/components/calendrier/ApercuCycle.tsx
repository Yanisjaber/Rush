import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bouton } from '@/components/ui/Bouton';
import { avancementCycle, joursDuCycle } from '@/data/calendrier/cycles';
import { couleurNote } from '@/data/calendrier/annotations';
import { periodeCourte } from '@/data/outils/format';
import { useEcrituresCycles } from '@/hooks/useCycles';
import { espace, rayon } from '@/theme/couleurs';
import { SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import type { Cycle } from '@/data/types';

// Ce qui s'ouvre en touchant un cycle du détail d'un jour : une petite fenêtre qui l'AFFICHE (nom, période, avancement ce jour-là), avec « Modifier »
// (qui ouvre l'écran du cycle) et « Supprimer » (après confirmation). Les séances ne sont jamais touchées par la suppression d'un cycle.
export function ApercuCycle({ cycle, jour, onFermer, onModifier }: { cycle: Cycle | null; jour: string; onFermer: () => void; onModifier: (c: Cycle) => void }) {
  const p = usePalette();
  const { supprimer } = useEcrituresCycles(); // pas besoin de charger tous les cycles pour en supprimer un
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  // Un autre cycle (ou une réouverture) repart sans l'erreur du précédent
  useEffect(() => {
    setErreur('');
    setEnCours(false);
  }, [cycle]);

  function confirmerSuppression() {
    if (!cycle) return;
    Alert.alert(`Supprimer « ${cycle.name} » ?`, 'Le cycle disparaît du calendrier. Tes séances ne sont pas touchées.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setEnCours(true);
          const e = await supprimer(cycle.id);
          setEnCours(false);
          if (e) return setErreur(e);
          onFermer();
        },
      },
    ]);
  }

  const av = cycle ? avancementCycle(cycle, jour) : null;
  const couleur = cycle ? couleurNote(cycle.color) : p.traitFort;

  return (
    <Modal visible={!!cycle} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable accessibilityLabel="Fermer" accessibilityRole="button" onPress={onFermer} style={styles.fond} />
      {cycle && av ? (
        <View style={styles.centre} pointerEvents="box-none">
          <View accessibilityViewIsModal style={[styles.popup, { backgroundColor: p.surface, borderColor: p.traitFort }]}>
            <View style={styles.tete}>
              <View style={[styles.barre, { backgroundColor: couleur }]} />
              <Text accessibilityRole="header" numberOfLines={2} style={[typo.titre3, { color: p.texte, flex: 1 }]}>
                {cycle.name}
              </Text>
            </View>
            <Text style={[typo.petit, { color: p.texteDoux }]}>
              {periodeCourte(cycle.from_date, cycle.to_date)} · {joursDuCycle(cycle)} jour{joursDuCycle(cycle) > 1 ? 's' : ''}
              {cycle.sport && Object.hasOwn(SPORTS, cycle.sport) ? ` · ${SPORTS[cycle.sport as CleSport].nom}` : ' · Tous les sports'}
            </Text>
            <View accessible accessibilityLabel={`Jour ${av.jour} sur ${av.total}`} style={{ gap: 6 }}>
              <Text style={[typo.corpsFort, { color: p.texte }]}>
                Jour {av.jour} sur {av.total}
              </Text>
              <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
                <View style={[styles.remplie, { width: `${Math.round(av.part * 100)}%`, backgroundColor: couleur }]} />
              </View>
            </View>
            {erreur ? (
              <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger }]}>
                {erreur}
              </Text>
            ) : null}
            {/* Deux petits boutons côte à côte, à droite : la fenêtre reste légère */}
            <View style={styles.boutons}>
              <Bouton petit variante="discret" onPress={confirmerSuppression}>
                {enCours ? 'Suppression…' : 'Supprimer'}
              </Bouton>
              <Bouton petit onPress={() => onModifier(cycle)}>
                Modifier
              </Bouton>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  centre: { ...StyleSheet.absoluteFill, justifyContent: 'center', paddingHorizontal: espace.e4 },
  popup: { borderWidth: 1, borderRadius: rayon.bloc, padding: espace.e4, gap: espace.e3 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barre: { width: 6, height: 26, borderRadius: 3 },
  piste: { height: 6, borderRadius: 3, overflow: 'hidden' },
  remplie: { height: '100%', borderRadius: 3 },
  boutons: { flexDirection: 'row', justifyContent: 'flex-end', gap: espace.e2 },
});
