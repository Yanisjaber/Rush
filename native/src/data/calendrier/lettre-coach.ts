// Le texte du coach arrive avec ses chiffres importants entourés de doubles crochets : [[5'46"]]. L'écran les surligne.
/** Coupe un paragraphe en morceaux : le texte courant et les chiffres à surligner (sans leurs crochets). */
export function morceauxLettre(paragraphe: string): { texte: string; chiffre: boolean }[] {
  return paragraphe
    .split(/(\[\[[^\[\]]+\]\])/)
    .filter(Boolean)
    .map((m) => (m.startsWith('[[') && m.endsWith(']]') ? { texte: m.slice(2, -2), chiffre: true } : { texte: m, chiffre: false }));
}
