// Analyse de la charge d'entraînement : où en est ta charge, monte-t-elle à un rythme sain, est-elle bien répartie ?
// Tout est déduit des séances (charge par séance → série quotidienne → CTL / ATL / TSB / ACWR). Fonctions pures.
import { chargeSeance } from '../data/synthese.js';
import { familleAffichage } from '../data/familles.js';
import { SPORTS, couleurSport } from '../sports.js';
import { dateIsoLocale } from '../utils/format.js';
import { serieCharge, zoneAcwr, zoneTsb } from './moteur-charge.js';
import { moyenne, ecartType, somme, arrondi, decalerJour, lundiDe, ecartJours, regression } from './maths.js';

const virgule = (v, n = 1) => String(arrondi(v, n)).replace('.', ',');

/** Intensité d'une séance (IF = √(TSS ÷ (heures × 100))), ou null si on ne connaît pas son TSS. */
export function intensiteSeance(s) {
  const h = (s.moving_time || 0) / 3600;
  return typeof s.tss === 'number' && s.tss > 0 && h > 0 ? Math.sqrt(s.tss / (h * 100)) : null;
}

/** Répartition du TEMPS d'entraînement en facile / modéré / intense (seuils d'IF 0,75 et 0,88) et son diagnostic. */
export function repartitionIntensite(seances) {
  let facile = 0;
  let modere = 0;
  let intense = 0;
  let mesurees = 0;
  for (const s of seances) {
    const f = intensiteSeance(s);
    if (f == null) continue;
    const poids = s.moving_time; // on pèse par le temps passé (c'est ainsi que se définit le 80/20 des endurants)
    mesurees += poids;
    if (f < 0.75) facile += poids;
    else if (f < 0.88) modere += poids;
    else intense += poids;
  }
  if (!mesurees) return null;
  const pct = (v) => Math.round((v / mesurees) * 100);
  const p = { facile: pct(facile), modere: pct(modere), intense: pct(intense) };
  let profil = 'equilibre';
  if (p.modere >= 40) profil = 'zone_grise';
  else if (p.facile >= 70 && p.intense >= 10 && p.modere <= 25) profil = 'polarise';
  else if (p.facile >= 85 && p.intense < 8) profil = 'tout_facile';
  else if (p.intense >= 35) profil = 'tout_dur';
  return { ...p, profil, couverture: Math.round((seances.filter((s) => intensiteSeance(s) != null).length / Math.max(1, seances.length)) * 100) };
}

const NOM_PROFIL = {
  polarise: 'Polarisée (le modèle des endurants)',
  zone_grise: 'Zone grise : trop de modéré',
  tout_facile: 'Très tranquille',
  tout_dur: 'Très intense',
  equilibre: 'Équilibrée',
};

/**
 * Analyse complète.
 *  - seances : séances réalisées (déjà filtrées par sport) sur au moins `semaines` semaines (+ du recul pour la condition)
 *  - aujourdhui : Date · semaines : fenêtre affichée (12, 26 ou 52) · nomSport : « Course »… ou '' pour tous
 */
