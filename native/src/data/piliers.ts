// Les piliers de l'écran Santé : une vue uniforme (valeur du jour, écart à TA moyenne, niveau, mini courbe) pour chaque facteur de l'état de forme.
// Fonctions pures, sans réseau, testées. Les piliers sont triés du plus bas au plus haut : on lit d'abord ce qui tire l'état de forme vers le bas.
import { COMMENT_AJOUTER, enAlerte, estPilier, indiceRessenti, metriqueRecente, niveauDe, NOM_COMPOSANTE, POIDS_FORME, type CleComposante, type Niveau, type PointForme } from './forme-sante.ts';
import type { MesuresParJour } from './sante-catalogue.ts';
import { lisser, moyenneSur, proteinesParKg, serieDe, variationHebdo } from './suivi-corps.ts';
import { scoreNuit } from './score-sommeil.ts';
import { formeActuelle } from './synthese.ts';
import type { Metrique, Nuit } from './types.ts';

export interface PilierVue {
  cle: CleComposante;
  nom: string;
  /** La valeur du jour, en texte (« 85 », « +7 », « — »). */
  valeur: string;
  unite: string;
  /** L'écart à TA moyenne des nuits précédentes (« −14 vs ta moyenne »), ou une courte note ; null sans référence. */
  ecart: string | null;
  niveau: Niveau | null;
  indice: number | null;
  poids: number;
  /** Vrai pour le stress de nuit, la respiration et la température : surveillés, sans poids dans le chiffre. */
  surveille: boolean;
  /** Vrai si cette alerte est déclenchée (écart marqué à ta norme). Toujours faux pour un pilier. */
  alerte: boolean;
  /** Les 14 dernières valeurs, de la plus ancienne à la plus récente (vide sans donnée). */
  courbe: number[];
  /** L'écran de détail qu'ouvre un appui. */
  vers: string;
  /** Ce qu'il faut faire pour avoir ce pilier, quand il manque. */
  manquant: string | null;
}

const NB_COURBE = 14;
const MOINS = '−';
const signe = (n: number) => (n > 0 ? '+' : n < 0 ? MOINS : '');

/** « +4 vs ta moyenne » : la dernière valeur contre la moyenne des 28 valeurs précédentes (au moins 10). */
export function ecartTexte(valeur: number, precedentes: number[]): string | null {
  const ref = precedentes.slice(-28).filter((x) => Number.isFinite(x) && x > 0);
  if (!Number.isFinite(valeur) || ref.length < 10) return null;
  const ecart = Math.round(valeur - ref.reduce((a, b) => a + b, 0) / ref.length);
  return ecart === 0 ? 'Comme ta moyenne' : `${signe(ecart)}${Math.abs(ecart)} vs ta moyenne`;
}

const POINT: Record<CleComposante, { unite: string; vers: string; decimales?: number; signee?: boolean }> = {
  sommeil: { unite: '/100', vers: '/sante/sommeil' },
  hrv: { unite: 'ms', vers: '/sante/pilier?cle=hrv' },
  fc: { unite: 'bpm', vers: '/sante/pilier?cle=fc' },
  ressenti: { unite: '/100', vers: '/sante/checkin' },
  charge: { unite: '', vers: '/sante/pilier?cle=charge', signee: true },
  stress: { unite: '/100', vers: '/sante/pilier?cle=stress' },
  resp: { unite: 'resp/min', vers: '/sante/pilier?cle=resp', decimales: 1 },
  temperature: { unite: '°C', vers: '/sante/pilier?cle=temperature', decimales: 1, signee: true },
};

/**
 * L'historique d'un pilier, de la plus ancienne valeur à la plus récente : le score de sommeil, la HRV, la FC de repos, le stress de nuit (par nuit),
 * le ressenti (par jour saisi), la fraîcheur d'entraînement, la respiration et la température (par jour mesuré). Sert aux cartes et aux écrans de détail.
 */
