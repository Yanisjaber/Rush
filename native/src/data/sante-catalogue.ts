// Le catalogue des mesures de santé : pour chaque mesure, son nom, son unité, ses bornes et la façon de la lire.
// Les lignes vivent dans la table `health_metrics` (compte, date, mesure, valeur, source) : ajouter une mesure ici ne demande aucun changement de base.
// Fonctions pures, sans réseau. Les bornes servent à refuser une faute de frappe (un poids de 700 kg) avant même d'écrire en base.

export type FamilleMesure = 'ressenti' | 'evenement' | 'corps' | 'nutrition' | 'cycle' | 'appareil';
export type TypeMesure = 'echelle' | 'case' | 'nombre' | 'choix';
export type SensMesure = 'haut_mieux' | 'bas_mieux' | 'neutre';

export interface DefMesure {
  cle: string;
  nom: string;
  famille: FamilleMesure;
  type: TypeMesure;
  unite?: string;
  min: number;
  max: number;
  /** Précision de la saisie (0,1 kg ; 1 pour une échelle…). */
  pas: number;
  /** haut_mieux : une valeur haute est bonne ; bas_mieux : une valeur basse est bonne ; neutre : pas de jugement. */
  sens: SensMesure;
  /** Libellés d'une échelle ou d'un choix, de la valeur la plus basse à la plus haute. */
  libelles?: string[];
  aide?: string;
  /** Donnée particulièrement sensible : jamais affichée ailleurs que dans l'écran qui la saisit. */
  sensible?: boolean;
}

export const FAMILLES: Record<FamilleMesure, string> = {
  ressenti: 'Ressenti du matin',
  evenement: 'Événements',
  corps: 'Corps',
  nutrition: 'Nutrition',
  cycle: 'Cycle',
  appareil: "Mesures d'appareils",
};

const echelle = (cle: string, nom: string, sens: SensMesure, libelles: string[], aide: string): DefMesure => ({ cle, nom, famille: 'ressenti', type: 'echelle', min: 1, max: 5, pas: 1, sens, libelles, aide });

export const MESURES: Record<string, DefMesure> = Object.fromEntries(
  (
    [
      // Ressenti du matin : cinq questions de 1 à 5 (dans l'esprit de l'indice de Hooper)
      echelle('ressenti_fatigue', 'Fatigue', 'bas_mieux', ['Frais', 'Plutôt frais', 'Moyen', 'Fatigué', 'Épuisé'], 'Comment te sens-tu ce matin ?'),
      echelle('ressenti_courbatures', 'Courbatures', 'bas_mieux', ['Aucune', 'Légères', 'Moyennes', 'Fortes', 'Très fortes'], 'Tes muscles, ce matin.'),
      echelle('ressenti_humeur', 'Humeur', 'haut_mieux', ['Mauvaise', 'Basse', 'Correcte', 'Bonne', 'Excellente'], 'Ton humeur au réveil.'),
      echelle('ressenti_motivation', 'Motivation', 'haut_mieux', ['Nulle', 'Faible', 'Moyenne', 'Bonne', 'Très forte'], "L'envie de t'entraîner."),
      echelle('ressenti_stress', 'Stress de la vie', 'bas_mieux', ['Serein', 'Plutôt calme', 'Moyen', 'Tendu', 'Très stressé'], 'Travail, études, famille… hors entraînement.'),

      // Événements : une case à cocher (alcool : un nombre de verres)
      { cle: 'evt_malade', nom: 'Malade', famille: 'evenement', type: 'case', min: 0, max: 1, pas: 1, sens: 'bas_mieux', aide: 'Rhume, fièvre, gastro… Plafonne ton état de forme.' },
      { cle: 'evt_blesse', nom: 'Blessé', famille: 'evenement', type: 'case', min: 0, max: 1, pas: 1, sens: 'bas_mieux', aide: 'Une blessure ou une douleur qui te gêne.' },
      { cle: 'evt_voyage', nom: 'Voyage ou décalage horaire', famille: 'evenement', type: 'case', min: 0, max: 1, pas: 1, sens: 'bas_mieux', aide: 'Peut fausser tes mesures de la nuit.' },
      { cle: 'alcool_verres', nom: "Alcool d'hier", famille: 'evenement', type: 'nombre', unite: 'verres', min: 0, max: 30, pas: 1, sens: 'bas_mieux', aide: "Abaisse la HRV et le sommeil de la nuit." },

      // Corps : des tendances lentes, hors du calcul du jour
      { cle: 'poids_kg', nom: 'Poids', famille: 'corps', type: 'nombre', unite: 'kg', min: 20, max: 400, pas: 0.1, sens: 'neutre', aide: 'Le matin, à jeun, après être passé aux toilettes.' },
      { cle: 'masse_grasse_pct', nom: 'Masse grasse', famille: 'corps', type: 'nombre', unite: '%', min: 2, max: 70, pas: 0.1, sens: 'neutre' },
      { cle: 'masse_musculaire_kg', nom: 'Masse musculaire', famille: 'corps', type: 'nombre', unite: 'kg', min: 5, max: 150, pas: 0.1, sens: 'neutre' },
      { cle: 'tension_sys', nom: 'Tension systolique', famille: 'corps', type: 'nombre', unite: 'mmHg', min: 60, max: 260, pas: 1, sens: 'neutre', aide: 'Le premier chiffre (le plus haut).' },
      { cle: 'tension_dia', nom: 'Tension diastolique', famille: 'corps', type: 'nombre', unite: 'mmHg', min: 30, max: 160, pas: 1, sens: 'neutre', aide: 'Le second chiffre (le plus bas).' },

      // Nutrition
      { cle: 'calories_kcal', nom: 'Calories', famille: 'nutrition', type: 'nombre', unite: 'kcal', min: 0, max: 15000, pas: 10, sens: 'neutre', aide: 'Ce que tu as mangé hier.' },
      { cle: 'proteines_g', nom: 'Protéines', famille: 'nutrition', type: 'nombre', unite: 'g', min: 0, max: 600, pas: 1, sens: 'neutre' },
      { cle: 'eau_l', nom: 'Eau', famille: 'nutrition', type: 'nombre', unite: 'L', min: 0, max: 15, pas: 0.1, sens: 'neutre' },

      // Cycle (optionnel, sensible)
      { cle: 'cycle_phase', nom: 'Phase du cycle', famille: 'cycle', type: 'choix', min: 1, max: 4, pas: 1, sens: 'neutre', libelles: ['Règles', 'Folliculaire', 'Ovulation', 'Lutéale'], sensible: true },

      // Mesures d'appareils (importées plus tard : Apple Santé, Whoop, Garmin)
      { cle: 'resp_nuit', nom: 'Fréquence respiratoire de nuit', famille: 'appareil', type: 'nombre', unite: 'resp/min', min: 4, max: 40, pas: 0.1, sens: 'bas_mieux' },
      { cle: 'temp_cutanee_ecart', nom: 'Température cutanée (écart)', famille: 'appareil', type: 'nombre', unite: '°C', min: -5, max: 5, pas: 0.1, sens: 'neutre' },
      { cle: 'spo2_nuit', nom: 'SpO₂ de nuit', famille: 'appareil', type: 'nombre', unite: '%', min: 70, max: 100, pas: 0.1, sens: 'haut_mieux' },
    ] as DefMesure[]
  ).map((m) => [m.cle, m]),
);

