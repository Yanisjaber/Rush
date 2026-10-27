import type { TextStyle } from 'react-native';

// Noms des polices chargées (voir app/_layout.tsx). Un nom = un fichier = une graisse :
// en natif on ne choisit pas fontWeight, on choisit directement la bonne police.
export const police = {
  titre600: 'BricolageGrotesque_600SemiBold',
  titre700: 'BricolageGrotesque_700Bold',
  titre800: 'BricolageGrotesque_800ExtraBold',
  texte400: 'InstrumentSans_400Regular',
  texte500: 'InstrumentSans_500Medium',
  texte600: 'InstrumentSans_600SemiBold',
} as const;

// Échelle typographique de docs/native/IDENTITE.md §5 (taille / interligne en pt).
// Minimum absolu : 12 pt. Les chiffres de données sont tabulaires pour que les colonnes s'alignent.
export const typo = {
  display: { fontFamily: police.titre800, fontSize: 56, lineHeight: 56, fontVariant: ['tabular-nums'] },
  titre1: { fontFamily: police.titre700, fontSize: 32, lineHeight: 36 },
  titre2: { fontFamily: police.titre700, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  titre3: { fontFamily: police.titre600, fontSize: 18, lineHeight: 22 },
  corps: { fontFamily: police.texte400, fontSize: 16, lineHeight: 24 },
  corpsFort: { fontFamily: police.texte600, fontSize: 16, lineHeight: 24 },
  petit: { fontFamily: police.texte400, fontSize: 14, lineHeight: 20 },
  // +0,08 em d'espacement sur 12 pt = 0,96 pt
  micro: {
    fontFamily: police.texte600,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type NomTypo = keyof typeof typo;