export function historiquePilier(cle: CleComposante, nuits: Nuit[] | null | undefined, metriques: Metrique[] | null | undefined, mesures: MesuresParJour | null | undefined, jusquA?: string): number[] {
  // `jusquA` : on ignore tout ce qui est plus récent que ce jour (pour que la valeur affichée soit celle du jour de l'indice)
  const chrono = [...(nuits || [])].filter((n) => !jusquA || n.date <= jusquA).sort((a, b) => a.date.localeCompare(b.date));
  const mes = mesures || {};
  const jours = Object.keys(mes).filter((d) => !jusquA || d <= jusquA).sort();
  const nombres = (v: (number | null | undefined)[]) => v.filter((x): x is number => x != null && Number.isFinite(x));
  const parNuit = (champ: keyof Nuit) => nombres(chrono.map((n) => Number(n[champ]))).filter((x) => x > 0);
  switch (cle) {
    case 'sommeil':
      return nombres(chrono.map((n) => scoreNuit(n)?.total)).filter((x) => x > 0);
    case 'hrv':
      return parNuit('hrv_avg');
    case 'fc':
      return parNuit('resting_heart_rate');
    case 'stress':
      return parNuit('avg_stress');
    case 'ressenti':
      return nombres(jours.map((d) => indiceRessenti(mes[d])));
    case 'charge':
      return nombres([...(metriques || [])].filter((m) => !jusquA || m.iso_date <= jusquA).sort((a, b) => a.iso_date.localeCompare(b.iso_date)).map((m) => Number(m.tsb)));
    case 'resp':
      return nombres(jours.map((d) => mes[d]?.resp_nuit));
    case 'temperature':
      return nombres(jours.map((d) => mes[d]?.temp_cutanee_ecart));
  }
}

/** Une valeur du jour en texte : « 85 », « +7 », « 14,2 », « −0,3 ». */
export function texteValeur(cle: CleComposante, v: number): string {
  const { decimales = 0, signee = false } = POINT[cle];
  const abs = Math.abs(v).toFixed(decimales).replace('.', ',');
  return signee ? `${signe(v)}${abs}` : abs;
}

/**
 * Les piliers du dernier jour de la série, du plus bas au plus haut ; ceux sans donnée à la fin, avec la consigne pour les obtenir.
 * Le stress de nuit, la respiration et la température (surveillés, sans poids) viennent après les piliers et n'apparaissent que si on a une valeur.
 */
export function construirePiliers(nuits: Nuit[] | null | undefined, metriques: Metrique[] | null | undefined, mesures: MesuresParJour | null | undefined, serie: PointForme[]): PilierVue[] {
  const point = serie[serie.length - 1];
  if (!point) return [];
  // La charge n'est lue que si sa dernière métrique est récente (14 jours au plus) : sinon elle est périmée, comme dans le calcul de l'indice
  const chargeRecente = !!metriqueRecente(metriques || [], point.date);
  const fraicheur = !chargeRecente ? null : formeActuelle([...(metriques || [])].filter((m) => m.iso_date <= point.date).sort((a, b) => a.iso_date.localeCompare(b.iso_date)));

  const vues: PilierVue[] = point.composantes.map((c) => {
    const histo = c.cle === 'charge' && !chargeRecente ? [] : historiquePilier(c.cle, nuits, metriques, mesures, point.date);
    // HRV : l'indice repose sur la moyenne des 3 dernières nuits (voir forme-sante.ts) ; la valeur et l'écart affichés sont donc ceux de cette moyenne,
    // pour ne pas contredire la couleur de la jauge. Les autres piliers affichent la dernière valeur.
    const hrvMoyenne = c.cle === 'hrv' && histo.length >= 2 ? Math.round(histo.slice(-3).reduce((a, b) => a + b, 0) / histo.slice(-3).length) : null;
    const dernier = hrvMoyenne ?? histo[histo.length - 1];
    const aDonnee = dernier != null;
    // La charge n'a pas d'« écart à la moyenne » : on affiche son libellé (« Frais », « Fatigué »)
    const ecart = !aDonnee ? null : c.cle === 'charge' ? (fraicheur?.libelle ?? null) : c.cle === 'temperature' ? 'Écart à ta normale' : c.cle === 'ressenti' ? null : ecartTexte(dernier, histo.slice(0, -1));
    return {
      cle: c.cle,
      nom: NOM_COMPOSANTE[c.cle],
      valeur: aDonnee ? texteValeur(c.cle, dernier) : '—',
      unite: aDonnee ? POINT[c.cle].unite : '',
      ecart,
      niveau: niveauDe(c.indice),
      indice: c.indice,
      poids: POIDS_FORME[c.cle],
      surveille: !estPilier(c.cle),
      alerte: enAlerte(c.cle, c.indice),
      courbe: histo.slice(-NB_COURBE),
      vers: POINT[c.cle].vers,
      manquant: c.indice == null ? COMMENT_AJOUTER[c.cle] : null,
    };
  });

  // Les piliers d'abord (du plus bas au plus haut, ceux sans donnée à la fin), puis les éléments surveillés qui ont une valeur
  const piliers = vues.filter((v) => !v.surveille);
  const surveilles = vues.filter((v) => v.surveille && v.indice != null).sort((a, b) => (a.indice as number) - (b.indice as number));
  const avecDonnee = piliers.filter((v) => v.indice != null).sort((a, b) => (a.indice as number) - (b.indice as number));
  const sans = piliers.filter((v) => v.indice == null);
  return [...avecDonnee, ...sans, ...surveilles];
}

