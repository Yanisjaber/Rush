// Analyses de musculation : tonnage et régularité, équilibre entre groupes musculaires, records et plateaux.
// Tout est déduit des séries du carnet de force (table strength_sets). Fonctions pures, sans réseau ni écran.
// Même format de sortie que les autres analyses : { verdict, chiffres, graphiques, lectures, conseils, methode }.
import { GROUPES, ORDRE_GROUPES, groupeValide } from '../data/exercices.js';
import { tonnageSerie, progressionParExercice, unRmEstime } from '../data/force.js';
import { dateIsoLocale, formatDateCourte, formatKg, formatNombre } from '../utils/format.js';
import { rushTonnage } from './rush-tonnage.js';
import { moyenne, arrondi, decalerJour, lundiDe, ecartJours, regression } from './maths.js';

const ORDRE = { haute: 0, moyenne: 1, faible: 2, info: 3 };
const virgule = (v, n = 1) => String(arrondi(v, n)).replace('.', ',');
const iso = (s) => String(s.date).slice(0, 10);
const sansPluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Séries exploitables (passées, avec au moins une répétition) et jour de fin de l'analyse : toujours aujourd'hui. */
function reperes(series, aujourdhui) {
  const fin = dateIsoLocale(aujourdhui);
  const valides = series.filter((s) => iso(s) <= fin && Number(s.reps) > 0);
  return { valides, fin };
}

const triConseils = (c) => c.sort((a, b) => ORDRE[a.priorite] - ORDRE[b.priorite]);

function vide(id, titre, texte, methode) {
  return { id, insuffisant: true, verdict: { niveau: 'info', titre, texte }, chiffres: [], graphiques: [], lectures: [], conseils: [], methode };
}

// ---------------------------------------------------------------------------------------------------------------------
// 1. Tonnage et régularité
// ---------------------------------------------------------------------------------------------------------------------

const METHODE_TONNAGE = [
  { titre: 'Le tonnage', texte: 'Pour chaque série : répétitions × charge (en kg). On additionne par semaine civile (du lundi au dimanche). Les exercices au poids du corps (charge nulle) comptent dans les séries et les séances, mais pas dans le tonnage.' },
  { titre: 'La tendance', texte: 'On compare la moyenne des 4 dernières semaines complètes à celle des 4 semaines d\'avant (moins si tu as peu d\'historique). La semaine en cours n\'est pas comptée : elle n\'est pas finie.' },
  { titre: 'Les repères', texte: 'Une hausse de plus de 30 % d\'une semaine à l\'autre est signalée : c\'est un repère courant de prudence pour ne pas monter trop vite, pas une loi. Une baisse brève peut être voulue (semaine de décharge).' },
];

