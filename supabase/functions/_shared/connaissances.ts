// ============================================================
// La recherche dans la base de connaissances du coach (docs/ia/connaissances/, docs/ia/PLAN_COACH_COMPLET.md).
//
// Le modèle pose une question en français, on lui rend les deux ou trois fiches les plus proches. Recherche par mots-clés,
// sans modèle ni réseau : gratuite, prévisible, testable. Le texte des fiches est écrit par nous (pas de texte externe) ;
// la question du modèle ne sert qu'à noter les fiches, elle n'est jamais renvoyée telle quelle.
//
// Règle d'honnêteté : si aucune fiche ne correspond vraiment, on le dit au modèle (il ne doit pas inventer une source).
// ============================================================
import { FICHES } from './connaissances-data.ts';

export type Preuve = 'etabli' | 'probable' | 'debattu' | 'pratique';

export interface Fiche {
  id: string;
  /** Dossier de sport où la fiche est rangée (commun = tous les sports) */
  dossier: string;
  /** Partie de l'entraînement (endurance, intensite, force, planification…) */
  theme: string;
  titre: string;
  sports: string[];
  motsCles: string[];
  preuve: Preuve;
  maj: string;
  essentiel: string;
  recherche: string;
  regles: string;
  pieges: string;
  sources: { titre: string; url: string }[];
  voirAussi: string[];
}

export const SPORTS_CONNAISSANCE = ['course', 'velo', 'natation', 'triathlon', 'muscu', 'hyrox'] as const;
const MAX_RESULTATS = 3;
/** Une fiche n'est gardée que si son score atteint cette part de celui de la meilleure */
const PART_MINI = 0.4;
/** ln(1 + 25/3) : un mot présent dans les étiquettes de 3 fiches au plus (sur environ 25) */
const SEUIL_SPECIFIQUE = 2.2;

const MOTS_VIDES = new Set(
  ('le la les un une des du de au aux et ou mais donc que qui quoi est sont suis ai as a avons avez ont es etre avoir fait faire ' +
    'je tu il elle on nous vous ils elles me te se mon ma mes ton ta tes son sa ses notre votre leur leurs ce cet cette ces ' +
    'pour par sur sous dans avec sans chez entre vers plus moins tres trop assez pas ne ni non oui si comment quand combien ' +
    'quel quelle quels quelles pourquoi peux peut puis dois doit faut dit veux veut vais va vas ca cela ici la y en ' +
    'matin soir jour jours fois bien mal tout tous toute toutes aussi deja encore alors quoi apres avant depuis pendant ' +
    'bonjour salut merci coach ' +
    // Mots présents dans presque toutes les fiches : ils ne disent rien du sujet
    'semaine semaines entrainement entrainements entrainer sport sportif ' +
    // « temps » (la météo, la durée, un chrono) est dans les étiquettes de plusieurs fiches de course et ne désigne aucun sujet
    'temps').split(' '),
);

/** Minuscules, sans accents, sans ponctuation */
export function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Racine grossière : les 5 premières lettres (« affûtage » et « affûter » se rejoignent), les nombres et sigles courts restent entiers */
function racine(mot: string): string {
  return mot.length <= 5 ? mot : mot.slice(0, 5);
}

function racines(texte: string): string[] {
  return normaliser(texte)
    .split(' ')
    // Les mots d'une seule lettre sont écartés, mais pas les chiffres (« zone 2 », « 10 % »)
    .filter((m) => (m.length >= 2 || /^\d$/.test(m)) && !MOTS_VIDES.has(m))
    .map(racine);
}

interface Indexee {
  fiche: Fiche;
  motsCles: Set<string>;
  titre: Set<string>;
  id: Set<string>;
  corps: Map<string, number>; // essentiel, règles, pièges, recherche : occurrences
}

