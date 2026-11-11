// ============================================================
// Profil du coureur (table coach_profil) : ce que l'historique de sorties ne dit pas.
//   - temps disponible (jours libres, durée max par jour), ancienneté, plus grosse semaine, blessures passées, préférences.
// Aucun texte libre : tout est une valeur d'une liste fermée ou un nombre borné (la base le vérifie aussi, voir coach_profil_ok).
// Ce module : lit une ligne de la base sans jamais planter, valide une modification (même règles que la base), et dit ce qui MANQUE
// pour que le coach le demande (plus on a de données, plus le plan est juste : docs/ia/FONDEMENTS_PLAN_COURSE.md).
// ============================================================

export const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
export type JourSemaine = (typeof JOURS_SEMAINE)[number];
export const ZONES_BLESSURE = ['genou', 'cheville', 'pied', 'tibia', 'mollet', 'ischio', 'quadriceps', 'hanche', 'dos', 'autre'] as const;
export const QUAND_BLESSURE = ['moins_3_mois', 'moins_1_an', 'plus_1_an'] as const;
export const MOMENTS = ['matin', 'midi', 'soir', 'variable'] as const;
export const FRACTIONNE = ['aime', 'neutre', 'evite'] as const;

export interface DispoJour { libre?: boolean; minutesMax?: number }
export interface Blessure { zone: (typeof ZONES_BLESSURE)[number]; quand: (typeof QUAND_BLESSURE)[number]; actif: boolean }
export interface ProfilCoureur {
  anneesPratique: number | null;
  picHebdoMinutes: number | null;
  disponibilites: Partial<Record<JourSemaine, DispoJour>>;
  blessures: Blessure[];
  /** La question des blessures a été posée : une liste vide veut alors dire « aucune » */
  blessuresRenseignees: boolean;
  moment: (typeof MOMENTS)[number] | null;
  fractionne: (typeof FRACTIONNE)[number] | null;
}

const VIDE: ProfilCoureur = { anneesPratique: null, picHebdoMinutes: null, disponibilites: {}, blessures: [], blessuresRenseignees: false, moment: null, fractionne: null };
const dans = <T extends string>(liste: readonly T[], v: unknown): v is T => typeof v === 'string' && (liste as readonly string[]).includes(v);
const entierBorne = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);
// deno-lint-ignore no-explicit-any
const objet = (v: any): Record<string, any> | null => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

/** Un profil lu dans la base (ligne de coach_profil). Tout champ absent ou bizarre tombe sur « inconnu » ; null = pas de profil. */
// deno-lint-ignore no-explicit-any
export function profilCoureurDepuisLigne(ligne: any): ProfilCoureur {
  if (!objet(ligne)) return { ...VIDE, disponibilites: {}, blessures: [] };
  const dispo: ProfilCoureur['disponibilites'] = {};
  const d = objet(ligne.disponibilites) ?? {};
  for (const jour of JOURS_SEMAINE) {
    const j = objet(d[jour]);
    if (!j) continue;
    const entree: DispoJour = {};
    if (typeof j.libre === 'boolean') entree.libre = j.libre;
    const m = entierBorne(j.minutes_max, 0, 600);
    if (m !== null) entree.minutesMax = m;
    if (Object.keys(entree).length) dispo[jour] = entree;
  }
  const blessures: Blessure[] = (Array.isArray(ligne.blessures) ? ligne.blessures : [])
    .slice(0, 10)
    // deno-lint-ignore no-explicit-any
    .filter((b: any) => objet(b) && dans(ZONES_BLESSURE, b.zone) && dans(QUAND_BLESSURE, b.quand))
    // deno-lint-ignore no-explicit-any
    .map((b: any) => ({ zone: b.zone, quand: b.quand, actif: b.actif === true }));
  const p = objet(ligne.preferences) ?? {};
  return {
    anneesPratique: entierBorne(ligne.annees_pratique, 0, 80),
    picHebdoMinutes: entierBorne(ligne.pic_hebdo_minutes, 0, 2000),
    disponibilites: dispo,
    blessures,
    blessuresRenseignees: ligne.blessures_renseignees === true,
    moment: dans(MOMENTS, p.moment) ? p.moment : null,
    fractionne: dans(FRACTIONNE, p.fractionne) ? p.fractionne : null,
  };
}

