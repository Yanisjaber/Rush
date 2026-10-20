import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { espace, rayon } from '@/theme/couleurs';
import { couleurSport } from '@/theme/sports';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Le dossard : la signature visuelle de l'app (IDENTITE.md §3).
// Un bloc clair avec un liseré de sport en haut, quatre points d'attache, un grand nombre
// (J-63, PUSH…) et le contexte. Tout est du texte brut : React Native n'interprète aucun HTML.
// taille : 'l' (grand, avec place pour le chiffre) ou 'm' (bandeau bas comme celui de Muscu : le texte à gauche, le chiffre à droite).
// compact : état vide (« aucun objectif »), juste le titre et le détail.
// Règle d'usage : un dossard par widget au maximum, jamais de dossard dans un dossard.
interface Props {
  etiquette?: string;
  nom?: string;
  valeur?: string;
  detail?: string;
  /** Clé de sport (course, velo…) : donne la couleur du liseré. Sans sport : gris neutre. */
  sport?: string;
  taille?: 'l' | 'm';
  compact?: boolean;
  children?: ReactNode;
}

const LISERE = 4;
const TAILLE_MAX = { l: 112, m: 44 } as const;
const TAILLE_MIN = 28;

export function Dossard({ etiquette, nom, valeur, detail, sport, taille = 'l', compact = false, children }: Props) {
  const p = usePalette();
  const max = TAILLE_MAX[taille];
  const attache = { backgroundColor: p.dossardTexte };

  // VoiceOver lit le dossard comme un seul bloc, dans l'ordre logique.
  const libelle = [etiquette, nom, valeur, detail].filter(Boolean).join('. ');

  // Bandeau (taille m) : une rangée basse, texte à gauche, grand chiffre à droite
  if (taille === 'm' && !compact) {
    return (
      <View accessible accessibilityLabel={libelle || 'Objectif'} style={[styles.bandeau, { backgroundColor: p.dossardFond }]}>
        <View style={[styles.lisere, { backgroundColor: couleurSport(p, sport) }]} />
        <View style={[styles.attache, styles.petiteAttache, styles.hautGauche, attache]} />
        <View style={[styles.attache, styles.petiteAttache, styles.hautDroite, attache]} />
        <View style={styles.bandeauTexte}>
          {etiquette ? <Text style={[typo.micro, { color: p.dossardTexte }]}>{etiquette}</Text> : null}
          {nom ? (
            <Text numberOfLines={1} style={[typo.titre3, styles.nom, { color: p.dossardTexte }]}>
              {nom}
            </Text>
          ) : null}
          {detail ? (
            <Text numberOfLines={2} style={[typo.petit, styles.detail, { color: p.dossardTexte }]}>
              {detail}
            </Text>
          ) : null}
          {children}
        </View>
        {valeur ? (
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.3} style={[styles.valeurBandeau, { color: p.dossardTexte }]}>
            {valeur}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={libelle || 'Objectif'}
      style={[
        styles.dossard,
        taille === 'l' && !compact && styles.grand,
        compact && styles.compact,
        { backgroundColor: p.dossardFond },
      ]}
    >
      <View style={[styles.lisere, { backgroundColor: couleurSport(p, sport) }]} />

      <View style={[styles.attache, styles.hautGauche, attache]} />
      <View style={[styles.attache, styles.hautDroite, attache]} />
      {!compact && taille === 'l' && (
        <>
          <View style={[styles.attache, styles.basGauche, attache]} />
          <View style={[styles.attache, styles.basDroite, attache]} />
        </>
      )}

      <View style={styles.entete}>
        {etiquette ? <Text style={[typo.micro, { color: p.dossardTexte }]}>{etiquette}</Text> : null}
        {nom ? (
          <Text style={[taille === 'l' ? typo.titre2 : typo.titre3, styles.nom, { color: p.dossardTexte }]}>{nom}</Text>
        ) : null}
      </View>

      {valeur && !compact ? (
        // Le chiffre se réduit tout seul pour tenir sur une ligne (comme ajusterTexte.js sur le web),
        // jamais au-dessus de la taille max. Plafond de 1,3× si le texte du téléphone est agrandi.
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={TAILLE_MIN / max}
          maxFontSizeMultiplier={1.3}
          // letterSpacing fixe (ne suit pas la réduction du texte) : volontairement léger
          style={[
            styles.valeur,
            { fontSize: max, lineHeight: Math.round(max * 0.95), letterSpacing: -1, color: p.dossardTexte },
          ]}
        >
          {valeur}
        </Text>
      ) : null}

      <View style={styles.pied}>
        {detail ? <Text style={[typo.petit, styles.detail, { color: p.dossardTexte }]}>{detail}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dossard: {
    overflow: 'hidden', // le liseré épouse les coins arrondis
    borderRadius: rayon.base,
    paddingHorizontal: 24,
    paddingTop: 30 + LISERE, // de l'air autour des points d'attache du haut
    paddingBottom: 22,
    gap: espace.e3,
    justifyContent: 'space-between',
  },
  grand: { minHeight: 300 },
  bandeau: { overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: rayon.base, paddingLeft: 26, paddingRight: 22, paddingTop: 22 + LISERE, paddingBottom: 18 },
  bandeauTexte: { flex: 1, minWidth: 0, gap: 4 },
  valeurBandeau: { fontFamily: police.titre800, fontSize: 44, lineHeight: 46, letterSpacing: -1, maxWidth: '40%' },
  petiteAttache: { width: 7, height: 7, borderRadius: 3.5 },
  // 28 pt à gauche et à droite : le texte démarre après les points d'attache (ils finissent à 21 pt)
  compact: { paddingHorizontal: 28, paddingTop: 20 + LISERE, paddingBottom: 18, justifyContent: 'flex-start', gap: 14 },
  lisere: { position: 'absolute', top: 0, left: 0, right: 0, height: LISERE },
  attache: { position: 'absolute', width: 9, height: 9, borderRadius: 4.5 },
  hautGauche: { left: 12, top: 12 + LISERE },
  hautDroite: { right: 12, top: 12 + LISERE },
  basGauche: { left: 12, bottom: 12 },
  basDroite: { right: 12, bottom: 12 },
  entete: { gap: 6 },
  nom: { letterSpacing: 0 },
  valeur: { fontFamily: police.titre800 },
  pied: { gap: espace.e2 },
  detail: { fontFamily: police.texte500 },
});
