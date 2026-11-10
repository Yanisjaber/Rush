import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { CarteProfil } from '@/data/coach/types';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';
import { BoutonCompact } from '@/components/ui/BoutonCompact';

// La carte « profil » : ce que le coach a compris de toi (jours libres, blessures, ancienneté…) et propose de retenir pour mieux ajuster tes plans.
// Elle n'enregistre RIEN toute seule : c'est « Retenir » qui écrit (le serveur revérifie). Pas de « Annuler » : pour changer, tu le dis au coach.
// Chaque état se dit avec un mot ET une icône. Les lignes viennent du serveur (listes fermées) et s'affichent telles quelles.
interface Props {
  carte: CarteProfil;
  /** Une action est en cours sur cette carte */
  occupee: boolean;
  erreur?: string;
  onRetenir: () => void;
}

function Picto({ nom, couleur }: { nom: 'ok' | 'alerte'; couleur: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {nom === 'alerte' ? <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v6M12 16.5v.5" stroke={couleur} strokeWidth={2} strokeLinecap="round" /> : <Path d="M5 12l5 5 9-10" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
    </Svg>
  );
}

export function CarteProfilCoach({ carte, occupee, erreur, onRetenir }: Props) {
  const p = usePalette();
  const etat = occupee && carte.etat === 'proposee' ? 'en_cours' : carte.etat;
  const titre = carte.intention || 'Ton profil de coureur';

  return (
    <View style={[styles.carte, { backgroundColor: p.surface, borderColor: p.trait }]}>
      <View style={[styles.bandeau, { backgroundColor: p.sportCourse }]} />
      <View accessible accessibilityLabel={`${titre}. ${carte.lignes.join('. ')}.`} style={styles.corps}>
        <Text style={[typo.corpsFort, { color: p.texte }]}>{titre}</Text>
        {carte.lignes.map((l, i) => (
          <Text key={`${i}-${l}`} style={[typo.corps, { color: p.texteDoux }]}>
            {l}
          </Text>
        ))}
      </View>

      <View style={[styles.etat, { borderTopColor: p.trait }]}>
        {etat === 'proposee' ? <BoutonCompact style="principal" teinte={p.sportCourse} libelle="Retenir" accessibilityLabel="Retenir ces informations dans mon profil de coureur" onPress={onRetenir} /> : null}

        {etat === 'en_cours' ? (
          <View accessible accessibilityLabel="Enregistrement en cours" style={styles.ligne}>
            <ActivityIndicator color={p.texteDoux} />
            <Text style={[typo.petit, { color: p.texteDoux }]}>Enregistrement…</Text>
          </View>
        ) : null}

        {etat === 'ajoutee' ? (
          <View style={styles.ligne}>
            <Picto nom="ok" couleur={p.ok} />
            <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>Retenu dans ton profil</Text>
          </View>
        ) : null}

        {etat === 'refusee' || etat === 'annulee' ? (
          <View accessible style={styles.ligne}>
            <Picto nom="alerte" couleur={p.danger} />
            <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>
              <Text style={{ fontFamily: police.texte600, color: p.danger }}>{etat === 'refusee' ? 'Refusé.' : 'Annulé.'}</Text> {carte.motif ?? 'Ces informations ne sont pas valides.'}
            </Text>
          </View>
        ) : null}

        {erreur ? (
          <View accessibilityRole="alert" style={styles.ligne}>
            <Picto nom="alerte" couleur={p.danger} />
            <Text style={[typo.petit, { color: p.texte, flex: 1 }]}>{erreur}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: StyleSheet.hairlineWidth, borderRadius: rayon.carte, overflow: 'hidden' },
  bandeau: { height: 4 },
  corps: { padding: espace.e3, gap: espace.e1 },
  etat: { borderTopWidth: StyleSheet.hairlineWidth, padding: espace.e3, gap: espace.e2 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace.e2 },
});