export function analyserTonnage({ series, aujourdhui = new Date(), semaines = 26 }) {
  const { valides, fin } = reperes(series, aujourdhui);
  const debut = decalerJour(lundiDe(fin), -(semaines - 1) * 7);
  const semainesListe = [];
  for (let i = 0; i < semaines; i++) semainesListe.push({ iso: decalerJour(debut, i * 7), tonnage: 0, series: 0, jours: new Set() });
  const parLundi = new Map(semainesListe.map((w) => [w.iso, w]));
  for (const s of valides) {
    if (iso(s) < debut || iso(s) > fin) continue;
    const w = parLundi.get(lundiDe(iso(s)));
    if (!w) continue;
    w.tonnage += tonnageSerie(s);
    w.series += 1;
    w.jours.add(iso(s));
  }
  for (const w of semainesListe) w.tonnage = Math.round(w.tonnage);

  const joursTotal = new Set(semainesListe.flatMap((w) => [...w.jours])).size;
  if (joursTotal < 4) {
    return vide('tonnage', 'Pas encore assez de séances', 'Il faut au moins 4 séances de muscu enregistrées sur la période pour analyser ton volume. Enregistre tes séances (ou importe ton export Hevy), l\'analyse se remplit toute seule.', METHODE_TONNAGE);
  }

  // La dernière semaine n'est comptée dans les tendances que si elle est terminée (fin = dimanche)
  const finie = new Date(`${fin}T12:00:00`).getDay() === 0;
  const pleines = finie ? semainesListe : semainesListe.slice(0, -1);
  const n = Math.min(4, Math.floor(pleines.length / 2));
  const recent = n >= 2 ? moyenne(pleines.slice(-n).map((w) => w.tonnage)) : null;
  const avant = n >= 2 ? moyenne(pleines.slice(-2 * n, -n).map((w) => w.tonnage)) : null;
  const ecartPct = recent != null && avant > 0 ? Math.round(((recent - avant) / avant) * 100) : null;

  const actives = semainesListe.filter((w) => w.tonnage > 0);
  const moyenneHebdo = Math.round(moyenne(actives.map((w) => w.tonnage)));
  const meilleure = semainesListe.reduce((m, w) => (w.tonnage > m.tonnage ? w : m), semainesListe[0]);
  const premiere = semainesListe.findIndex((w) => w.jours.size > 0);
  const apresDebut = pleines.slice(Math.max(0, premiere));
  const trous = apresDebut.filter((w) => w.jours.size === 0).length;
  const seancesParSemaine = apresDebut.length ? moyenne(apresDebut.map((w) => w.jours.size)) : 0;
  const sauts = apresDebut.filter((w, i) => i > 0 && apresDebut[i - 1].tonnage > 0 && w.tonnage > apresDebut[i - 1].tonnage * 1.3).length;
  const courante = semainesListe[semainesListe.length - 1];

  let verdict;
  if (ecartPct == null) verdict = { niveau: 'info', titre: `${formatNombre(moyenneHebdo)} kg par semaine`, texte: `Tu soulèves en moyenne ${formatNombre(moyenneHebdo)} kg par semaine d'entraînement. Il faudra quelques semaines de plus pour dégager une tendance.` };
  else if (ecartPct > 30) verdict = { niveau: 'attention', titre: 'Ton volume grimpe vite', texte: `Ton tonnage des ${n} dernières semaines est ${ecartPct} % au-dessus des ${n} précédentes. Monter aussi vite fatigue les tendons et les articulations plus vite que les muscles.` };
  else if (ecartPct > 10) verdict = { niveau: 'ok', titre: 'Ton volume monte', texte: `+${ecartPct} % de tonnage sur les ${n} dernières semaines par rapport aux ${n} d'avant : une progression régulière.` };
  else if (ecartPct >= -10) verdict = { niveau: 'ok', titre: 'Ton volume est stable', texte: `Ton tonnage varie de ${ecartPct > 0 ? '+' : ''}${ecartPct} % entre les ${n} dernières semaines et les ${n} d'avant : tu tiens un rythme constant.` };
  else if (ecartPct >= -40) verdict = { niveau: 'info', titre: 'Ton volume baisse', texte: `${ecartPct} % de tonnage sur les ${n} dernières semaines. Si c'est une semaine de décharge voulue, c'est normal ; sinon regarde ce qui t'a freiné.` };
  else verdict = { niveau: 'attention', titre: 'Ton volume s\'effondre', texte: `${ecartPct} % de tonnage sur les ${n} dernières semaines : tu t'entraînes beaucoup moins qu'avant.` };

  const chiffres = [
    { etiquette: 'Cette semaine', valeur: formatNombre(courante.tonnage), unite: 'kg', note: `${sansPluriel(courante.jours.size, 'séance')}, ${sansPluriel(courante.series, 'série')}` },
    { etiquette: 'Moyenne par semaine', valeur: formatNombre(moyenneHebdo), unite: 'kg', note: `sur ${sansPluriel(actives.length, 'semaine')} d'entraînement` },
    { etiquette: 'Meilleure semaine', valeur: formatNombre(meilleure.tonnage), unite: 'kg', note: `semaine du ${formatDateCourte(meilleure.iso)}` },
    { etiquette: 'Séances par semaine', valeur: virgule(seancesParSemaine), unite: '', note: seancesParSemaine >= 2 ? 'un bon rythme' : 'sous les 2 séances conseillées', ton: seancesParSemaine >= 2 ? 'ok' : 'alerte' },
  ];
  if (ecartPct != null) chiffres.push({ etiquette: 'Tendance', valeur: `${ecartPct > 0 ? '+' : ''}${ecartPct}`, unite: '%', note: `${n} dernières semaines vs ${n} d'avant`, ton: ecartPct > 30 || ecartPct < -40 ? 'alerte' : '' });

  const graphiques = [
    {
      type: 'lignes',
      titre: 'Tonnage par semaine',
      description: 'Le tonnage soulevé chaque semaine (kg). La ligne en pointillés est ta moyenne sur les semaines où tu t\'es entraîné.',
      etiquettes: semainesListe.map((w) => w.iso),
      series: [
        { nom: 'Tonnage', couleur: 'var(--sport-muscu)', valeurs: semainesListe.map((w) => w.tonnage) },
        { nom: 'Moyenne', couleur: 'var(--texte-doux)', pointille: true, valeurs: semainesListe.map(() => moyenneHebdo) },
      ],
      min: 0,
    },
  ];

  const lectures = [
    `Tu as fait ${sansPluriel(joursTotal, 'séance')} de muscu sur ${semaines} semaines, soit ${virgule(seancesParSemaine)} par semaine d'entraînement.`,
    `Ta meilleure semaine pèse ${formatNombre(meilleure.tonnage)} kg (semaine du ${formatDateCourte(meilleure.iso)}), ta moyenne ${formatNombre(moyenneHebdo)} kg.`,
  ];
  if (trous > 0) lectures.push(`${sansPluriel(trous, 'semaine')} sans aucune séance depuis ta première séance de la période.`);
  if (sauts > 0) lectures.push(`${sauts > 1 ? `${sauts} fois` : 'Une fois'}, ton tonnage a grimpé de plus de 30 % d'une semaine à l'autre.`);

  const conseils = [];
  if (ecartPct != null && ecartPct > 30) conseils.push({ priorite: 'haute', titre: 'Freine un peu la montée', texte: 'Garde ton volume à +10 ou +20 % maximum par semaine, et prévois une semaine plus légère après 3 ou 4 semaines de hausse.' });
  if (ecartPct != null && ecartPct < -40) conseils.push({ priorite: 'moyenne', titre: 'Reprends progressivement', texte: 'Si tu as fait une pause, repars à 60 ou 70 % de ton volume habituel et remonte sur 3 ou 4 semaines.' });
  if (trous >= 2) conseils.push({ priorite: 'moyenne', titre: 'Évite les semaines blanches', texte: `Tu as sauté ${sansPluriel(trous, 'semaine')} complète${trous > 1 ? 's' : ''}. Même une séance courte garde le rythme : mieux vaut 2 séances modestes qu'une grosse puis rien.` });
  if (seancesParSemaine < 2) conseils.push({ priorite: 'moyenne', titre: 'Vise 2 séances par semaine', texte: 'Deux séances par semaine suffisent déjà pour progresser en force : c\'est le seuil à tenir avant de chercher plus.' });
  if (sauts >= 2) conseils.push({ priorite: 'faible', titre: 'Lisse tes semaines', texte: 'Des semaines très inégales rendent la progression difficile à lire. Garde un nombre de séries proche d\'une semaine à l\'autre.' });
  if (!conseils.length) conseils.push({ priorite: 'info', titre: 'Continue comme ça', texte: 'Ton volume est régulier et ton rythme tient. Le levier suivant : progresser en charge sur tes exercices principaux (voir l\'analyse des records).' });

  return { id: 'tonnage', insuffisant: false, verdict, chiffres, graphiques, lectures, conseils: triConseils(conseils), methode: METHODE_TONNAGE, rush: rushTonnage({ pleines, valides, debut, fin }), brut: { semaines: semainesListe, ecartPct, moyenneHebdo, trous, sauts } };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Équilibre entre groupes musculaires
// ---------------------------------------------------------------------------------------------------------------------

const SEMAINES_GROUPES = 4;
const METHODE_GROUPES = [
  { titre: 'Les séries par semaine', texte: `On compte les séries (hors échauffement non enregistré) de chaque groupe sur les ${SEMAINES_GROUPES} dernières semaines, puis on divise par ${SEMAINES_GROUPES}. La zone visée vient des repères courants de volume hebdomadaire : 10 à 20 séries pour les gros groupes (pectoraux, dos, jambes), un peu moins pour les épaules, les bras et le tronc.` },
  { titre: 'Dos et pectoraux', texte: 'Le dos devrait recevoir au moins autant de séries que les pectoraux (rapport d\'au moins 0,8) : un déséquilibre vers les pectoraux arrondit les épaules avec le temps.' },
  { titre: 'Les jambes', texte: 'Les jambes sont les plus gros muscles du corps : elles devraient représenter environ 25 à 35 % de tes séries. En dessous de 20 %, on parle de jambes oubliées.' },
];

// Teintes du muscu pour la répartition : la couleur désigne le sport, pas le groupe, donc on nuance une seule couleur
// « du volume des jambes », « du volume du dos » : l'article dépend du groupe
const DE = { pectoraux: 'des pectoraux', dos: 'du dos', jambes: 'des jambes', epaules: 'des épaules', bras: 'des bras', tronc: 'du tronc' };

const TEINTES = [100, 82, 66, 52, 38, 26];
const teinte = (i) => `color-mix(in srgb, var(--sport-muscu) ${TEINTES[i % TEINTES.length]}%, var(--surface-2))`;

export function analyserGroupes({ series, aujourdhui = new Date() }) {
  const { valides, fin } = reperes(series, aujourdhui);
  const debut = decalerJour(fin, -(SEMAINES_GROUPES * 7 - 1));
  const fenetre = valides.filter((s) => iso(s) >= debut && iso(s) <= fin && groupeValide(s.muscle_group));
  const compte = Object.fromEntries(ORDRE_GROUPES.map((g) => [g, 0]));
  for (const s of fenetre) compte[s.muscle_group] += 1;
  const total = fenetre.length;
  const jours = new Set(fenetre.map(iso)).size;
  if (total < 20 || jours < 4) {
    return vide('groupes', 'Pas encore assez de séries', `Il faut au moins 4 séances et 20 séries sur les ${SEMAINES_GROUPES} dernières semaines pour juger l'équilibre de ton entraînement. Enregistre quelques séances de plus.`, METHODE_GROUPES);
  }

  const groupes = ORDRE_GROUPES.map((g, i) => {
    const parSemaine = compte[g] / SEMAINES_GROUPES;
    const [bas, haut] = GROUPES[g].cible;
    const etat = compte[g] === 0 ? 'oublie' : parSemaine < bas ? 'sous' : parSemaine > haut ? 'au-dessus' : 'zone';
    return { groupe: g, nom: GROUPES[g].nom, series: compte[g], parSemaine, cible: [bas, haut], etat, part: Math.round((compte[g] / total) * 100), couleur: teinte(i) };
  });
  const oublies = groupes.filter((g) => g.etat === 'oublie');
  const sous = groupes.filter((g) => g.etat === 'sous');
  const manques = [...oublies, ...sous];
  const dessus = groupes.filter((g) => g.etat === 'au-dessus');
  const liste = (t) => t.map((g) => g.nom.toLowerCase()).join(', ');
  const parSemaineTotal = total / SEMAINES_GROUPES;
  const pectoraux = compte.pectoraux;
  const rapportDos = pectoraux > 0 ? compte.dos / pectoraux : null;
  const partJambes = Math.round((compte.jambes / total) * 100);
  const plusTravaille = groupes.reduce((m, g) => (g.series > m.series ? g : m), groupes[0]);
  const moinsTravaille = groupes.reduce((m, g) => (g.series < m.series ? g : m), groupes[0]);

  let verdict;
  if (!manques.length && !dessus.length) verdict = { niveau: 'ok', titre: 'Tous tes groupes sont dans la zone', texte: `Chaque groupe musculaire reçoit le volume visé : ton entraînement est bien réparti.` };
  else if (manques.length >= 3) verdict = { niveau: 'attention', titre: 'Ton entraînement est déséquilibré', texte: `Plusieurs groupes sont sous la zone visée : ${liste(manques)}. Le groupe le plus travaillé est ${plusTravaille.nom.toLowerCase()}, à ${virgule(plusTravaille.parSemaine)} séries par semaine.` };
  else if (manques.length) verdict = { niveau: 'info', titre: `Il te manque du volume : ${liste(manques)}`, texte: `${manques.length > 1 ? 'Ces groupes sont' : 'Ce groupe est'} sous la zone visée sur les ${SEMAINES_GROUPES} dernières semaines.` };
  else verdict = { niveau: 'info', titre: `Beaucoup de volume sur ${liste(dessus)}`, texte: `${dessus.length > 1 ? 'Ces groupes dépassent' : 'Ce groupe dépasse'} la zone visée : au-delà, la récupération devient le facteur limitant.` };

  const chiffres = [
    { etiquette: 'Séries par semaine', valeur: virgule(parSemaineTotal), unite: '', note: `${sansPluriel(total, 'série')} en ${SEMAINES_GROUPES} semaines` },
    { etiquette: 'Le plus travaillé', valeur: plusTravaille.nom, unite: '', note: `${virgule(plusTravaille.parSemaine)} séries par semaine` },
    { etiquette: 'Le moins travaillé', valeur: moinsTravaille.nom, unite: '', note: `${virgule(moinsTravaille.parSemaine)} séries par semaine`, ton: moinsTravaille.etat === 'zone' ? '' : 'alerte' },
    { etiquette: 'Part des jambes', valeur: String(partJambes), unite: '%', note: partJambes >= 20 ? 'au-dessus du seuil de 20 %' : 'sous le seuil de 20 %', ton: partJambes >= 20 ? 'ok' : 'alerte' },
  ];
  if (rapportDos != null) chiffres.push({ etiquette: 'Dos / pectoraux', valeur: virgule(rapportDos, 2), unite: '', note: rapportDos >= 0.8 ? 'équilibré' : 'dos en retard', ton: rapportDos >= 0.8 ? 'ok' : 'alerte' });

  const NOM_ETAT = { oublie: 'Oublié', sous: 'Sous la zone', zone: 'Dans la zone', 'au-dessus': 'Au-dessus' };
  const graphiques = [
    {
      type: 'repartition',
      titre: 'Répartition de tes séries',
      description: `La part de chaque groupe dans tes séries des ${SEMAINES_GROUPES} dernières semaines.`,
      segments: groupes.map((g) => ({ nom: g.nom, valeur: g.part, couleur: g.couleur })),
    },
    {
      type: 'tableau',
      titre: 'Séries par semaine et zone visée',
      description: 'Moyenne par semaine sur la période, comparée à la zone visée de chaque groupe.',
      colonnes: ['Groupe', 'Séries / semaine', 'Zone visée', 'État'],
      lignes: groupes.map((g) => [g.nom, virgule(g.parSemaine), `${g.cible[0]} à ${g.cible[1]}`, NOM_ETAT[g.etat]]),
    },
  ];

  const lectures = [`Sur les ${SEMAINES_GROUPES} dernières semaines : ${sansPluriel(total, 'série')} en ${sansPluriel(jours, 'séance')}, soit ${virgule(parSemaineTotal)} séries par semaine.`];
  if (rapportDos != null) lectures.push(`Tu fais ${virgule(rapportDos, 2)} série de dos pour 1 de pectoraux${rapportDos < 0.8 ? ' : le dos est en retard' : ''}.`);
  lectures.push(`Les jambes représentent ${partJambes} % de tes séries.`);
  if (dessus.length) lectures.push(`Au-dessus de la zone : ${liste(dessus)}.`);

  const conseils = [];
  for (const g of oublies) conseils.push({ priorite: 'haute', titre: `Ajoute du volume ${DE[g.groupe]}`, texte: `Aucune série de ${g.nom.toLowerCase()} sur ${SEMAINES_GROUPES} semaines. Commence par ${g.cible[0]} séries par semaine, réparties sur 2 séances.` });
  for (const g of sous) conseils.push({ priorite: 'moyenne', titre: `Monte le volume ${DE[g.groupe]}`, texte: `Tu es à ${virgule(g.parSemaine)} séries par semaine pour une zone de ${g.cible[0]} à ${g.cible[1]}. Ajoute 2 ou 3 séries par semaine, pas plus d'un coup.` });
  if (rapportDos != null && rapportDos < 0.8) conseils.push({ priorite: 'moyenne', titre: 'Rééquilibre dos et pectoraux', texte: 'Ajoute des tirages (rowing, tractions) ou retire quelques séries de pectoraux, pour tendre vers autant de dos que de pectoraux.' });
  if (partJambes < 20 && compte.jambes > 0) conseils.push({ priorite: 'moyenne', titre: 'Donne plus de place aux jambes', texte: 'Elles sont sous 20 % de tes séries. Un squat ou une presse en plus, chaque semaine, rééquilibre vite.' });
  for (const g of dessus) conseils.push({ priorite: 'faible', titre: `Beaucoup de volume ${DE[g.groupe]}`, texte: `${virgule(g.parSemaine)} séries par semaine, au-dessus de ${g.cible[1]}. Si tu stagnes sur ce groupe, c'est peut-être la récupération qui limite, pas le volume.` });
  if (!conseils.length) conseils.push({ priorite: 'info', titre: 'Garde cet équilibre', texte: 'Ton volume est bien réparti. Continue, et surveille que ça tienne quand ton programme change.' });

  return { id: 'groupes', insuffisant: false, verdict, chiffres, graphiques, lectures, conseils: triConseils(conseils), methode: METHODE_GROUPES, brut: { groupes, rapportDos, partJambes } };
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Records et plateaux
// ---------------------------------------------------------------------------------------------------------------------

const METHODE_RECORDS = [
  { titre: 'Le 1RM estimé', texte: 'Le 1RM est la charge que tu soulèverais une seule fois. On l\'estime avec la formule d\'Epley : charge × (1 + répétitions ÷ 30), sur la meilleure série de chaque séance. Au-delà de 12 répétitions l\'estimation n\'est plus fiable : ces séries sont ignorées.' },
  { titre: 'Record, plateau, progression', texte: 'Record : meilleur 1RM atteint il y a moins de 4 semaines. Plateau : au moins 4 séances sur les 8 dernières semaines sans aucun nouveau record depuis plus de 8 semaines. Progression : la courbe des 6 dernières séances monte.' },
  { titre: 'Les données prises en compte', texte: 'Les records sont cherchés dans tout ton historique : il n\'y a pas de période à choisir. Les chiffres du haut et les statuts ne portent que sur les exercices pratiqués au moins 3 fois (avec de la charge) ; le menu et l\'historique proposent tous tes exercices.' },
];

export function analyserRecords({ series, aujourdhui = new Date(), semaines = 26 }) {
  const { valides, fin } = reperes(series, aujourdhui);
  const debut = decalerJour(lundiDe(fin), -(semaines - 1) * 7);
  // Tous les exercices (même faits une seule fois : le menu et l'historique les proposent, la carte du widget d'accueil aussi)
  const tous = progressionParExercice(valides)
    .map((e) => {
      const dansFenetre = e.serie.filter((p) => p.date >= debut && p.date <= fin);
      const meilleur = e.serie.reduce((m, p) => (p.rm > m.rm ? p : m), e.serie[0]); // 1re date où le meilleur 1RM est atteint
      const joursRecord = ecartJours(meilleur.date, fin);
      const recentes = e.serie.filter((p) => p.date >= decalerJour(fin, -56));
      const six = e.serie.slice(-6);
      const pente = six.length >= 3 ? regression(six.map((p) => p.rm)).pente : 0;
      let statut = 'stable';
      if (joursRecord <= 28) statut = 'record';
      else if (recentes.length >= 4 && joursRecord > 56) statut = 'plateau';
      else if (pente > 0.4) statut = 'progres';
      return { ...e, dansFenetre, meilleur, joursRecord, statut };
    })
    .sort((a, b) => b.dansFenetre.length - a.dansFenetre.length);
  // Les statuts, les chiffres du haut et les lectures ne portent que sur les exercices assez pratiqués (au moins 3 séances)
  const exos = tous.filter((e) => e.dansFenetre.length >= 3);
  if (!exos.length) {
    return vide('records', 'Pas encore assez de séances par exercice', 'Il faut au moins 3 séances d\'un même exercice (avec de la charge, jusqu\'à 12 répétitions) pour suivre ta progression. Continue, l\'analyse se remplit toute seule.', METHODE_RECORDS);
  }

  const suivis = exos.slice(0, 6);
  const records = suivis.filter((e) => e.statut === 'record');
  const plateaux = suivis.filter((e) => e.statut === 'plateau');
  const progres = suivis.filter((e) => e.statut === 'progres');
  const gain = (e) => e.dansFenetre[e.dansFenetre.length - 1].rm - e.dansFenetre[0].rm;
  const meilleurGain = suivis.reduce((m, e) => (gain(e) > gain(m) ? e : m), suivis[0]);
  const plusLourd = suivis.reduce((m, e) => (e.meilleurRm > m.meilleurRm ? e : m), suivis[0]);

  let verdict;
  if (records.length) verdict = { niveau: 'ok', titre: records.length > 1 ? `${records.length} records battus récemment` : 'Un record battu récemment', texte: `${records.map((e) => `${e.nom} (${formatKg(e.meilleurRm)} kg)`).join(', ')} : tu as battu ${records.length > 1 ? 'tes records' : 'ton record'} ces 4 dernières semaines.` };
  else if (plateaux.length) verdict = { niveau: 'attention', titre: plateaux.length > 1 ? `${plateaux.length} exercices stagnent` : 'Un exercice stagne', texte: `${plateaux.map((e) => e.nom).join(', ')} : aucun record depuis plus de 8 semaines malgré des séances régulières.` };
  else if (progres.length) verdict = { niveau: 'ok', titre: 'Tu progresses', texte: `Pas de record ces 4 dernières semaines, mais la courbe monte sur ${progres.map((e) => e.nom).join(', ')}.` };
  else verdict = { niveau: 'info', titre: 'Tes charges sont stables', texte: `Pas de record récent, pas de stagnation inquiétante : tes charges tiennent. Pour repartir à la hausse, vois les conseils ci-dessous.` };

  const chiffres = [
    { etiquette: 'Records récents', valeur: String(records.length), unite: '', note: '4 dernières semaines', ton: records.length ? 'ok' : '' },
    { etiquette: 'Exercices suivis', valeur: String(suivis.length), unite: '', note: 'pratiqués au moins 3 fois' },
    { etiquette: '1RM le plus haut', valeur: formatKg(plusLourd.meilleurRm), unite: 'kg', note: plusLourd.nom },
    { etiquette: 'Plus gros progrès', valeur: `${gain(meilleurGain) >= 0 ? '+' : ''}${formatKg(gain(meilleurGain))}`, unite: 'kg', note: `${meilleurGain.nom}, depuis ta première séance` },
  ];
  if (plateaux.length) chiffres.push({ etiquette: 'Exercices en plateau', valeur: String(plateaux.length), unite: '', note: 'sans record depuis 8 semaines', ton: 'alerte' });

  // Un seul bloc : des onglets pour choisir le groupe musculaire, un menu pour choisir l'exercice du groupe (le plus pratiqué est proposé d'abord).
  // Un point par séance (meilleur 1RM estimé du jour) : pas de trou quand on saute des semaines.
  // Historique : toutes les séances où l'exercice a été fait (la plus récente d'abord), avec TOUTES les séries (même sans charge).
  const historiqueDe = (e) => {
    const parJour = new Map();
    for (const s of valides) {
      if (s.exercise_key !== e.cle) continue;
      if (!parJour.has(iso(s))) parJour.set(iso(s), []);
      parJour.get(iso(s)).push(s);
    }
    return [...parJour.entries()]
      .map(([date, lignes]) => {
        const series = lignes.sort((a, b) => (Number(a.set_no) || 0) - (Number(b.set_no) || 0)).map((l) => ({ reps: Number(l.reps), poids: Number(l.weight_kg) || 0 }));
        const rms = lignes.map((l) => unRmEstime(l.weight_kg, l.reps)).filter((v) => v != null);
        const id = lignes.map((l) => l.activity_id).find(Boolean) || null; // la séance (activité) à ouvrir au clic, s'il y en a une
        return { id, date, series, tonnage: Math.round(lignes.reduce((t, l) => t + tonnageSerie(l), 0)), rm: rms.length ? Math.max(...rms) : null, record: date === e.meilleur.date };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  };
  const parGroupe = ORDRE_GROUPES.map((g) => ({
    groupe: g,
    nom: GROUPES[g].nom,
    exercices: tous
      .filter((e) => e.groupe === g)
      .map((e) => ({ cle: e.cle, nom: e.nom, etiquettes: e.dansFenetre.map((p) => p.date), valeurs: e.dansFenetre.map((p) => p.rm), rm: e.rm, record: e.meilleurRm, seances: historiqueDe(e) })),
  })).filter((g) => g.exercices.length);

  const NOM_STATUT = { record: 'Record récent', plateau: 'Plateau', progres: 'En progression', stable: 'Stable' };
  const graphiques = [
    ...(parGroupe.length ? [{ type: 'exercices', titre: 'Progression par exercice', groupes: parGroupe }] : []),
    // Historique de l'exercice choisi dans le bloc du dessus (la page affiche les séances de l'exercice sélectionné)
    ...(parGroupe.length ? [{ type: 'historique', titre: 'Historique' }] : []),
  ];

  const lectures = suivis.map((e) => {
    const g = e.dansFenetre.length;
    return `${e.nom} : ${formatKg(e.rm)} kg estimés à la dernière séance (${e.reps} × ${formatKg(e.poids)} kg), record ${formatKg(e.meilleurRm)} kg le ${formatDateCourte(e.meilleur.date)}, ${sansPluriel(g, 'séance')} au total.`;
  });

  const conseils = [];
  for (const e of plateaux) conseils.push({ priorite: 'haute', titre: `Casse le plateau : ${e.nom}`, texte: `Pas de record depuis ${Math.round(e.joursRecord / 7)} semaines. Essaie une semaine plus légère (60 à 70 % de ta charge), puis change le schéma : par exemple passe de 5 × 5 à 4 × 6, ou ajoute une série à charge égale.` });
  if (records.length) conseils.push({ priorite: 'faible', titre: 'Profite de la dynamique', texte: 'Quand un record tombe, vise des petits pas (+1 à +2,5 kg) plutôt qu\'un gros saut : c\'est ce qui fait durer la série de progrès.' });
  if (!conseils.length) conseils.push({ priorite: 'info', titre: 'Continue de noter tes charges', texte: 'Plus tu enregistres de séances, plus le suivi des records est précis. Note chaque série avec sa charge réelle.' });

  return { id: 'records', insuffisant: false, verdict, chiffres, graphiques, lectures, conseils: triConseils(conseils), methode: METHODE_RECORDS, brut: { suivis, records, plateaux, progres, exos, fin } };
}
