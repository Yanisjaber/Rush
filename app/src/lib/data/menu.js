// Le menu de l'app : quelles pages afficher selon les sports de l'utilisateur. Fonctions pures, sans réseau.
// Règle : les pages universelles sont toujours là ; Muscu et Hyrox n'apparaissent que si on pratique ce sport.

export const PAGES = {
  accueil: { nom: 'Accueil', href: '#/' },
  calendrier: { nom: 'Calendrier', href: '#/calendrier' },
  plan: { nom: 'Plan', href: '#/plan' },
  force: { nom: 'Muscu', href: '#/force' },
  hyrox: { nom: 'Hyrox', href: '#/hyrox' },
  competitions: { nom: 'Compétitions', href: '#/competitions' },
  bilan: { nom: 'Bilan', href: '#/bilan' },
  sommeil: { nom: 'Sommeil', href: '#/sommeil' },
  parametres: { nom: 'Paramètres', href: '#/parametres' },
};

/** Les pages propres à un sport : famille de sport → clé de page. */
const PAGE_DU_SPORT = { muscu: 'force', hyrox: 'hyrox' };

export const page = (cle) => ({ cle, ...PAGES[cle] });

/** Pages dédiées aux sports pratiqués (Muscu, Hyrox), dans l'ordre du menu. */
export function pagesDeSports(familles = []) {
  return Object.keys(PAGE_DU_SPORT).filter((f) => (familles || []).includes(f)).map((f) => page(PAGE_DU_SPORT[f]));
}

/** Menu de l'ordinateur : une seule ligne, tout visible. */
export function pagesMenu(familles = []) {
  return [page('accueil'), page('calendrier'), page('plan'), ...pagesDeSports(familles), page('competitions'), page('bilan'), page('sommeil')];
}

/** Menu « Plus » de l'ordinateur : Compétitions, Bilan, Sommeil (Muscu et Hyrox sont des sports : ils ont leur pastille). */
export function pagesPlus() {
  return [page('competitions'), page('bilan'), page('sommeil')];
}

/** Famille de sport → page dédiée (muscu → Muscu, hyrox → Hyrox), sinon null : la pastille filtre alors l'accueil. */
export function pageDuSport(famille) {
  return PAGE_DU_SPORT[famille] ? page(PAGE_DU_SPORT[famille]) : null;
}

/**
 * Barre du bas du téléphone : Accueil, Calendrier, Plan, puis les sports (une page directe s'il n'y en a qu'une,
 * un bouton « Sports » qui ouvre la liste s'il y en a deux), puis « Plus » (le reste, réglages compris).
 * Renvoie { items, sports, plus } : `items` pour la barre ; `sports` et `plus` pour les deux feuilles qui s'ouvrent.
 */
export function barreBas(familles = []) {
  const sports = pagesDeSports(familles);
  const items = [page('accueil'), page('calendrier'), page('plan')];
  if (sports.length === 1) items.push(sports[0]);
  else if (sports.length > 1) items.push({ cle: 'sports', nom: 'Sports', ouvre: 'sports' });
  items.push({ cle: 'plus', nom: 'Plus', ouvre: 'plus' });
  return { items, sports, plus: [page('competitions'), page('bilan'), page('sommeil'), page('parametres')] };
}

/** Quelle page correspond à l'adresse courante (pour surligner le bon bouton) ? null si aucune. */
export function cleDePage(chemin) {
  const c = String(chemin || '/');
  if (c === '/' || c === '') return 'accueil';
  const premier = c.split('/')[1];
  if (['calendrier', 'plan', 'force', 'hyrox', 'competitions', 'bilan', 'sommeil', 'parametres'].includes(premier)) return premier;
  return null;
}

/** La page courante est-elle l'une de celles qu'on cache derrière « Sports » ou « Plus » ? Sert à surligner ces boutons. */
export function ouvertureActive(cle, familles = []) {
  const b = barreBas(familles);
  if (!cle) return null;
  if (b.sports.length > 1 && b.sports.some((p) => p.cle === cle)) return 'sports';
  if (b.plus.some((p) => p.cle === cle)) return 'plus';
  return null;
}
