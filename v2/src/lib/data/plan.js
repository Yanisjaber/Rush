// Plan : quatre semaines glissantes (du lundi au dimanche) avec, pour chaque jour, les compétitions, les séances prévues, les repos,
// les notes et les sorties déjà faites, plus les totaux de chaque semaine. Fonctions pures, sans réseau.
//
// Comme dans la v1, le plan ne génère rien tout seul : il montre ce que TU as prévu. Une phase de préparation est seulement indiquée.
import { dateIsoLocale } from '../utils/format.js';

export const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const iso10 = (v) => String(v).slice(0, 10);

/** Lundi (à midi) de la semaine qui contient la date. */
export function lundiDe(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** Première et dernière date (ISO) couvertes par `nb` semaines à partir du lundi donné. */
export function bornesPlan(lundi, nb = 4) {
  const fin = new Date(lundi);
  fin.setDate(fin.getDate() + nb * 7 - 1);
  return { debut: dateIsoLocale(lundi), fin: dateIsoLocale(fin) };
}

const libelleDate = (d) => `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;

/** Durée visée d'une compétition en minutes (activity_planned.duration), ou 0 si non renseignée. */
const dureeCompetition = (c) => (Number(c.duration) > 0 ? Number(c.duration) : 0);

const groupe = (liste, cle) => {
  const m = new Map();
  for (const e of liste || []) {
    const k = iso10(cle(e));
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return m;
};

/**
 * Construit le plan : [{ titre, debut, fin, jours: [jour × 7], totaux: { seances, dureeMin, tss, km } }].
 *  jour : { iso, num, nom, passe, aujourdhui, objectifs, prevues, realisees, notes, repos }
 * Les totaux d'une semaine comptent ce qui est prévu à partir d'aujourd'hui (jamais le passé), hors repos ; une compétition sans durée
 * compte 120 min de charge (comme la v1) mais 0 min de durée affichée.
 */
export function construirePlan(lundi, { planifiees = [], objectifs = [], seances = [], notes = [], repos = [] } = {}, aujourdhui = new Date(), nb = 4) {
  const auj = dateIsoLocale(aujourdhui);
  const parPlan = groupe(planifiees, (p) => p.date);
  const parObjectif = groupe(objectifs, (o) => o.date);
  const parSeance = groupe(seances, (s) => s.start_date_local);
  const jourDeRepos = new Set(repos.map((r) => iso10(r.iso_date ?? r)));
  const semaines = [];
  for (let w = 0; w < nb; w++) {
    const debut = new Date(lundi);
    debut.setDate(debut.getDate() + w * 7);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 6);
    const jours = [];
    const totaux = { seances: 0, dureeMin: 0, tss: 0, km: 0 };
    for (let i = 0; i < 7; i++) {
      const d = new Date(debut);
      d.setDate(d.getDate() + i);
      const iso = dateIsoLocale(d);
      const prevues = parPlan.get(iso) || [];
      const obj = parObjectif.get(iso) || [];
      if (iso >= auj) {
        for (const c of obj) {
          totaux.seances++;
          totaux.dureeMin += dureeCompetition(c);
          totaux.tss += dureeCompetition(c) || 120;
          totaux.km += Number(c.km) || 0;
        }
        for (const p of prevues) {
          totaux.seances++;
          totaux.dureeMin += Number(p.duration) || 0;
          totaux.tss += Number(p.tss) || 0;
          totaux.km += Number(p.km) || 0;
        }
      }
      jours.push({
        iso,
        num: d.getDate(),
        nom: JOURS[i],
        passe: iso < auj,
        aujourdhui: iso === auj,
        objectifs: obj,
        prevues,
        realisees: parSeance.get(iso) || [],
        notes: notes.filter((n) => String(n.from_date) <= iso && iso <= String(n.to_date)),
        repos: jourDeRepos.has(iso),
      });
    }
    semaines.push({ titre: `Semaine du ${libelleDate(debut)} au ${libelleDate(fin)}`, debut: dateIsoLocale(debut), fin: dateIsoLocale(fin), jours, totaux: { ...totaux, tss: Math.round(totaux.tss), km: Math.round(totaux.km * 10) / 10 } });
  }
  return semaines;
}

/** Un jour est-il vide (rien de prévu, de noté ni de fait) ? */
export const jourVide = (j) => !j.objectifs.length && !j.prevues.length && !j.realisees.length && !j.notes.length && !j.repos;
