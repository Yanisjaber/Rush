// L'écran de lecture d'une séance prévue ou d'une compétition : les chiffres à montrer, dans l'ordre. Fonctions pures, sans écran ni réseau.
import { allureMoyenne, texteTempsCible } from './competition.ts';
import { formatKm, formatNombre } from '../outils/format.ts';
import { texteDuree } from './structure.ts';
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
function distance(km: number, sport: string): { valeur: string; unite: string } {
  return sport === 'Swim' ? { valeur: formatNombre(Math.round(km * 1000)), unite: 'm' } : { valeur: formatKm(km, km >= 100 ? 0 : 1), unite: 'km' };
}

/**
 * Les chiffres d'une séance prévue (durée, charge, distance, dénivelé, effort, allure ou vitesse prévue, puissance, cardio et énergie estimées) ou d'une compétition
 * (temps cible, distance, dénivelé, allure ou vitesse cible, fédération, niveau, format, tours, charge, effort) : seuls ceux que la ligne renseigne.
 */
export function chiffresPrevue(p: PrevueComplete): ChiffrePrevue[] {
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
    ajout('allure', allure ? allure.libelle.replace('moy.', 'cible') : '', allure?.valeur);
    ajout('federation', 'Fédération', p.federation);
    ajout('niveau', 'Niveau', p.race_level);
    ajout('format', 'Format', p.tri_format);
    ajout('tours', 'Tours', positif(p.laps) != null ? String(p.laps) : null);
    ajout('charge', 'Charge estimée', tss != null ? formatNombre(tss) : null, 'pts');
    ajout('effort', 'Effort estimé', rpe != null ? String(rpe) : null, '/10');
    return liste;
  }

  const duree = positif(p.duration);
  ajout('duree', 'Durée', duree != null ? texteDuree(duree) : null);
  ajout('charge', 'Charge', tss != null ? formatNombre(tss) : null, 'pts');
  ajout('distance', 'Distance', d?.valeur, d?.unite);
  ajout('dplus', 'Dénivelé +', dplus != null ? formatNombre(dplus) : null, 'm');
  ajout('effort', 'Effort estimé', rpe != null ? String(rpe) : null, '/10');
  const allure = allureMoyenne(p.sport, km, duree);
  ajout('allure', allure ? allure.libelle.replace('moy.', 'prévue') : '', allure?.valeur);
  ajout('watts', 'Puissance estimée', positif(p.est_watts) != null ? formatNombre(Math.round(Number(p.est_watts))) : null, 'W');
  ajout('bpm', 'Cardio estimé', positif(p.est_bpm) != null ? formatNombre(Math.round(Number(p.est_bpm))) : null, 'bpm');
  ajout('kj', 'Énergie', positif(p.est_kj) != null ? formatNombre(Math.round(Number(p.est_kj))) : null, 'kJ');
  return liste;
}