export function analyserCharge({ seances, aujourdhui = new Date(), semaines = 12, nomSport = '' } = {}) {
  const fin = dateIsoLocale(aujourdhui);
  const debut = decalerJour(fin, -(semaines * 7 - 1));
  const methode = [
    { titre: 'Charge d\'une séance', texte: 'Le TSS enregistré quand il existe, sinon une estimation à partir de la durée (un peu plus haute si le cardio est connu). C\'est une unité commune à tous les sports.' },
    { titre: 'Condition, fatigue, fraîcheur', texte: 'Modèle de Banister : la condition (CTL) est la moyenne exponentielle de ta charge sur 42 jours, la fatigue (ATL) sur 7 jours, la fraîcheur (TSB) est la condition moins la fatigue de la veille.' },
    { titre: 'Ratio aigu / chronique (ACWR)', texte: 'Charge des 7 derniers jours divisée par celle des 28 derniers (moyennes exponentielles). Entre 0,8 et 1,3, le risque de blessure est le plus bas ; au-delà de 1,5 il grimpe nettement (Gabbett, 2016).' },
    { titre: 'Monotonie et contrainte (Foster)', texte: 'Monotonie = charge moyenne des 7 derniers jours ÷ son écart type. Vers 2 tes jours se ressemblent, au-delà de 2,5 il n\'y a plus de vrais jours faciles : c\'est un facteur de surmenage (surtout si la charge est haute).' },
    { titre: 'Répartition de l\'intensité', texte: 'Facteur d\'intensité IF = √(TSS ÷ (heures × 100)). Facile < 0,75, modéré de 0,75 à 0,88, intense au-dessus, pondéré par le temps passé. Seules les séances avec un TSS sont classées.' },
  ];

  const toutes = serieCharge(seances, debut, fin);
  const nbSeancesFenetre = seances.filter((s) => {
    const j = String(s.start_date_local).slice(0, 10);
    return j >= debut && j <= fin;
  });
  const seancesFenetre = nbSeancesFenetre;
  const premier = seances.map((s) => String(s.start_date_local).slice(0, 10)).sort()[0];
  const recul = premier ? ecartJours(premier, fin) : 0;

  if (!toutes.length || seancesFenetre.length < 4 || recul < 21) {
    return {
      id: 'charge',
      insuffisant: true,
      verdict: { niveau: 'info', titre: 'Pas encore assez de recul', texte: 'Il faut au moins 4 séances sur 3 semaines pour analyser ta charge. Continue de t\'entraîner (ou connecte Strava), l\'analyse se remplit toute seule.' },
      chiffres: [],
      graphiques: [],
      lectures: [],
      conseils: [],
      methode,
    };
  }

  const dernier = toutes[toutes.length - 1];
  const il7 = toutes[toutes.length - 8] || toutes[0];
  const charges = toutes.map((j) => j.charge);

  // --- Semaines civiles (lundi → dimanche) pour le graphique, la dernière est en cours ---
  const lundiDebut = lundiDe(debut);
  const parSemaine = new Map(); // lundi → { total, parSport }
  for (let l = lundiDebut; l <= fin; l = decalerJour(l, 7)) parSemaine.set(l, { total: 0, parSport: new Map() });
  for (const s of seancesFenetre) {
    const j = String(s.start_date_local).slice(0, 10);
    const bloc = parSemaine.get(lundiDe(j));
    if (!bloc) continue;
    const c = chargeSeance(s);
    const f = familleAffichage(s.sport);
    bloc.total += c;
    bloc.parSport.set(f, (bloc.parSport.get(f) || 0) + c);
  }
  const lundis = [...parSemaine.keys()];
  const familles = [...new Set(seancesFenetre.map((s) => familleAffichage(s.sport)))];
  const seriesBarres = familles
    .map((f) => ({ nom: f, couleur: couleurSport(f), valeurs: lundis.map((l) => parSemaine.get(l).parSport.get(f) || 0) }))
    .map((s) => ({ ...s, total: somme(s.valeurs) }))
    .sort((a, b) => b.total - a.total);
  const ctlParSemaine = lundis.map((l) => {
    const fin7 = decalerJour(l, 6) > fin ? fin : decalerJour(l, 6);
    return arrondi((toutes.find((j) => j.iso === fin7) || dernier).ctl);
  });
  const etiquettesSemaines = lundis.map((l, i) => (i === lundis.length - 1 ? 'En cours' : l.slice(8) + '/' + l.slice(5, 7)));

  // --- Blocs glissants de 7 jours (le dernier = les 7 derniers jours) ---
  const blocs7 = [];
  for (let k = 0; k * 7 + 7 <= charges.length; k++) {
    const fin7 = charges.length - k * 7;
    blocs7.push(somme(charges.slice(fin7 - 7, fin7)));
  }
  const charge7 = blocs7[0];
  const precedents = blocs7.slice(1, 5);
  const moyPrec = precedents.length ? moyenne(precedents) : null;
  const variation = moyPrec ? ((charge7 - moyPrec) / moyPrec) * 100 : null;

  // --- Indicateurs ---
  const acwr = dernier.acwr;
  const zone = zoneAcwr(acwr);
  const tsb = dernier.tsb;
  const zoneForme = zoneTsb(tsb);
  const rampe = dernier.ctl - il7.ctl;
  const sept = charges.slice(-7);
  const sd7 = ecartType(sept);
  // sept jours identiques : écart type nul, monotonie « infinie » (plafonnée à 9,9) ; aucune charge : pas de monotonie
  const monotonie = moyenne(sept) > 0 ? Math.min(9.9, sd7 > 1e-9 ? moyenne(sept) / sd7 : 9.9) : null;
  const contrainte = monotonie ? Math.round(somme(sept) * monotonie) : null;
  const chroniqueSemaine = dernier.chronique * 7; // charge hebdomadaire que ton corps « connaît »
  const joursActifs = sept.filter((c) => c > 0).length;
  const intensite = repartitionIntensite(seancesFenetre);
  const totalCharge = somme(seriesBarres.map((s) => s.total));
  const sports = seriesBarres.map((s) => ({ famille: s.nom, part: Math.round((s.total / Math.max(1, totalCharge)) * 100) }));
  const semainesCompletes = lundis.slice(0, -1);
  const vides = semainesCompletes.filter((l) => parSemaine.get(l).total === 0).length;
  const pic = blocs7.reduce((m, v, k) => (v > m.v ? { v, k } : m), { v: 0, k: 0 });
  const tendance = regression(semainesCompletes.map((l) => parSemaine.get(l).total));
  const tendancePct = moyenne(semainesCompletes.map((l) => parSemaine.get(l).total)) ? (tendance.pente * semainesCompletes.length) / moyenne(semainesCompletes.map((l) => parSemaine.get(l).total)) * 100 : 0;

  // --- Verdict ---
  let verdict;
  if ((acwr != null && acwr > 1.5) || rampe > 10 || tsb < -40) {
    verdict = { niveau: 'danger', titre: 'Tu montes trop vite', texte: `Ta charge récente est ${acwr ? virgule(acwr, 2) + ' fois' : 'bien au-dessus de'} ce à quoi ton corps est habitué${rampe > 10 ? `, et ta condition grimpe de ${virgule(rampe)} points par semaine` : ''}. C'est la zone où les blessures et le surmenage se produisent le plus souvent.` };
  } else if ((acwr != null && acwr > 1.3) || monotonie > 2.5 || rampe > 8 || tsb < -30) {
    verdict = { niveau: 'attention', titre: 'À surveiller', texte: 'Un ou deux indicateurs sont dans la zone de vigilance. Rien de grave si c\'est voulu, mais évite d\'empiler une semaine encore plus dure.' };
  } else if (acwr != null && acwr < 0.8) {
    verdict = { niveau: 'info', titre: 'Tu es en sous-charge', texte: `Ta charge récente est plus basse que d'habitude (${virgule(acwr, 2)}). C'est parfait pour récupérer, mais ta condition va redescendre si ça dure.` };
  } else {
    verdict = { niveau: 'ok', titre: 'Charge bien dosée', texte: `Ta charge récente est cohérente avec ton niveau (ratio ${acwr ? virgule(acwr, 2) : '—'}) et ta progression est saine.` };
  }

  const chiffres = [
    { etiquette: 'Condition (CTL)', valeur: Math.round(dernier.ctl), unite: '', note: rampe >= 0 ? `+${virgule(rampe)} cette semaine` : `${virgule(rampe)} cette semaine`, ton: rampe > 8 ? 'alerte' : 'neutre' },
    { etiquette: 'Fatigue (ATL)', valeur: Math.round(dernier.atl), unite: '', note: 'moyenne sur 7 jours', ton: 'neutre' },
    { etiquette: 'Fraîcheur (TSB)', valeur: Math.round(tsb), unite: '', note: zoneForme.libelle, ton: zoneForme.ton },
    { etiquette: 'Ratio aigu / chronique', valeur: acwr == null ? '—' : virgule(acwr, 2), unite: '', note: zone.libelle, ton: zone.ton },
    { etiquette: 'Charge, 7 derniers jours', valeur: Math.round(charge7), unite: 'pts', note: variation == null ? '' : `${variation >= 0 ? '+' : ''}${Math.round(variation)} % vs les 4 semaines d'avant`, ton: variation != null && variation > 30 ? 'alerte' : 'neutre' },
    { etiquette: 'Monotonie', valeur: monotonie == null ? '—' : monotonie >= 5 ? '5+' : virgule(monotonie), unite: '', note: monotonie == null ? '' : monotonie > 2.5 ? 'jours trop semblables' : monotonie > 2 ? 'un peu uniforme' : 'jours bien variés', ton: monotonie > 2.5 ? 'alerte' : 'ok' },
  ];

  // --- Graphiques ---
  const histoJours = toutes.slice(-Math.min(toutes.length, semaines * 7));
  const echant = (t, pas) => t.filter((_, i) => i % pas === 0 || i === t.length - 1);
  const pas = semaines > 26 ? 3 : 1;
  const graphiques = [
    {
      type: 'barres',
      titre: 'Charge par semaine et par sport',
      description: `Chaque barre est une semaine (lundi → dimanche), la dernière est en cours. La ligne est ta condition en fin de semaine.`,
      etiquettes: etiquettesSemaines,
      series: seriesBarres,
      ligne: ctlParSemaine,
    },
    {
      type: 'lignes',
      titre: 'Condition, fatigue et fraîcheur',
      description: 'La condition monte quand tu t\'entraînes régulièrement. La fatigue réagit vite. L\'écart entre les deux (la fraîcheur) dit si tu es prêt à performer.',
      etiquettes: echant(histoJours, pas).map((j) => j.iso),
      series: [
        { nom: 'Condition (CTL)', couleur: 'var(--sport-velo)', valeurs: echant(histoJours, pas).map((j) => arrondi(j.ctl, 1)) },
        { nom: 'Fatigue (ATL)', couleur: 'var(--sport-course)', valeurs: echant(histoJours, pas).map((j) => arrondi(j.atl, 1)) },
      ],
    },
    {
      type: 'lignes',
      titre: 'Ratio aigu / chronique',
      description: 'Reste dans la bande verte (0,8 à 1,3) : c\'est là que tu progresses avec le moins de risque.',
      etiquettes: echant(histoJours, pas).map((j) => j.iso),
      series: [{ nom: 'ACWR', couleur: 'var(--texte)', valeurs: echant(histoJours, pas).map((j) => (j.acwr == null ? null : arrondi(j.acwr, 2))) }],
      bandes: [
        { de: 0.8, a: 1.3, couleur: 'var(--ok)', libelle: 'Zone optimale' },
        { de: 1.5, a: 2.5, couleur: 'var(--danger)', libelle: 'Danger' },
      ],
      min: 0,
      max: 2.2,
    },
  ];
  if (intensite) {
    graphiques.push({
      type: 'repartition',
      titre: 'Répartition de l\'intensité',
      description: `${NOM_PROFIL[intensite.profil]}. Calculé sur ${intensite.couverture} % de tes séances (celles avec un TSS).`,
      segments: [
        { nom: 'Facile', valeur: intensite.facile, couleur: 'var(--sport-velo)' },
        { nom: 'Modéré', valeur: intensite.modere, couleur: 'var(--sport-hybride)' },
        { nom: 'Intense', valeur: intensite.intense, couleur: 'var(--sport-course)' },
      ],
    });
  }

  // --- Lectures (ce que disent les chiffres) ---
  const lectures = [];
  if (acwr != null) lectures.push(`Ratio aigu / chronique : ${virgule(acwr, 2)} → ${zone.libelle.toLowerCase()}.`);
  lectures.push(`Ta condition est de ${Math.round(dernier.ctl)} : c'est la charge quotidienne moyenne que ton corps a intégrée (environ ${Math.round(chroniqueSemaine)} points par semaine).`);
  if (variation != null) lectures.push(`Tes 7 derniers jours (${Math.round(charge7)} pts) sont ${variation >= 0 ? 'au-dessus' : 'en dessous'} de ta moyenne des 4 semaines précédentes (${Math.round(moyPrec)} pts), soit ${variation >= 0 ? '+' : ''}${Math.round(variation)} %.`);
  if (pic.v > 0 && pic.k > 0) lectures.push(`Ta semaine la plus chargée de la période : ${Math.round(pic.v)} pts, il y a ${pic.k} semaine${pic.k > 1 ? 's' : ''}.`);
  if (semainesCompletes.length >= 6) lectures.push(`Sur ${semainesCompletes.length} semaines complètes, ta charge hebdomadaire ${Math.abs(tendancePct) < 5 ? 'est stable' : tendancePct > 0 ? `progresse d'environ ${Math.round(tendancePct)} %` : `baisse d'environ ${Math.round(-tendancePct)} %`}.`);
  if (sports.length > 1) lectures.push(`Répartition de la charge : ${sports.slice(0, 3).map((s) => `${(SPORTS[s.famille] || SPORTS.autre).court} ${s.part} %`).join(', ')}.`);

  // --- Conseils chiffrés ---
  const conseils = [];
  const cibleSecurite = Math.round(chroniqueSemaine * 1.2);
  const cibleEntretien = Math.round(chroniqueSemaine);
  if (acwr != null && acwr > 1.5) {
    conseils.push({ priorite: 'haute', titre: 'Allège cette semaine', texte: `Vise environ ${cibleSecurite} points sur les 7 prochains jours (tu es à ${Math.round(charge7)}). Ça te ramène à un ratio autour de 1,2 sans perdre ta condition. Garde une ou deux séances faciles et un vrai jour de repos.` });
  } else if (acwr != null && acwr > 1.3) {
    conseils.push({ priorite: 'moyenne', titre: 'Ne rajoute pas de charge', texte: `Tu es à ${Math.round(charge7)} points sur 7 jours. Reste sous ${Math.round(chroniqueSemaine * 1.3)} points cette semaine pour revenir dans la zone optimale.` });
  } else if (acwr != null && acwr < 0.8 && dernier.chronique > 15) {
    conseils.push({ priorite: 'moyenne', titre: 'Tu peux remonter doucement', texte: `Ta charge de fond est d'environ ${cibleEntretien} points par semaine : reviens vers ça (tu es à ${Math.round(charge7)}), puis monte d'au plus 10 % par semaine.` });
  }
  if (rampe > 8) conseils.push({ priorite: 'haute', titre: 'Ralentis la progression', texte: `Ta condition prend ${virgule(rampe)} points par semaine, au-delà de 8 le corps suit mal. Garde ta charge stable une semaine pour que les tissus s'adaptent.` });
  if (monotonie != null && monotonie > 2.5) conseils.push({ priorite: 'moyenne', titre: 'Casse la monotonie', texte: `Tes jours se ressemblent trop (monotonie ${virgule(monotonie)}) avec ${joursActifs} jours actifs sur 7. Prévois au moins deux jours très faciles ou un repos complet, et une journée plus dure : c'est le contraste qui fait progresser.` });
  if (tsb < -30) conseils.push({ priorite: 'haute', titre: 'Planifie de la récupération', texte: `Ta fraîcheur est à ${Math.round(tsb)} : fatigue excessive. Trois jours très légers feraient remonter la fraîcheur d'environ ${Math.round(dernier.atl * 0.25)} points.` });
  if (intensite && intensite.profil === 'zone_grise') conseils.push({ priorite: 'moyenne', titre: 'Sors de la zone grise', texte: `${intensite.modere} % de ton temps d'entraînement est à intensité modérée : assez dur pour fatiguer, pas assez pour progresser vite. Rends tes séances faciles vraiment faciles, et garde 1 ou 2 séances réellement dures par semaine.` });
  if (intensite && intensite.profil === 'tout_facile' && dernier.ctl > 20) conseils.push({ priorite: 'faible', titre: 'Ajoute une séance qui pousse', texte: `Presque tout est facile (${intensite.facile} %). Pour progresser, une séance par semaine de fractionné ou de tempo apporterait un vrai stimulus.` });
  if (intensite && intensite.profil === 'tout_dur') conseils.push({ priorite: 'haute', titre: 'Trop de séances dures', texte: `${intensite.intense} % de ton temps d'entraînement est intense. Remplace une séance dure par une sortie facile : la récupération est là où tu progresses.` });
  if (vides >= 2) conseils.push({ priorite: 'moyenne', titre: 'La régularité d\'abord', texte: `${vides} semaines complètes sans séance sur la période. La régularité compte plus que n'importe quelle séance : mieux vaut 3 séances faciles chaque semaine qu'une grosse puis rien.` });
  if (!conseils.length) conseils.push({ priorite: 'info', titre: 'Continue comme ça', texte: `Ta charge est bien dosée. Pour progresser sans risque, tu peux viser ${Math.round(chroniqueSemaine * 1.1)} points la semaine prochaine (+10 %), puis une semaine plus légère toutes les 3 ou 4 semaines.` });
  const ordre = { haute: 0, moyenne: 1, faible: 2, info: 3 };
  conseils.sort((a, b) => ordre[a.priorite] - ordre[b.priorite]);

  return {
    id: 'charge',
    insuffisant: false,
    verdict,
    chiffres,
    graphiques,
    lectures,
    conseils,
    methode,
    brut: { acwr, tsb, ctl: dernier.ctl, atl: dernier.atl, rampe, monotonie, contrainte, charge7, variation, chroniqueSemaine, joursActifs, intensite, vides, sports },
  };
}
