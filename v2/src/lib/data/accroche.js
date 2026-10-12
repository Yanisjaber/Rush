// Phrases d'accroche de l'accueil pour les onglets muscu et Hyrox (texte brut : Svelte l'échappe à l'affichage).
import { progressionParExercice } from './force.js';
import { ciblesSegments, ecartsParSegment, ecrireTemps, formatEcartLong } from './hyrox.js';
import { joursAvant } from '../utils/format.js';

/** Muscu : régularité, record récent et séance du jour. `serie` = semaines de suite avec une séance de force. */
export function accrocheMuscu({ serie = 0, series = [], programme = null }, aujourdhui = new Date()) {
  const morceaux = [];
  if (serie >= 2) morceaux.push(`${serie} semaines d'affilée sans manquer une séance`);
  else if (serie === 1) morceaux.push('Une semaine de suite avec une séance de force');
  // Record des 14 derniers jours : la progression la plus récente qui bat les séances précédentes
  const recent = progressionParExercice(series).find((e) => e.record && joursAvant(e.date, aujourdhui) >= -14);
  if (recent) morceaux.push(`un nouveau record (${recent.nom})`);
  let texte = morceaux.length ? `${morceaux.join(', et ')}.` : '';
  if (texte) texte = texte.charAt(0).toUpperCase() + texte.slice(1);
  if (programme) texte += `${texte ? ' ' : ''}Aujourd'hui, ${programme.name.toLowerCase()}.`;
  return texte || 'Crée un programme et enregistre ta première séance : tes records et ton tonnage apparaîtront ici.';
}

/** Hyrox : jours avant l'objectif, écart au temps visé et segment où se cache le plus gros écart. */
export function accrocheHyrox({ objectif = null, test = null, cible = null }, aujourdhui = new Date()) {
  const parties = [];
  if (objectif) {
    const j = joursAvant(objectif.date, aujourdhui);
    if (j > 0) parties.push(`Ton ${objectif.name} est dans ${j} jour${j > 1 ? 's' : ''}.`);
    else if (j === 0) parties.push(`Ton ${objectif.name}, c'est aujourd'hui.`);
  }
  if (test && cible) {
    const ecart = test.total_s - cible.total_s;
    if (ecart > 0) parties.push(`Il te manque ${formatEcartLong(ecart).replace('+', '')} sur ton objectif de ${ecrireTemps(cible.total_s)}.`);
    else parties.push(`Ton dernier test est sous ton objectif de ${ecrireTemps(cible.total_s)}. Tu peux viser plus haut.`);
    const cibles = ciblesSegments(cible, test);
    const pire = [...ecartsParSegment(test, cibles, 'station'), ...ecartsParSegment(test, cibles, 'run')].sort((a, b) => b.ecart - a.ecart)[0];
    if (ecart > 0 && pire && pire.ecart > 0) parties.push(`Le plus gros écart : ${pire.nom} (+${pire.ecart} s).`);
  } else if (!test) {
    parties.push('Saisis une simulation pour voir où tu perds du temps.');
  } else if (!cible) {
    parties.push('Fixe un objectif de temps pour savoir où gagner des secondes.');
  }
  return parties.join(' ') || 'Ajoute ta compétition Hyrox et saisis un test pour suivre ta progression.';
}