function construireIndex(fiches: Fiche[]): { index: Indexee[]; idf: Map<string, number>; idfFort: Map<string, number> } {
  const index: Indexee[] = fiches.map((fiche) => {
    const motsCles = new Set(fiche.motsCles.flatMap(racines));
    const titre = new Set(racines(fiche.titre));
    const id = new Set(racines(fiche.id.replace(/-/g, ' ')));
    const corps = new Map<string, number>();
    for (const r of racines([fiche.essentiel, fiche.regles, fiche.pieges, fiche.recherche].join(' '))) corps.set(r, (corps.get(r) ?? 0) + 1);
    return { fiche, motsCles, titre, id, corps };
  });
  const df = new Map<string, number>();
  for (const e of index) for (const r of new Set([...e.motsCles, ...e.titre, ...e.id, ...e.corps.keys()])) df.set(r, (df.get(r) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [r, n] of df) idf.set(r, Math.log(1 + index.length / n));
  // Rareté d'un mot parmi les seuls titres, identifiants et mots-clés : un mot qui n'étiquette qu'une fiche (« affûtage ») pèse plus
  const dfFort = new Map<string, number>();
  for (const e of index) for (const r of new Set([...e.motsCles, ...e.titre, ...e.id])) dfFort.set(r, (dfFort.get(r) ?? 0) + 1);
  const idfFort = new Map<string, number>();
  for (const [r, n] of dfFort) idfFort.set(r, Math.log(1 + index.length / n));
  return { index, idf, idfFort };
}

const INDEX = construireIndex(FICHES);

export interface Scoree {
  fiche: Fiche;
  score: number;
}

/** Les fiches les plus proches de la question, de la meilleure à la moins bonne. Liste vide si rien ne colle vraiment. */
export function classer(question: string, sport?: string, fiches?: Fiche[]): Scoree[] {
  const { index, idf, idfFort } = fiches ? construireIndex(fiches) : INDEX;
  const mots = [...new Set(racines(question))];
  // Un âge (« j'ai 52 ans ») ne figure dans aucune fiche : à partir de 35 ans, on cherche du côté des sportifs vétérans
  if (/\b(3[5-9]|[4-9]\d)\s*ans\b/.test(normaliser(question))) mots.push(racine('veteran'));
  if (!mots.length) return [];
  const scores: Scoree[] = [];
  for (const e of index) {
    let score = 0;
    let fort = false;
    let specifique = false;
    let nbForts = 0;
    for (const m of mots) {
      const poids = idf.get(m) ?? 1;
      // Un mot présent dans l'identifiant, le titre ET les mots-clés désigne presque sûrement le sujet de la fiche
      const forts = (e.motsCles.has(m) ? 5 : 0) + (e.titre.has(m) ? 4 : 0) + (e.id.has(m) ? 4 : 0);
      if (forts > 0) {
        score += forts * (idfFort.get(m) ?? poids);
        fort = true;
        nbForts++;
        // Un mot qui n'étiquette que 1 à 3 fiches sur ~25 (« affûtage », « HRV ») désigne un sujet ; « course » ou « repos » non
        if ((idfFort.get(m) ?? 0) >= SEUIL_SPECIFIQUE) specifique = true;
      }
      const n = e.corps.get(m) ?? 0;
      if (n > 0) score += Math.min(n, 3) * 0.5 * poids;
    }
    // Sans aucun mot du titre, de l'identifiant ou des mots-clés, un simple mot courant du texte ne suffit pas
    if (!fort || !(specifique || nbForts >= 2)) continue;
    if (sport) score *= e.fiche.sports.includes(sport) ? 1.25 : 0.6;
    scores.push({ fiche: e.fiche, score });
  }
  scores.sort((a, b) => b.score - a.score || a.fiche.id.localeCompare(b.fiche.id));
  if (!scores.length) return [];
  return scores.filter((s) => s.score >= scores[0].score * PART_MINI).slice(0, MAX_RESULTATS);
}

/** Mots de la question (formes d'origine, lettres seulement) qui ne figurent nulle part dans la fiche : le modèle sait ce que la fiche ne couvre pas */
export function motsNonTrouves(question: string, ficheId: string): string[] {
  const e = INDEX.index.find((x) => x.fiche.id === ficheId);
  if (!e) return [];
  const sortie: string[] = [];
  for (const mot of normaliser(question).split(' ')) {
    if (mot.length < 4 || MOTS_VIDES.has(mot) || !/^[a-z]+$/.test(mot) || mot.length > 20) continue;
    const r = racine(mot);
    if (e.motsCles.has(r) || e.titre.has(r) || e.id.has(r) || e.corps.has(r)) continue;
    if (!sortie.includes(mot)) sortie.push(mot);
  }
  return sortie.slice(0, 6);
}

/** Une fiche en texte court pour le contexte du modèle : l'essentiel et les règles, tronqués, avec son niveau de preuve */
function resumeFiche(f: Fiche, max: number): string {
  const corps = `${f.essentiel}\nRègles : ${f.regles}`;
  return `[${f.titre} | preuve : ${f.preuve}]\n${corps.length > max ? `${corps.slice(0, max)}…` : corps}`;
}

/**
 * Les fiches à glisser AUTOMATIQUEMENT dans le contexte du modèle pour un message : le coach n'a pas à penser à les chercher.
 * On classe la question (avec le message précédent de l'utilisateur pour les relances comme « et le test ? ») ; si rien ne ressort mais que
 * le message parle de plan, de séance ou de course, la fiche des principes généraux de la course à pied sert de repli.
 * Texte écrit par nous, jamais celui de l'utilisateur. Chaîne vide s'il n'y a rien de pertinent.
 */
export function extraitsConnaissance(question: string, precedent?: string, max = 2, caracteresParFiche = 1200, coureur = false): string {
  const trouvees = classer(question).slice(0, max).map((s) => s.fiche);
  // Un coureur (course à venir ou sorties récentes) qui demande un plan ou parle de son objectif : on part TOUJOURS des principes généraux de la course à pied
  if (coureur && /\b(plan|programme|objectif|preparer|prepare)\b/.test(normaliser(question))) {
    const base = FICHES.find((f) => f.id === 'course-principes-generaux');
    if (base) {
      const deja = trouvees.findIndex((f) => f.id === base.id);
      if (deja >= 0) trouvees.splice(deja, 1);
      trouvees.unshift(base);
    }
    trouvees.splice(max);
  }
  if (!trouvees.length && precedent) trouvees.push(...classer(`${precedent} ${question}`).slice(0, max).map((s) => s.fiche));
  if (!trouvees.length && /\b(plan|seance|seances|objectif|course|courir|cours|allure|footing)\b/.test(normaliser(question))) {
    const base = FICHES.find((f) => f.id === 'course-principes-generaux');
    if (base) trouvees.push(base);
  }
  return trouvees.map((f) => resumeFiche(f, caracteresParFiche)).join('\n\n');
}

/** Les fondements d'un plan de course : la fiche de sa distance et celle de son calibrage, pour que le coach explique le POURQUOI avec les mêmes sources */
export function fondementsPlanCourse(km: number, avecTest: boolean, caracteresParFiche = 900): string {
  const idDistance = km <= 12 ? 'course-5k-10k-plans' : km <= 23 ? 'course-semi-marathon' : km <= 45 ? 'course-marathon-methodes' : 'course-trail-ultra';
  const ids = [idDistance, avecTest ? 'course-tests-terrain' : 'course-periodisation-recuperation'];
  return ids.map((id) => FICHES.find((f) => f.id === id)).filter((f): f is Fiche => !!f).map((f) => resumeFiche(f, caracteresParFiche)).join('\n\n');
}

const LIBELLE_PREUVE: Record<Preuve, string> = {
  etabli: 'établi (consensus ou méta-analyses concordantes)',
  probable: 'probable (indices cohérents mais limités)',
  debattu: 'débattu (les sources se contredisent ou la preuve directe manque)',
  pratique: 'pratique de terrain (pas d\'essai contrôlé trouvé)',
};

/** Ce qu'on rend au modèle : la meilleure fiche en détail, les suivantes en résumé. */
export function chercherConnaissance(question: string, sport?: string): unknown {
  const trouvees = classer(question, sport);
  if (!trouvees.length) {
    return {
      resultats: [],
      note: "Aucune fiche de la base ne correspond à cette question. Réponds avec prudence, dis que tu n'as pas de source précise, et n'invente ni étude ni chiffre.",
    };
  }
  return {
    resultats: trouvees.map(({ fiche }, i) => ({
      id: fiche.id,
      titre: fiche.titre,
      niveau_de_preuve: LIBELLE_PREUVE[fiche.preuve],
      essentiel: fiche.essentiel,
      regles_pour_le_coach: fiche.regles,
      pieges: fiche.pieges,
      // La partie « recherche » est longue : seulement pour la meilleure fiche
      ...(i === 0 ? { ce_que_dit_la_recherche: fiche.recherche } : {}),
      sources: fiche.sources.slice(0, 3).map((s) => s.titre),
      voir_aussi: fiche.voirAussi,
      // Seulement pour la meilleure fiche : ce que la question demandait et que cette fiche ne contient pas
      ...(i === 0 ? { mots_de_la_question_absents_de_la_fiche: motsNonTrouves(question, fiche.id) } : {}),
    })),
    consigne: "Appuie-toi sur ces fiches, respecte leur niveau de preuve (ne présente pas un point débattu comme un fait) et cite l'idée, pas des chiffres que les fiches ne donnent pas. Si des mots importants de la question sont absents de la fiche, dis que ta base ne couvre pas ce point précis plutôt que de l'inventer.",
  };
}