/** Ce qui manque pour un plan juste, du plus important au moins important (le coach pose une ou deux questions à la fois, dans cet ordre). */
export type Manque = 'disponibilites' | 'blessures' | 'anciennete' | 'pic_hebdo' | 'preferences';
export function cequiManque(p: ProfilCoureur): Manque[] {
  const m: Manque[] = [];
  if (!Object.values(p.disponibilites).some((j) => j.libre !== undefined || j.minutesMax !== undefined)) m.push('disponibilites');
  // « aucune blessure » est une réponse (blessures_renseignees) ; sans elle, une liste vide veut dire « pas demandé »
  if (!p.blessuresRenseignees && p.blessures.length === 0) m.push('blessures');
  if (p.anneesPratique === null) m.push('anciennete');
  if (p.picHebdoMinutes === null) m.push('pic_hebdo');
  if (p.moment === null && p.fractionne === null) m.push('preferences');
  return m;
}

/** Une modification demandée (par exemple par le coach, après validation du compte) : mêmes règles que la base. Renvoie les colonnes à écrire ou les erreurs. */
// deno-lint-ignore no-explicit-any
export function validerModification(entree: any): { ok: true; colonnes: Record<string, unknown> } | { ok: false; erreurs: string[] } {
  const o = objet(entree);
  if (!o) return { ok: false, erreurs: ['Modification vide.'] };
  const erreurs: string[] = [];
  const colonnes: Record<string, unknown> = {};
  const permises = ['annees_pratique', 'pic_hebdo_minutes', 'disponibilites', 'blessures', 'blessures_renseignees', 'preferences'];
  for (const k of Object.keys(o)) if (!permises.includes(k)) erreurs.push(`Champ inconnu : ${k}.`);
  if ('annees_pratique' in o) { const v = entierBorne(o.annees_pratique, 0, 80); if (v === null && o.annees_pratique !== null) erreurs.push('annees_pratique : un entier de 0 à 80.'); else colonnes.annees_pratique = v; }
  if ('pic_hebdo_minutes' in o) { const v = entierBorne(o.pic_hebdo_minutes, 0, 2000); if (v === null && o.pic_hebdo_minutes !== null) erreurs.push('pic_hebdo_minutes : un entier de 0 à 2000.'); else colonnes.pic_hebdo_minutes = v; }
  if ('disponibilites' in o) {
    const d = objet(o.disponibilites);
    const propre: Record<string, Record<string, unknown>> = {};
    if (!d) erreurs.push('disponibilites : un objet { jour: { libre, minutes_max } }.');
    else for (const [jour, v] of Object.entries(d)) {
      const j = objet(v);
      if (!dans(JOURS_SEMAINE, jour) || !j) { erreurs.push(`disponibilites : jour inconnu ou valeur invalide (${String(jour).slice(0, 20)}).`); continue; }
      const e: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(j)) {
        if (k === 'libre' && typeof x === 'boolean') e.libre = x;
        else if (k === 'minutes_max' && entierBorne(x, 0, 600) !== null) e.minutes_max = x;
        else erreurs.push(`disponibilites.${jour} : « ${k} » invalide (libre = vrai/faux, minutes_max = 0 à 600).`);
      }
      propre[jour] = e;
    }
    colonnes.disponibilites = propre;
  }
  if ('blessures' in o) {
    if (!Array.isArray(o.blessures) || o.blessures.length > 10) erreurs.push('blessures : une liste de 10 au plus.');
    else colonnes.blessures = o.blessures.map((b: unknown) => {
      const x = objet(b);
      if (!x || !dans(ZONES_BLESSURE, x.zone) || !dans(QUAND_BLESSURE, x.quand) || (x.actif !== undefined && typeof x.actif !== 'boolean')) { erreurs.push('blessures : zone et quand parmi les listes autorisées.'); return null; }
      return { zone: x.zone, quand: x.quand, actif: x.actif === true };
    });
  }
  if ('blessures_renseignees' in o) { if (typeof o.blessures_renseignees !== 'boolean') erreurs.push('blessures_renseignees : vrai ou faux.'); else colonnes.blessures_renseignees = o.blessures_renseignees; }
  if ('preferences' in o) {
    const p = objet(o.preferences);
    if (!p) erreurs.push('preferences : un objet { moment, fractionne }.');
    else {
      const e: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(p)) {
        if (k === 'moment' && dans(MOMENTS, x)) e.moment = x;
        else if (k === 'fractionne' && dans(FRACTIONNE, x)) e.fractionne = x;
        else erreurs.push(`preferences : « ${k} » invalide.`);
      }
      colonnes.preferences = e;
    }
  }
  if (!Object.keys(colonnes).length && !erreurs.length) erreurs.push('Rien à modifier.');
  return erreurs.length ? { ok: false, erreurs } : { ok: true, colonnes };
}

