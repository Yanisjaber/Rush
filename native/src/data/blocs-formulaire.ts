// Le formulaire d'un bloc de séance (échauffement, intervalles…) et sa conversion en bloc valide. Fonctions pures, sans écran ni réseau.
// Les durées s'écrivent librement (« 4 », « 30s », « 1h »), l'intensité se choisit par zone ou en pourcentage libre ; tout est vérifié avant d'entrer dans la séance.
import { lireDuree, MAX_BLOCS, METRIQUES, TYPES_BLOC, ZONES, type Bloc, type Metrique, type Segment, type TypeBloc } from './structure.ts';

/** Une intensité : une zone (indice, 0 = Z1) ou un pourcentage libre (« perso »), avec une borne haute facultative. */
export interface FormulaireSegment {
  duree: string;
  zone: number | 'perso';
  int: string;
  intHi: string;
}

export interface FormulaireBloc {
  type: TypeBloc;
  nom: string;
  reps: string;
  metric: Metrique;
  travail: FormulaireSegment;
  recup: FormulaireSegment;
}

const zoneSegment = (duree: string, zone: number): FormulaireSegment => ({ duree, zone, int: '', intHi: '' });

/** Les valeurs de départ d'un nouveau bloc selon son type (un échauffement doux, des intervalles au seuil…). */
export function formulaireBlocVide(type: TypeBloc, metric: Metrique): FormulaireBloc {
  const base = { type, nom: '', reps: '4', metric };
  const z4 = metric === 'hr' ? 3 : 3;
  switch (type) {
    case 'warmup':
      return { ...base, travail: zoneSegment('10', 0), recup: zoneSegment('2', 0) };
    case 'interval':
      return { ...base, reps: '5', travail: zoneSegment('4', z4), recup: zoneSegment('2', 0) };
    case 'recovery':
      return { ...base, travail: zoneSegment('5', 0), recup: zoneSegment('2', 0) };
    case 'cooldown':
      return { ...base, travail: zoneSegment('10', 0), recup: zoneSegment('2', 0) };
    default:
      return { ...base, travail: zoneSegment('20', 1), recup: zoneSegment('2', 0) };
  }
}

const textePct = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');

/** Un segment de bloc → son formulaire (zone reconnue d'après ses bornes, sinon pourcentage libre). */
function formulaireSegment(seg: Segment, metric: Metrique, unit: 'zone' | 'pct'): FormulaireSegment {
  const z = ZONES[metric];
  const i = unit === 'zone' ? z.bas.findIndex((b, k) => b === seg.int && z.haut[k] === seg.intHi) : -1;
  const duree = String(Math.round(seg.min * 100) / 100).replace('.', ',');
  if (i >= 0) return { duree, zone: i, int: '', intHi: '' };
  return { duree, zone: 'perso', int: textePct(seg.int), intHi: seg.intHi != null ? textePct(seg.intHi) : '' };
}

/** Un bloc existant → son formulaire (pour le modifier). */
export function formulaireDepuisBloc(b: Bloc): FormulaireBloc {
  return {
    type: b.type,
    nom: b.name === undefined ? '' : b.name,
    reps: String(b.reps),
    metric: b.metric,
    travail: formulaireSegment(b.work, b.metric, b.unit),
    recup: b.rec ? formulaireSegment(b.rec, b.metric, b.unit) : zoneSegment('2', 0),
  };
}

export type ResultatBloc = { ok: true; bloc: Bloc } | { ok: false; erreur: string };

const nombre = (t: string): number => Number(String(t ?? '').trim().replace(',', '.'));

function segmentDepuis(f: FormulaireSegment, metric: Metrique, intitule: string): { ok: true; seg: Segment } | { ok: false; erreur: string } {
  const min = lireDuree(f.duree);
  if (min == null || min < 0.1 || min > 600) return { ok: false, erreur: `${intitule} : la durée doit être entre 6 secondes et 10 heures (par exemple 4, 30s ou 1h).` };
  if (f.zone !== 'perso') {
    const z = ZONES[metric];
    if (!Number.isInteger(f.zone) || f.zone < 0 || f.zone >= z.bas.length) return { ok: false, erreur: `${intitule} : choisis une zone.` };
    return { ok: true, seg: { min, int: z.bas[f.zone], intHi: z.haut[f.zone] } };
  }
  const int = nombre(f.int);
  if (!Number.isFinite(int) || int < 1 || int > 400) return { ok: false, erreur: `${intitule} : l'intensité doit être entre 1 et 400 %.` };
  if (String(f.intHi ?? '').trim() === '') return { ok: true, seg: { min, int, intHi: null } };
  const hi = nombre(f.intHi);
  if (!Number.isFinite(hi) || hi < 1 || hi > 400) return { ok: false, erreur: `${intitule} : la borne haute doit être entre 1 et 400 %.` };
  if (hi < int) return { ok: false, erreur: `${intitule} : la borne haute ne peut pas être plus basse que la borne basse.` };
  return { ok: true, seg: { min, int, intHi: hi } };
}

/** Vérifie le formulaire d'un bloc et en fait un bloc propre, ou donne la première erreur (en français). */
export function validerBloc(f: FormulaireBloc): ResultatBloc {
  if (!TYPES_BLOC.includes(f.type)) return { ok: false, erreur: 'Choisis un type de bloc.' };
  if (!METRIQUES.includes(f.metric)) return { ok: false, erreur: 'Choisis une mesure (watts, cardio ou allure).' };
  const nom = String(f.nom ?? '').trim().replace(/\s+/g, ' ');
  if (nom.length > 60) return { ok: false, erreur: 'Le nom est trop long (60 caractères au plus).' };
  const travail = segmentDepuis(f.travail, f.metric, f.type === 'interval' ? 'Effort' : 'Bloc');
  if (!travail.ok) return travail;
  const unit: Bloc['unit'] = f.travail.zone === 'perso' ? 'pct' : 'zone';
  const bloc: Bloc = { type: f.type, name: nom, reps: 1, metric: f.metric, unit, work: travail.seg };
  if (f.type === 'interval') {
    const reps = nombre(f.reps);
    if (!Number.isInteger(reps) || reps < 1 || reps > 99) return { ok: false, erreur: 'Le nombre de répétitions doit être entre 1 et 99.' };
    const recup = segmentDepuis(f.recup, f.metric, 'Récupération');
    if (!recup.ok) return recup;
    bloc.reps = reps;
    bloc.rec = recup.seg;
  }
  return { ok: true, bloc };
}

/** Peut-on encore ajouter un bloc ? (40 au plus, comme à la lecture) */
export const peutAjouterBloc = (nb: number): boolean => nb < MAX_BLOCS;

/** Déplace le bloc d'indice `i` d'un cran (-1 vers le haut, +1 vers le bas) ; la liste d'origine n'est pas modifiée. */
export function deplacerBloc<T>(liste: T[], i: number, sens: -1 | 1): T[] {
  const j = i + sens;
  if (i < 0 || i >= liste.length || j < 0 || j >= liste.length) return liste;
  const copie = [...liste];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

/** Le nom à afficher d'un bloc : le sien, sinon celui de son type. */
export const nomDuBloc = (b: Pick<Bloc, 'name' | 'type'>, nomsTypes: Record<TypeBloc, string>): string => (b.name && b.name.trim() ? b.name : nomsTypes[b.type]);