export const defMesure = (cle: string): DefMesure | null => (Object.hasOwn(MESURES, cle) ? MESURES[cle] : null);

/** Les mesures d'une famille, dans l'ordre du catalogue. */
export const mesuresDe = (famille: FamilleMesure): DefMesure[] => Object.values(MESURES).filter((m) => m.famille === famille);

/**
 * Une valeur saisie, nettoyée : un nombre fini dans les bornes de la mesure, arrondi à son pas (entier pour une échelle, une case ou un choix).
 * Renvoie null si la mesure est inconnue ou la valeur hors bornes : on refuse plutôt que de corriger.
 */
export function valeurValide(cle: string, brut: unknown): number | null {
  const def = defMesure(cle);
  if (!def || brut === '' || brut == null || typeof brut === 'boolean') return null;
  const n = typeof brut === 'number' ? brut : Number(String(brut).replace(',', '.').trim());
  if (!Number.isFinite(n) || n < def.min || n > def.max) return null;
  const arrondi = Math.round(n / def.pas) * def.pas;
  return Math.round(arrondi * 1000) / 1000;
}

// --- Les sources et leur priorité --------------------------------------------------------------------------------------------

/** Les sources connues de la table. Quand deux sources donnent la même mesure le même jour, la première de cette liste l'emporte (ta saisie avant l'appareil). */
export const PRIORITE_SOURCES = ['manual', 'apple_sante', 'whoop', 'garmin', 'strava'] as const;
export type SourceMesure = (typeof PRIORITE_SOURCES)[number];

export interface LigneMesure {
  date: string;
  metric: string;
  value: number;
  source: string;
}

/** Les mesures retenues, par jour : { '2026-10-20': { poids_kg: 72.4, ressenti_fatigue: 2 } }. */
export type MesuresParJour = Record<string, Record<string, number>>;

/** Résout les lignes de la base : une seule valeur par jour et par mesure (la source la plus prioritaire), et seulement les mesures valides du catalogue. */
export function resoudreMesures(lignes: LigneMesure[] | null | undefined): MesuresParJour {
  const choisies = new Map<string, { rang: number; valeur: number }>();
  for (const l of lignes || []) {
    const rang = (PRIORITE_SOURCES as readonly string[]).indexOf(l.source);
    const valeur = valeurValide(l.metric, l.value);
    if (rang < 0 || valeur == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(l.date))) continue;
    const cle = `${l.date}|${l.metric}`;
    const deja = choisies.get(cle);
    if (!deja || rang < deja.rang) choisies.set(cle, { rang, valeur });
  }
  const sortie: MesuresParJour = {};
  for (const [cle, { valeur }] of choisies) {
    const [date, metric] = cle.split('|');
    (sortie[date] ??= {})[metric] = valeur;
  }
  return sortie;
}