// ---------- Ce que voit le modèle, et la carte à valider ----------

const MAJ = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const heureMinutes = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`);
const QUAND_TEXTE: Record<(typeof QUAND_BLESSURE)[number], string> = { moins_3_mois: 'il y a moins de 3 mois', moins_1_an: "il y a moins d'un an", plus_1_an: "il y a plus d'un an" };
const MOMENT_TEXTE: Record<(typeof MOMENTS)[number], string> = { matin: 'le matin', midi: 'le midi', soir: 'le soir', variable: 'à des heures variables' };
const FRACTIONNE_TEXTE: Record<(typeof FRACTIONNE)[number], string> = { aime: 'tu aimes le fractionné', neutre: 'le fractionné te va', evite: 'tu évites le fractionné' };

/**
 * Les lignes lisibles d'une modification déjà validée (validerModification) : c'est ce que montre la carte à l'utilisateur.
 * Que du texte écrit ici, à partir de listes fermées et de nombres : rien de libre ne passe.
 */
export function lignesModification(colonnes: Record<string, unknown>): string[] {
  const l: string[] = [];
  if (typeof colonnes.annees_pratique === 'number') l.push(colonnes.annees_pratique === 0 ? 'Tu débutes (moins d\'un an de pratique)' : `Tu cours depuis ${colonnes.annees_pratique} an${colonnes.annees_pratique > 1 ? 's' : ''}`);
  if (typeof colonnes.pic_hebdo_minutes === 'number') l.push(`Ta plus grosse semaine : ${heureMinutes(colonnes.pic_hebdo_minutes)} de course`);
  const d = objet(colonnes.disponibilites);
  if (d) for (const jour of JOURS_SEMAINE) {
    const j = objet(d[jour]);
    if (!j) continue;
    const morceaux: string[] = [];
    if (j.libre === false) morceaux.push('pas disponible');
    else if (j.libre === true) morceaux.push('libre');
    if (typeof j.minutes_max === 'number') morceaux.push(`${heureMinutes(j.minutes_max)} au plus`);
    if (morceaux.length) l.push(`${MAJ(jour)} : ${morceaux.join(', ')}`);
  }
  if (Array.isArray(colonnes.blessures)) {
    if (colonnes.blessures.length === 0) l.push('Aucune blessure');
    // deno-lint-ignore no-explicit-any
    for (const b of colonnes.blessures as any[]) l.push(`Blessure : ${b.zone}, ${QUAND_TEXTE[b.quand as (typeof QUAND_BLESSURE)[number]]}${b.actif ? ' (encore là)' : ''}`);
  }
  const p = objet(colonnes.preferences);
  if (p) {
    if (dans(MOMENTS, p.moment)) l.push(`Tu préfères t'entraîner ${MOMENT_TEXTE[p.moment]}`);
    if (dans(FRACTIONNE, p.fractionne)) l.push(MAJ(FRACTIONNE_TEXTE[p.fractionne]));
  }
  return l;
}