/** Un suivi lent (corps, nutrition) : la même forme de carte qu'un pilier, sans niveau ni poids (il ne bouge pas l'état de forme du jour). */
export interface SuiviVue {
  cle: 'corps' | 'nutrition';
  nom: string;
  valeur: string;
  unite: string;
  ecart: string | null;
  courbe: number[];
  vers: string;
  /** Ce qu'il faut faire pour avoir ce suivi, quand il n'y a encore rien. */
  manquant: string | null;
}

const virgule = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

/** Les suivis du corps et de la nutrition : poids lissé et tendance par semaine ; calories moyennes de la semaine et protéines par kilo. */
export function construireSuivis(mesures: MesuresParJour | null | undefined, finIso: string): SuiviVue[] {
  const lisses = lisser(serieDe(mesures, 'poids_kg'));
  const dernierPoids = lisses[lisses.length - 1];
  const variation = variationHebdo(lisses);
  const corps: SuiviVue = dernierPoids
    ? {
        cle: 'corps',
        nom: 'Corps',
        valeur: virgule(dernierPoids.lisse),
        unite: 'kg',
        ecart: variation ? (variation.pctParSemaine === 0 ? 'Stable' : `${signe(variation.parSemaine)}${virgule(Math.abs(variation.parSemaine), 2)} kg par semaine`) : 'Tendance dans une semaine',
        courbe: lisses.slice(-NB_COURBE).map((p) => p.lisse),
        vers: '/sante/corps',
        manquant: null,
      }
    : { cle: 'corps', nom: 'Corps', valeur: '—', unite: '', ecart: null, courbe: [], vers: '/sante/corps', manquant: 'Saisis ton poids pour suivre ta tendance.' };

  const kcal = moyenneSur(mesures, 'calories_kcal', 7, finIso);
  const prot = moyenneSur(mesures, 'proteines_g', 7, finIso);
  const parKg = proteinesParKg(prot?.moyenne, dernierPoids?.lisse);
  const nutrition: SuiviVue = kcal
    ? {
        cle: 'nutrition',
        nom: 'Nutrition',
        valeur: String(Math.round(kcal.moyenne)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '),
        unite: 'kcal par jour',
        ecart: parKg ? `${virgule(parKg.gParKg, 2)} g/kg de protéines` : `Sur ${kcal.n} jour${kcal.n > 1 ? 's' : ''}`,
        courbe: serieDe(mesures, 'calories_kcal').slice(-NB_COURBE).map((p) => p.valeur),
        vers: '/sante/nutrition',
        manquant: null,
      }
    : { cle: 'nutrition', nom: 'Nutrition', valeur: '—', unite: '', ecart: null, courbe: [], vers: '/sante/nutrition', manquant: 'Note tes calories pour suivre tes apports.' };
  return [corps, nutrition];
}

/** Les noms courts des piliers, pour les endroits où la place manque (jauges, pastilles). */
export const NOM_COURT: Record<CleComposante, string> = { hrv: 'HRV', fc: 'FC', sommeil: 'Sommeil', ressenti: 'Ressenti', charge: 'Charge', stress: 'Stress', resp: 'Respi.', temperature: 'Temp.' };

export interface Motif {
  cle: CleComposante;
  nom: string;
  /** L'écart à ta moyenne, signé (« −14 », « +8 »). */
  delta: string;
  niveau: Niveau | null;
  vers: string;
}

/**
 * Ce qui a le plus bougé aujourd'hui : les piliers (pas les alertes) dont on connaît l'écart à ta moyenne, classés par leur effet sur l'état de forme
 * (à quel point leur indice s'éloigne de 50, multiplié par leur poids). Sert à rendre la lecture vérifiable : « HRV −14, Stress +8 ».
 */
export function motifsDuJour(piliers: PilierVue[], max = 3): Motif[] {
  return piliers
    .filter((p) => !p.surveille && p.indice != null && p.ecart != null && /^[+−]\d/.test(p.ecart))
    .map((p) => ({ p, impact: Math.abs((p.indice as number) - 50) * p.poids }))
    .sort((a, b) => b.impact - a.impact)
    .slice(0, max)
    .map(({ p }) => ({ cle: p.cle, nom: NOM_COURT[p.cle], delta: (p.ecart as string).split(' ')[0], niveau: p.niveau, vers: p.vers }));
}
