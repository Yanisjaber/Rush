import { Pressable, StyleSheet, Text, View } from 'react-native';
import { niveauDe } from '@/data/forme-sante';
import { rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ce qui tire l'état de forme vers le haut ou vers le bas : une barre par pilier qui part du MILIEU (« comme d'habitude », 50).
// Vers la droite et verte, le pilier est meilleur que d'habitude ; vers la gauche et rouge ou orange, il est moins bon. Sans phrase.
// Un pilier sans donnée a une piste vide et un tiret.
interface Ligne {
  cle: string;
  nom: string;
  indice: number | null;
  vers: string;
}

export function BarresEcarts({ lignes, onOuvrir }: { lignes: Ligne[]; onOuvrir: (vers: string) => void }) {
  const p = usePalette();
  return (
    <View style={{ gap: 4 }}>
      {lignes.map((l) => {
        const niveau = niveauDe(l.indice);
        const couleur = niveau === 'bon' ? p.ok : niveau === 'moyen' ? p.alerte : niveau === 'faible' ? p.danger : p.traitFort;
        const ecart = l.indice != null ? (l.indice - 50) / 50 : 0; // de -1 à 1
        const part = Math.min(1, Math.abs(ecart)) * 50; // en % de la piste, depuis le milieu
        return (
          <Pressable
            key={l.cle}
            onPress={() => onOuvrir(l.vers)}
            accessibilityRole="button"
            accessibilityLabel={`${l.nom} : ${l.indice != null ? `${l.indice} sur 100, ${ecart >= 0 ? 'au-dessus' : 'en dessous'} de ta norme` : 'pas de donnée'}`}
            accessibilityHint="Ouvre le détail"
            style={styles.ligne}
          >
            <Text numberOfLines={1} style={[typo.petit, styles.nom, { color: p.texte }]}>
              {l.nom}
            </Text>
            <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
              {l.indice != null ? <View style={[styles.barre, { backgroundColor: couleur, width: `${part}%`, left: ecart >= 0 ? '50%' : `${50 - part}%` }]} /> : null}
              <View style={[styles.milieu, { backgroundColor: p.texteMuet }]} />
            </View>
            <Text style={[styles.valeur, { color: l.indice != null ? p.texte : p.texteMuet }]}>{l.indice ?? '—'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  nom: { width: 112 },
  piste: { flex: 1, height: 16, borderRadius: rayon.rond, overflow: 'hidden' },
  barre: { position: 'absolute', top: 0, bottom: 0 },
  milieu: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, marginLeft: -1 },
  valeur: { width: 30, textAlign: 'right', fontFamily: police.titre700, fontSize: 16, lineHeight: 20, fontVariant: ['tabular-nums'] },
});