/**
 * Le profil actuel + la modification validée → ce qu'on écrit en base.
 * Disponibilités : jour par jour (un jour redonné remplace l'ancien, les autres restent). Préférences : clé par clé. Le reste remplace.
 * Répondre à la question des blessures (même « aucune ») la marque comme posée.
 */
// deno-lint-ignore no-explicit-any
export function fusionnerProfil(ligne: any, colonnes: Record<string, unknown>): Record<string, unknown> {
  const actuel = objet(ligne) ?? {};
  const sortie: Record<string, unknown> = { ...colonnes };
  if (colonnes.disponibilites) sortie.disponibilites = { ...(objet(actuel.disponibilites) ?? {}), ...(colonnes.disponibilites as Record<string, unknown>) };
  if (colonnes.preferences) sortie.preferences = { ...(objet(actuel.preferences) ?? {}), ...(colonnes.preferences as Record<string, unknown>) };
  if (colonnes.blessures) sortie.blessures_renseignees = true;
  return sortie;
}

/** Le profil tel que le résumé le donne (bloc `profil`), mis en forme pour le modèle : ce qu'on sait, et ce qu'on peut encore demander. */
// deno-lint-ignore no-explicit-any
export function profilPourModele(bloc: any): { connu: Record<string, unknown>; ce_qui_manque: Manque[]; blessures_autorisees: boolean } {
  const accord = objet(bloc)?.blessures_accord === true;
  const p = profilCoureurDepuisLigne(bloc);
  const manque = cequiManque(p).filter((m) => accord || m !== 'blessures');
  const connu: Record<string, unknown> = {};
  if (p.anneesPratique !== null) connu.annees_pratique = p.anneesPratique;
  if (p.picHebdoMinutes !== null) connu.pic_hebdo_minutes = p.picHebdoMinutes;
  if (Object.keys(p.disponibilites).length) {
    connu.disponibilites = Object.fromEntries(Object.entries(p.disponibilites).map(([j, d]) => [j, { ...(d.libre !== undefined ? { libre: d.libre } : {}), ...(d.minutesMax !== undefined ? { minutes_max: d.minutesMax } : {}) }]));
  }
  if (accord && (p.blessuresRenseignees || p.blessures.length)) connu.blessures = p.blessures;
  if (p.moment) connu.moment = p.moment;
  if (p.fractionne) connu.fractionne = p.fractionne;
  return { connu, ce_qui_manque: manque, blessures_autorisees: accord };
}

// ---------- Ce que le profil change dans un plan ----------
/**
 * Ce que le profil que la personne a donné au coach change dans le plan (table coach_profil, voir profil-coureur.ts). Rien n'est inventé : chaque règle vient soit de la personne, soit de la fiche
 * course-blessures-progression (docs/ia/connaissances) : « avoir déjà été blessé » est un des facteurs les mieux liés à une nouvelle blessure (≈ ×7,6 chez des débutants), un programme improvisé
 * blesse plus qu'un programme structuré ; la fiche conseille alors de réduire la montée (fourchette 5-10 % par semaine → le bas), de garder plus de jours faciles, et de ne jamais courir à travers une douleur.
 *   - jour pas disponible → aucune séance ce jour-là ; durée max d'un jour → aucune séance plus longue ce jour-là ;
 *   - plus grosse semaine déjà faite → le volume d'une semaine ne dépasse pas le plus haut entre elle et sa plus grosse semaine récente ;
 *   - blessure encore là → AUCUNE séance d'intensité, pas de sortie test ; blessure des 12 derniers mois ou moins d'un an de pratique → prudence : une seule séance dure par semaine, montée de 5 % ;
 *   - elle évite le fractionné → une seule séance dure par semaine.
 * Le moment de la journée (matin, soir) n'a pas d'effet : le plan donne des jours, pas des heures.
 */
