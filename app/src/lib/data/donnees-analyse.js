// Chargement des données d'une page d'analyse : un an et demi de séances (les modèles de condition ont besoin de recul),
// les séances prévues, les compétitions à venir et le profil. Les calculs eux-mêmes sont dans lib/analyse/.
import { chargerSeancesLongue, chargerPlanifiees, chargerObjectifs, chargerProfil } from './api.js';
import { donneesDemo } from './demo.js';
import { dateIsoLocale } from '../utils/format.js';
import { decalerJour } from '../analyse/maths.js';

const RECUL_JOURS = 560; // ≈ 18 mois : 12 mois affichés + de quoi « chauffer » la condition

/** Renvoie { seances, planifiees, objectifs, hrMax, erreur } (jamais d'exception). */
export async function chargerDonneesAnalyse({ userId, demo, aujourdhui = new Date() }) {
  if (demo) {
    const d = donneesDemo(aujourdhui, RECUL_JOURS);
    return {
      seances: [...d.seances].sort((a, b) => a.start_date_local.localeCompare(b.start_date_local)),
      planifiees: d.planifiees.filter((p) => p.category !== 'competition'),
      objectifs: d.objectifs,
      hrMax: d.profil.hr_max,
      erreur: '',
    };
  }
  const fin = dateIsoLocale(aujourdhui);
  const [s, p, o, pr] = await Promise.all([
    chargerSeancesLongue(userId, decalerJour(fin, -RECUL_JOURS), fin),
    chargerPlanifiees(userId, fin, decalerJour(fin, 200)),
    chargerObjectifs(userId, 8),
    chargerProfil(userId),
  ]);
  if (s.erreur) return { seances: [], planifiees: [], objectifs: [], hrMax: null, erreur: s.erreur };
  return {
    seances: s.data || [],
    planifiees: (p.data || []).filter((x) => x.category !== 'competition'),
    objectifs: o.data || [],
    hrMax: pr.data?.hr_max || null,
    erreur: p.erreur || o.erreur || '',
  };
}
