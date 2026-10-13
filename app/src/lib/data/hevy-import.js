// Import Hevy : écritures dans la base (séances et séries), avec la RLS de l'utilisateur. La lecture du CSV et les décisions
// (nouvelle séance, rattachement à une séance Strava, déjà importée) sont dans hevy.js : ici on ne fait que préparer et exécuter.
import { chargerContexteImport, enregistrerSeanceForce } from './api.js';
import { familleSport } from './familles.js';
import { rapprocher, ligneActivite, lignesSeriesHevy, cleClient } from './hevy.js';
import { decalerJour } from '../analyse/maths.js';

const famille = (sport) => familleSport(sport);

/** Compare les séances Hevy à ce qui existe et renvoie le plan [{ seance, action, activiteId? }]. En démo : tout est nouveau. */
export async function preparerImport({ userId, demo, seances }) {
  if (!seances.length) return { plan: [], erreur: '' };
  if (demo) return { plan: rapprocher(seances, [], new Set(), famille), erreur: '' };
  const dates = seances.map((s) => s.date).sort();
  const r = await chargerContexteImport(userId, decalerJour(dates[0], -1), decalerJour(dates[dates.length - 1], 1));
  if (r.erreur) return { plan: [], erreur: r.erreur };
  return { plan: rapprocher(seances, r.data.existantes, r.data.avecSeries, famille), erreur: '' };
}

/**
 * Exécute le plan, une séance après l'autre (on ne surcharge pas la base). `progres(fait, total)` est appelé après chaque séance.
 * Une séance qui échoue n'arrête pas les autres : elle est listée dans `echecs`. Renvoie { creees, rattachees, echecs: [{ titre, date, erreur }] }.
 */
export async function lancerImport({ userId, demo, plan, progres = () => {}, annule = () => false }) {
  const aFaire = plan.filter((p) => p.action !== 'deja');
  const bilan = { creees: 0, rattachees: 0, echecs: [] };
  let fait = 0;
  for (const p of aFaire) {
    if (annule()) break;
    const s = p.seance;
    try {
      if (demo) {
        // en démo rien n'est écrit : on simule pour montrer le parcours
      } else if (p.action === 'attacher') {
        const r = await enregistrerSeanceForce(userId, ligneActivite(s), lignesSeriesHevy(s), { id: p.activiteId, manuelle: false });
        if (r.erreur) throw new Error(r.erreur);
      } else {
        const r = await enregistrerSeanceForce(userId, ligneActivite(s), lignesSeriesHevy(s), null, cleClient(s));
        if (r.erreur) throw new Error(r.erreur);
      }
      if (p.action === 'attacher') bilan.rattachees++;
      else bilan.creees++;
    } catch (e) {
      bilan.echecs.push({ titre: s.titre, date: s.date, erreur: String(e?.message || 'Erreur inconnue').slice(0, 200) });
    }
    fait++;
    progres(fait, aFaire.length);
  }
  return bilan;
}
