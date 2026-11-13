// Les règles du mot de passe à la création d'un compte (affichées en direct pendant la saisie).
// Elles sont vérifiées ici (côté app) ; Supabase applique aussi sa propre longueur minimale.

export const LONGUEUR_MIN = 8;

export interface RegleMotDePasse {
  id: 'longueur' | 'lettre-chiffre' | 'different-email';
  texte: string;
  ok: boolean;
}

export interface EvaluationMotDePasse {
  regles: RegleMotDePasse[];
  /** Toutes les règles sont respectées : on peut créer le compte */
  valide: boolean;
  /** Jauge de 0 à 4 segments : 0 = vide, 4 = solide */
  force: 0 | 1 | 2 | 3 | 4;
}

/** Ce qui précède le @ d'une adresse, en minuscules (« Yanis.Jaber@x.fr » → « yanis.jaber ») */
function debutAdresse(email: string): string {
  return String(email || '').trim().toLowerCase().split('@')[0] ?? '';
}

export function evaluerMotDePasse(motDePasse: string, email = ''): EvaluationMotDePasse {
  const mdp = String(motDePasse || '');
  const adresse = String(email || '').trim().toLowerCase();
  const debut = debutAdresse(email);
  const bas = mdp.toLowerCase();

  const longueur = mdp.length >= LONGUEUR_MIN;
  const lettreChiffre = /\p{L}/u.test(mdp) && /\d/.test(mdp);
  // Différent de l'e-mail : ni l'adresse entière, ni sa partie avant le @ (quand elle est assez longue pour être significative)
  const differentEmail = mdp.length > 0 && bas !== adresse && !(debut.length >= 4 && bas === debut);

  const regles: RegleMotDePasse[] = [
    { id: 'longueur', texte: `${LONGUEUR_MIN} caractères ou plus`, ok: longueur },
    { id: 'lettre-chiffre', texte: 'Une lettre et un chiffre', ok: lettreChiffre },
    { id: 'different-email', texte: 'Différent de ton e-mail', ok: differentEmail },
  ];
  const valide = regles.every((r) => r.ok);

  let force: EvaluationMotDePasse['force'] = 0;
  if (mdp.length > 0) {
    const ok = regles.filter((r) => r.ok).length; // 0 à 3
    force = Math.max(1, ok) as 1 | 2 | 3;
    if (valide && mdp.length >= 12 && /[^\p{L}\d]/u.test(mdp)) force = 4; // long, avec un symbole
    if (!valide) force = Math.min(force, 2) as 1 | 2;
  }
  return { regles, valide, force };
}
