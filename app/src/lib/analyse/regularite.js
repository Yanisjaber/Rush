// Analyse de la régularité : t'entraînes-tu assez souvent, sans longues pauses, et avec de vrais jours de repos ?
// Tout est déduit des jours où tu as au moins une séance (tous sports, ou le sport choisi). Fonctions pures.
// Même format de sortie que les autres analyses : { verdict, chiffres, graphiques, lectures, conseils, methode }.
import { dateIsoLocale, formatDateCourte } from '../utils/format.js';
import { casesRegularite } from '../data/synthese.js';
import { familleAffichage } from '../data/familles.js';
import { SPORTS, couleurSport } from '../sports.js';
import { moyenne, arrondi, decalerJour, lundiDe, ecartJours } from './maths.js';

const CIBLE = 3; // jours d'entraînement par semaine : le seuil d'une semaine « tenue »
const ORDRE = { haute: 0, moyenne: 1, faible: 2, info: 3 };
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const virgule = (v, n = 1) => String(arrondi(v, n)).replace('.', ',');
const pluriel = (n, mot, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`;
const jourDeSemaine = (iso) => (new Date(`${iso}T12:00:00`).getDay() + 6) % 7; // 0 = lundi

const METHODE = [
  { titre: 'Les jours actifs', texte: 'Un jour est actif dès qu\'il compte au moins une séance, tous sports confondus (ou le sport choisi en haut de page). Deux séances le même jour comptent pour un seul jour : on mesure la régularité, pas le volume.' },
  { titre: 'Les semaines tenues', texte: `Une semaine (du lundi au dimanche) est « tenue » à partir de ${CIBLE} jours actifs : c'est le rythme qui permet de progresser dans la plupart des sports de performance. La semaine en cours n'est pas comptée tant qu'elle n'est pas finie.` },
  { titre: 'Les pauses et la série', texte: 'La pause la plus longue est le plus grand nombre de jours d\'affilée sans séance sur la période. La série est le nombre de semaines tenues consécutives, en remontant depuis la dernière semaine complète.' },
  { titre: 'Les jours de repos', texte: 'Une semaine à 6 ou 7 jours actifs ne laisse pas de vrai jour de repos : c\'est signalé, la récupération fait partie de la progression.' },
];

const triConseils = (c) => c.sort((a, b) => ORDRE[a.priorite] - ORDRE[b.priorite]);

export function analyserRegularite({ seances, aujourdhui = new Date(), semaines = 12 } = {}) {
  const fin = dateIsoLocale(aujourdhui);
  const debut = decalerJour(lundiDe(fin), -(semaines - 1) * 7);
  const dates = [...new Set(seances.map((s) => String(s.start_date_local).slice(0, 10)).filter((d) => d >= debut && d <= fin))].sort();

  const vide = (titre, texte) => ({ id: 'regularite', insuffisant: true, verdict: { niveau: 'info', titre, texte }, chiffres: [], graphiques: [], lectures: [], conseils: [], methode: METHODE });
  if (!dates.length) return vide('Aucune séance sur la période', `Tu n'as aucune séance sur les ${semaines} dernières semaines. Choisis une période plus longue pour voir plus loin, ou reprends : l'analyse se remplit toute seule.`);
  if (dates.length < 4) return vide('Pas encore assez de séances', 'Il faut au moins 4 jours d\'entraînement sur la période pour juger ta régularité. Continue, l\'analyse se remplit toute seule.');

  // Jours actifs par semaine civile
  const parSemaine = [];
  for (let i = 0; i < semaines; i++) parSemaine.push({ iso: decalerJour(debut, i * 7), jours: 0 });
  const index = new Map(parSemaine.map((w) => [w.iso, w]));
  for (const d of dates) index.get(lundiDe(d)).jours += 1;
  const finie = jourDeSemaine(fin) === 6;
  const pleines = finie ? parSemaine : parSemaine.slice(0, -1);
  const courante = parSemaine[parSemaine.length - 1];
  const premiere = pleines.length ? pleines : parSemaine;

  const moyenneHebdo = moyenne(premiere.map((w) => w.jours));
  const tenues = premiere.filter((w) => w.jours >= CIBLE).length;
  const pct = Math.round((tenues / premiere.length) * 100);
  const vides = premiere.filter((w) => w.jours === 0).length;
  const sansRepos = premiere.filter((w) => w.jours >= 6).length;

  // Série de semaines tenues (en cours et meilleure)
  let enCours = 0;
  for (let i = premiere.length - 1; i >= 0 && premiere[i].jours >= CIBLE; i--) enCours += 1;
  let meilleure = 0;
  let courant = 0;
  for (const w of premiere) {
    courant = w.jours >= CIBLE ? courant + 1 : 0;
    meilleure = Math.max(meilleure, courant);
  }

  // Pauses : plus longue entre deux séances, et pause en cours (depuis la dernière séance)
  let pauseMax = 0;
  let pauseApres = '';
  for (let i = 1; i < dates.length; i++) {
    const trou = ecartJours(dates[i - 1], dates[i]) - 1;
    if (trou > pauseMax) {
      pauseMax = trou;
      pauseApres = dates[i - 1];
    }
  }
  const pauseEnCours = ecartJours(dates[dates.length - 1], fin);
  if (pauseEnCours > pauseMax) {
    pauseMax = pauseEnCours;
    pauseApres = dates[dates.length - 1];
  }

  // Tendance : les dernières semaines complètes contre celles d'avant
  const n = Math.min(4, Math.floor(premiere.length / 2));
  const ecart = n >= 2 ? moyenne(premiere.slice(-n).map((w) => w.jours)) - moyenne(premiere.slice(-2 * n, -n).map((w) => w.jours)) : null;

  // Jours de la semaine
  const parJour = new Array(7).fill(0);
  for (const d of dates) parJour[jourDeSemaine(d)] += 1;
  const weekend = dates.length ? (parJour[5] + parJour[6]) / dates.length : 0;
  const prefere = parJour.indexOf(Math.max(...parJour));

  let verdict;
  if (pauseEnCours >= 14) verdict = { niveau: 'attention', titre: 'Tu as décroché', texte: `Aucune séance depuis ${pauseEnCours} jours (la dernière date du ${formatDateCourte(dates[dates.length - 1])}). Reprends doucement : une séance courte suffit pour relancer la machine.` };
  else if (pct >= 25 && sansRepos >= 2 && sansRepos >= tenues * 0.6) verdict = { niveau: 'info', titre: 'Régulier, mais sans repos', texte: `Tu t'entraînes presque tous les jours : ${pluriel(sansRepos, 'semaine')} sur ${premiere.length} sans vrai jour de repos. La régularité est là, la récupération manque.` };
  else if (pct >= 75) verdict = { niveau: 'ok', titre: 'Très régulier', texte: `${tenues} semaines sur ${premiere.length} à ${CIBLE} jours d'entraînement ou plus : tu tiens un rythme solide.` };
  else if (pct >= 50) verdict = { niveau: 'ok', titre: 'Plutôt régulier', texte: `${tenues} semaines sur ${premiere.length} à ${CIBLE} jours ou plus. Quelques semaines plus creuses, mais le rythme est là.` };
  else if (pct >= 25) verdict = { niveau: 'info', titre: 'Irrégulier', texte: `Seulement ${tenues} semaines sur ${premiere.length} atteignent ${CIBLE} jours d'entraînement. La progression est plus lente quand le rythme saute.` };
  else verdict = { niveau: 'attention', titre: 'Peu régulier', texte: `${tenues} semaine${tenues > 1 ? 's' : ''} sur ${premiere.length} seulement à ${CIBLE} jours ou plus. Mieux vaut des séances courtes mais fréquentes que de grosses séances espacées.` };

  const chiffres = [
    { etiquette: 'Jours d\'entraînement', valeur: String(dates.length), unite: '', note: `sur ${semaines} semaines` },
    { etiquette: 'Moyenne par semaine', valeur: virgule(moyenneHebdo), unite: 'jours', note: moyenneHebdo >= CIBLE ? `au-dessus de la cible de ${CIBLE}` : `sous la cible de ${CIBLE}`, ton: moyenneHebdo >= CIBLE ? 'ok' : 'alerte' },
    { etiquette: 'Semaines tenues', valeur: String(pct), unite: '%', note: `${tenues} sur ${premiere.length} (${CIBLE} jours ou plus)`, ton: pct >= 50 ? 'ok' : 'alerte' },
    { etiquette: 'Série en cours', valeur: String(enCours), unite: enCours > 1 ? 'semaines' : 'semaine', note: `ta meilleure : ${meilleure}` },
    { etiquette: 'Plus longue pause', valeur: String(pauseMax), unite: pauseMax > 1 ? 'jours' : 'jour', note: pauseMax ? `après le ${formatDateCourte(pauseApres)}` : 'aucune', ton: pauseMax >= 14 ? 'alerte' : '' },
    { etiquette: 'Cette semaine', valeur: String(courante.jours), unite: courante.jours > 1 ? 'jours' : 'jour', note: finie ? 'semaine terminée' : 'en cours' },
  ];

  // Le calendrier : la même carte de chaleur que le widget, sur la période choisie
  const sportsVus = [...new Set(seances.filter((s) => String(s.start_date_local).slice(0, 10) >= debut).map((s) => familleAffichage(s.sport)))];
  const graphiques = [
    {
      type: 'chaleur',
      titre: 'Ton calendrier',
      description: 'Une case par jour, une colonne par semaine (la dernière est la semaine en cours), du lundi en haut au dimanche en bas. La couleur est le sport ; plus elle est franche, plus la séance est chargée.',
      cases: casesRegularite(seances, semaines, aujourdhui),
      colonnes: semaines,
      sports: sportsVus.map((f) => ({ nom: (SPORTS[f] || SPORTS.autre).court, couleur: couleurSport(f) })),
    },
    {
      type: 'lignes',
      titre: 'Jours d\'entraînement par semaine',
      description: `Le nombre de jours où tu t'es entraîné, semaine après semaine. La zone verte marque le rythme régulier : de ${CIBLE} à 5 jours.`,
      etiquettes: premiere.map((w) => w.iso),
      series: [{ nom: 'Jours actifs', couleur: 'var(--texte)', valeurs: premiere.map((w) => w.jours) }],
      bandes: [{ de: CIBLE, a: 5, couleur: 'var(--ok)', libelle: 'Rythme régulier' }],
      min: 0,
      max: 7,
    },
    {
      type: 'tableau',
      titre: 'Tes jours de la semaine',
      description: 'Sur quels jours tu t\'entraînes le plus souvent.',
      colonnes: ['Jour', 'Séances', 'Part'],
      lignes: JOURS.map((nom, i) => [nom, String(parJour[i]), `${Math.round((parJour[i] / dates.length) * 100)} %`]),
    },
  ];

  const lectures = [
    `${pluriel(dates.length, 'jour')} d'entraînement sur ${semaines} semaines, soit ${virgule(moyenneHebdo)} par semaine.`,
    `${tenues} semaine${tenues > 1 ? 's' : ''} sur ${premiere.length} ${tenues > 1 ? 'atteignent' : 'atteint'} ${CIBLE} jours ou plus${vides ? `, et ${pluriel(vides, 'semaine')} sans aucune séance` : ''}.`,
    `Ta pause la plus longue dure ${pluriel(pauseMax, 'jour')}${pauseMax ? ` (après le ${formatDateCourte(pauseApres)})` : ''}.`,
    `Ton jour préféré : ${JOURS[prefere].toLowerCase()} (${parJour[prefere]} séance${parJour[prefere] > 1 ? 's' : ''}).`,
  ];
  if (ecart != null && Math.abs(ecart) >= 0.5) lectures.push(`Sur les ${n} dernières semaines complètes, tu t'entraînes ${virgule(Math.abs(ecart))} jour${Math.abs(ecart) >= 1.5 ? 's' : ''} par semaine de ${ecart > 0 ? 'plus' : 'moins'} qu'avant.`);

  const conseils = [];
  if (pauseEnCours >= 10) conseils.push({ priorite: 'haute', titre: 'Reprends dès cette semaine', texte: `Tu n'as rien fait depuis ${pauseEnCours} jours. Une séance courte et facile (20 à 30 minutes) relance l'habitude plus sûrement qu'un grand retour dans une semaine.` });
  if (pct < 50) conseils.push({ priorite: 'moyenne', titre: `Vise ${CIBLE} jours par semaine`, texte: `Bloque ${CIBLE} créneaux fixes dans ta semaine, même courts. La régularité compte plus que la durée de chaque séance.` });
  if (vides >= 2) conseils.push({ priorite: 'moyenne', titre: 'Évite les semaines blanches', texte: `${pluriel(vides, 'semaine')} sans aucune séance. Une séance minimale (même 20 minutes) suffit à garder le fil.` });
  if (ecart != null && ecart <= -1) conseils.push({ priorite: 'moyenne', titre: 'Ton rythme baisse', texte: 'Tu t\'entraînes moins souvent qu\'il y a quelques semaines. Si ce n\'est pas voulu, remets un créneau fixe et regarde ce qui t\'a fait décrocher.' });
  if (sansRepos >= 2) conseils.push({ priorite: 'moyenne', titre: 'Garde un jour de repos', texte: `${pluriel(sansRepos, 'semaine')} avec 6 ou 7 jours d'entraînement. Un jour sans séance par semaine laisse le corps assimiler le travail.` });
  if (weekend >= 0.6 && dates.length >= 8) conseils.push({ priorite: 'faible', titre: 'Répartis tes séances', texte: `${Math.round(weekend * 100)} % de tes séances tombent le week-end. Une séance en semaine rend le rythme plus stable et la charge mieux répartie.` });
  if (!conseils.length) conseils.push({ priorite: 'info', titre: 'Continue comme ça', texte: 'Ton rythme est régulier et tu gardes des jours de repos. Le levier suivant : la qualité de tes séances (voir les analyses de charge et de forme).' });

  return { id: 'regularite', insuffisant: false, verdict, chiffres, graphiques, lectures, conseils: triConseils(conseils), methode: METHODE, brut: { parSemaine, tenues, pct, moyenneHebdo, vides, sansRepos, pauseMax, pauseEnCours, enCours, meilleure, parJour, ecart } };
}