/**
 * Montée du volume d'une semaine à l'autre. La règle des « 10 % » est une CONVENTION contestée (Buist 2008 : aucune différence de blessures entre +10,5 % et +23,7 % ; Nielsen 2013 : le risque vient plutôt des sauts d'une seule sortie),
 * il n'y a pas de consensus. On reste dans la fourchette des plans réels analysés (92 plans de marathon de 12 semaines : montée de 5 à 9 % par semaine ; la fiche course-blessures-progression dit « environ 5 à 10 % ») :
 * le MILIEU de la fourchette (7 %) par défaut, le BAS (5 %) quand la personne est prudente (blessure récente, débutant). Ce sont des choix dans une fourchette, pas des résultats d'études.
 */
export const MONTEE_HEBDO = 1.07;
export const MONTEE_PRUDENTE = 1.05;

export interface ReglesProfil {
  joursInterdits: Set<string>;
  /** Elle évite le fractionné */
  evite: boolean;
  minutesMax: Record<string, number>;
  picHebdo: number | null;
  prudent: boolean;
  blessureActive: boolean;
  maxQualites: number;
  croissance: number;
  /** Ce que le plan a vraiment pris en compte, en phrases pour le bilan */
  utilise: string[];
}
export function reglesDuProfil(c: ProfilCoureur | null): ReglesProfil {
  const r: ReglesProfil = { joursInterdits: new Set(), evite: false, minutesMax: {}, picHebdo: null, prudent: false, blessureActive: false, maxQualites: 2, croissance: MONTEE_HEBDO, utilise: [] };
  if (!c) return r;
  for (const j of JOURS_SEMAINE) {
    const d = c.disponibilites[j];
    if (d?.libre === false) r.joursInterdits.add(j);
    else if (d?.minutesMax !== undefined) r.minutesMax[j] = d.minutesMax;
  }
  if (r.joursInterdits.size) r.utilise.push(`aucune séance ${[...r.joursInterdits].join(', ')}`);
  const limites = Object.entries(r.minutesMax);
  if (limites.length) r.utilise.push(`durée limitée ${limites.map(([j, m]) => `${j} ${m} min`).join(', ')}`);
  if (c.picHebdoMinutes !== null && c.picHebdoMinutes > 0) { r.picHebdo = c.picHebdoMinutes; r.utilise.push(`volume jamais au-dessus de ta plus grosse semaine (${c.picHebdoMinutes} min) ou de ta plus grosse semaine récente`); }
  r.blessureActive = c.blessures.some((b) => b.actif);
  const recente = c.blessures.some((b) => b.actif || b.quand !== 'plus_1_an');
  const debutant = c.anneesPratique === 0;
  r.prudent = recente || debutant;
  if (r.blessureActive) r.utilise.push('blessure encore là : aucune séance d\'intensité, pas de sortie test');
  else if (recente) r.utilise.push('blessure dans les 12 derniers mois : une seule séance dure par semaine, montée plus douce (5 % au lieu de 7 %)');
  else if (debutant) r.utilise.push('moins d\'un an de pratique : une seule séance dure par semaine, montée plus douce (5 % au lieu de 7 %)');
  if (c.fractionne === 'evite') { r.evite = true; r.maxQualites = 1; r.utilise.push('tu évites le fractionné : une seule séance dure par semaine'); }
  if (r.prudent) { r.maxQualites = 1; r.croissance = MONTEE_PRUDENTE; }
  return r;
}

