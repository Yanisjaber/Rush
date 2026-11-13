// L'écran de lecture d'une séance prévue ou d'une compétition : les chiffres à montrer, dans l'ordre. Fonctions pures, sans écran ni réseau.
import { allureMoyenne, texteTempsCible } from './competition.ts';
import { formatKm, formatNombre } from '../outils/format.ts';
import { texteDuree, type EstimationBlocs, type Reference, type ResumeStructure } from './structure.ts';
import type { PrevueComplete } from '../types.ts';

export interface ChiffrePrevue {
  cle: string;
  libelle: string;
  valeur: string;
  unite?: string;
}

const positif = (v: unknown): number | null => {
  const n = Number(v);
  return v != null && Number.isFinite(n) && n > 0 ? n : null;
};

/** La distance écrite avec son unité : en mètres pour la natation, en kilomètres sinon (une décimale, aucune au-delà de 100 km). */
/** Sépare l'unité collée à une valeur (« 5'49"/km », « 28,5 km/h », « 1'45"/100 m ») : elle va sur la ligne du dessous, comme « km » ou « pts ». */
function separerUnite(texte: string | undefined): { valeur?: string; unite?: string } {
  if (!texte) return {};
  const m = texte.match(/^(.*?)(?: (km\/h))$|^(.*?)(\/.+)$/);
  if (!m) return { valeur: texte };
  return m[2] ? { valeur: m[1], unite: m[2] } : { valeur: m[3], unite: m[4] };
}

function distance(km: number, sport: string): { valeur: string; unite: string } {
  return sport === 'Swim' ? { valeur: formatNombre(Math.round(km * 1000)), unite: 'm' } : { valeur: formatKm(km, km >= 100 ? 0 : 1), unite: 'km' };
}

/**
 * Complète une séance prévue avec ce que ses blocs permettent de calculer : avec une allure cible et une durée, il y a une distance ; avec des watts, une puissance et une énergie ; avec un cardio, un cardio moyen.
 * Seules les valeurs absentes sont remplies : ce que la séance a déjà d'enregistré ne change jamais. Sans blocs (résumé nul), la séance est rendue telle quelle.
 */
export function completerAvecStructure(p: PrevueComplete, r: ResumeStructure | null): PrevueComplete {
  if (!r || p.category === 'competition') return p;
  return {
    ...p,
    km: positif(p.km) ?? r.km ?? p.km,
    est_watts: positif(p.est_watts) ?? r.watts ?? p.est_watts,
    est_bpm: positif(p.est_bpm) ?? r.bpm ?? p.est_bpm,
    est_kj: positif(p.est_kj) ?? r.kj ?? p.est_kj,
    // Sans effort ressenti saisi, l'effort attendu se déduit de l'intensité des blocs (facteur d'intensité 0,8 → 6/10, 1,0 → 8/10)
    rpe: positif(p.rpe) ?? (r.facteurIntensite > 0 ? Math.min(10, Math.max(1, Math.round(r.facteurIntensite * 10 - 2))) : p.rpe),
    est_if: positif(p.est_if) ?? (r.facteurIntensite > 0 && r.watts != null ? r.facteurIntensite : p.est_if),
    tss: positif(p.tss) ?? (r.tss > 0 ? r.tss : p.tss),
  };
}

/**
 * Les chiffres d'une séance prévue (durée, charge, distance, dénivelé, effort, allure ou vitesse prévue, puissance, cardio et énergie estimées) ou d'une compétition
 * (temps cible, distance, dénivelé, allure ou vitesse cible, fédération, niveau, format, tours, charge, effort) : seuls ceux que la ligne renseigne.
 */
export function chiffresPrevue(p: PrevueComplete, estim: EstimationBlocs | null = null, ref: Reference = {}): ChiffrePrevue[] {
  const liste: ChiffrePrevue[] = [];
  const ajout = (cle: string, libelle: string, valeur: string | null | undefined, unite?: string) => {
    if (valeur) liste.push({ cle, libelle, valeur, unite });
  };
  const km = positif(p.km);
  const dplus = positif(p.d_plus);
  const rpe = positif(p.rpe);
  const tss = positif(p.tss);
  const d = km != null ? distance(km, p.sport) : null;

  if (p.category === 'competition') {
    const cible = positif(p.target);
    ajout('cible', 'Temps cible', cible != null ? texteTempsCible(cible) : null);
    ajout('distance', 'Distance', d?.valeur, d?.unite);
    ajout('dplus', 'Dénivelé +', dplus != null ? formatNombre(dplus) : null, 'm');
    const allure = allureMoyenne(p.sport, km, cible);
    const a = separerUnite(allure?.valeur);
    ajout('allure', allure ? allure.libelle.replace('moy.', 'cible') : '', a.valeur, a.unite);
    ajout('federation', 'Fédération', p.federation);
    ajout('niveau', 'Niveau', p.race_level);
    ajout('format', 'Format', p.tri_format);
    ajout('tours', 'Tours', positif(p.laps) != null ? String(p.laps) : null);
    ajout('charge', 'Charge estimée', tss != null ? formatNombre(tss) : null, 'pts');
    ajout('effort', 'Effort estimé', rpe != null ? String(rpe) : null, '/10');
    return liste;
  }

  const duree = positif(p.duration);
  const course = ['Run', 'TrailRun', 'Walk', 'Hike'].includes(p.sport);
  ajout('duree', 'Durée', duree != null ? texteDuree(duree) : null);
  ajout('distance', 'Distance', d?.valeur, d?.unite);
  ajout('dplus', 'Dénivelé +', dplus != null ? formatNombre(dplus) : null, 'm');
  ajout('charge', 'Charge', tss != null ? formatNombre(tss) : null, 'pts');
  ajout('effort', 'Effort estimé', rpe != null ? String(rpe) : null, '/10');
  const allure = allureMoyenne(p.sport, km, duree);
  const a = separerUnite(allure?.valeur);
  ajout('allure', allure ? allure.libelle.replace('moy.', 'prévue') : '', a.valeur, a.unite);
  ajout('watts', 'Puissance moy.', positif(p.est_watts) != null ? formatNombre(Math.round(Number(p.est_watts))) : null, 'W');
  ajout('wattsMax', 'Puissance max', estim?.wattsMax != null ? formatNombre(estim.wattsMax) : null, 'W');
  ajout('wattsNormalisee', 'Puissance norm.', estim?.wattsNormalisee != null ? formatNombre(estim.wattsNormalisee) : null, 'W');
  const facteur = positif(p.est_if);
  ajout('if', 'Intensité', facteur != null ? String(Math.round(facteur * 100) / 100).replace('.', ',') : null);
  ajout('bpm', 'Cardio moy.', positif(p.est_bpm) != null ? formatNombre(Math.round(Number(p.est_bpm))) : null, 'bpm');
  ajout('bpmMax', 'Cardio max', estim?.bpmMax != null ? formatNombre(estim.bpmMax) : null, 'bpm');
  const kj = positif(p.est_kj);
  ajout('kj', 'Énergie', kj != null ? formatNombre(Math.round(Number(kj))) : null, 'kJ');
  // Calories : en vélo, 1 kJ de travail ≈ 1 kcal dépensée ; en course, environ 1 kcal par kg et par km (le poids vient du profil)
  const poids = positif(ref.poidsKg);
  const kcal = kj != null ? Math.round(Number(kj)) : course && poids != null && km != null ? Math.round(poids * km) : null;
  ajout('kcal', 'Calories', kcal != null ? formatNombre(kcal) : null, 'kcal');
  // Conseils d'après la durée et l'effort (repères de nutrition sportive courants) : glucides au-delà d'une heure, boisson dès une demi-heure
  if (duree != null && duree >= 60) ajout('glucides', 'Glucides', duree > 150 ? '60–90' : '30–60', 'g/h');
  if (duree != null && duree >= 30) ajout('hydratation', 'Hydratation', rpe == null || rpe <= 4 ? '400–600' : rpe >= 8 ? '600–900' : '500–750', 'ml/h');
  return liste;
}

