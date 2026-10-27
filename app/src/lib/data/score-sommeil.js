// Score de sommeil « maison » et analyses (conseils, signaux, comparaisons). Fonctions pures, sans réseau.
// Méthode qui s'appuie sur des seuils PUBLIÉS (informatif, pas un diagnostic médical) :
//  - Durée : Hirshkowitz et al. 2015 (National Sleep Foundation) : 7 à 9 h recommandé chez l'adulte.
//  - Efficacité, latence d'endormissement, réveils, éveil nocturne : Ohayon et al. 2017 (consensus d'experts NSF).
//  - Architecture (% profond, % paradoxal) : normes descriptives de polysomnographie (Ohayon et al. 2004), poids plus faible
//    car ce n'est pas un critère de qualité validé par le consensus.
// Les signaux physiologiques (HRV, FC, SpO2, stress) sont affichés à part : ce sont des marqueurs de récupération.
//
// Une nuit est une ligne de garmin_sleep : total_sec, deep_sec, light_sec, rem_sec, awake_sec, awake_count, bedtime, wake_time
// (« AAAA-MM-JJ HH:MM »), hrv_avg, avg_heart_rate, resp_avg, spo2_avg, avg_stress, segments ([début_min, fin_min, niveau]), etc.
// Niveaux d'un segment : 0 profond, 1 léger, 2 paradoxal, 3 éveillé.

export const NOM_NIVEAU = ['Profond', 'Léger', 'Paradoxal', 'Éveil'];

export const REPERES = {
  profondPct: [13, 23],
  paradoxalPct: [20, 25],
  efficaciteBonne: 85,
  efficaciteMoyenne: 75,
  latenceBonne: 20,
  latenceMoyenne: 30,
  respiration: [12, 20],
  spo2Bonne: 95,
  detteCibleMin: 8 * 60,
};

const POIDS = { duree: 0.25, efficacite: 0.2, waso: 0.15, reveils: 0.15, latence: 0.1, architecture: 0.15 };
// [bon, inapproprié, point zéro]
const SEUILS = {
  efficacite: [85, 75, 40],
  latence: [15, 45, 90],
  waso: [20, 40, 120],
  reveils: [1, 4, 12],
};
const DUREE_BONNE = [7, 9];
const DUREE_ZERO = [3, 13];

export const NOM_COMPOSANT = {
  duree: 'Durée', efficacite: 'Efficacité', waso: 'Éveil nocturne', reveils: 'Réveils', latence: 'Endormissement', architecture: 'Architecture',
};
export const CONSEIL_COMPOSANT = {
  duree: "te coucher plus tôt pour allonger la nuit : c'est le levier n°1 ici",
  efficacite: "ne te mettre au lit que quand tu as sommeil, et te lever si tu ne t'endors pas en 20 min plutôt que de tourner",
  waso: "limiter ce qui te réveille en pleine nuit (bruit, lumière, température de la chambre) : c'est le temps éveillé après l'endormissement qui pèse ici",
  reveils: 'limiter le nombre de réveils : mêmes leviers que l’éveil nocturne (bruit, lumière, température, vessie pleine)',
  latence: "couper les écrans 30 à 45 min avant le coucher et éviter les activités stimulantes juste avant, pour t'endormir plus vite",
  architecture: 'protéger la fin de nuit (où se concentre le sommeil paradoxal) en évitant de l’écourter',
};
export const NOM_QUALIFICATIF = { EXCELLENT: 'Excellent', GOOD: 'Bon', FAIR: 'Correct', POOR: 'Faible' };

const moy = (liste) => {
  const v = (liste || []).filter((x) => x != null && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
export const moyenneDe = moy;

// --- Métriques dérivées d'une nuit ----------------------------------------------------------------------------------

/** Efficacité : part du temps au lit passée à dormir (en %), ou null. */
export function efficacitePct(n) {
  if (n?.total_sec == null || n?.awake_sec == null) return null;
  const auLit = n.total_sec + n.awake_sec;
  return auLit > 0 ? (n.total_sec / auLit) * 100 : null;
}

/** Latence d'endormissement en minutes, déduite des segments (0 si déjà endormi au coucher), ou null. */
export function latenceMin(n) {
  const segs = n?.segments;
  if (!Array.isArray(segs) || !segs.length) return null;
  const tries = segs.slice().sort((a, b) => a[0] - b[0]);
  if (tries[0][2] !== 3) return 0;
  const dormi = tries.find((s) => s[2] !== 3);
  return dormi ? Math.round(dormi[0]) : null;
}

// --- Score ---------------------------------------------------------------------------------------------------------------

/** Score continu : 100 jusqu'au seuil « bon », 25 au seuil « inapproprié », 0 au point zéro (dégradé linéaire). */
export function scorePalier(valeur, bon, mauvais, zero, plusHautMieux) {
  if (valeur == null) return null;
  if (plusHautMieux) {
    if (valeur >= bon) return 100;
    if (valeur >= mauvais) return 25 + (75 * (valeur - mauvais)) / (bon - mauvais);
    if (valeur <= zero) return 0;
    return (25 * (valeur - zero)) / (mauvais - zero);
  }
  if (valeur <= bon) return 100;
  if (valeur <= mauvais) return 25 + (75 * (mauvais - valeur)) / (mauvais - bon);
  if (valeur >= zero) return 0;
  return (25 * (zero - valeur)) / (zero - mauvais);
}

function scoreDuree(totalSec) {
  if (totalSec == null) return null;
  const h = totalSec / 3600;
  const [bas, haut] = DUREE_BONNE;
  if (h >= bas && h <= haut) return 100;
  if (h < bas) return scorePalier(h, bas, bas - 1, DUREE_ZERO[0], true);
  return scorePalier(h, haut, haut + 1, DUREE_ZERO[1], false);
}

function scoreArchitecture(profondSec, paradoxalSec, totalSec) {
  if (!totalSec) return null;
  const profond = ((profondSec || 0) / totalSec) * 100;
  const paradoxal = ((paradoxalSec || 0) / totalSec) * 100;
  const [pBas] = REPERES.profondPct;
  const [rBas, rHaut] = REPERES.paradoxalPct;
  const sProfond = scorePalier(profond, pBas, pBas * 0.6, 0, true);
  const sParadoxal = paradoxal <= rHaut + 5 ? scorePalier(paradoxal, rBas, rBas * 0.6, 0, true) : Math.max(65, 100 - (paradoxal - rHaut - 5) * 3);
  return sProfond * 0.45 + sParadoxal * 0.55;
}

export function qualificatifDe(v) {
  if (v >= 80) return 'EXCELLENT';
  if (v >= 65) return 'GOOD';
  if (v >= 50) return 'FAIR';
  return 'POOR';
}

/** Ton d'affichage d'un qualificatif : 'bon' (excellent, bon), 'moyen' (correct), 'faible'. */
export const tonDe = (q) => (q === 'EXCELLENT' || q === 'GOOD' ? 'bon' : q === 'FAIR' ? 'moyen' : 'faible');

/**
 * Score maison d'une nuit (0 à 100) : { total, qualificatif, composants } ou null si aucune donnée exploitable
 * (durée absente ou à 0 : montre pas portée ou nuit pas synchronisée, ce n'est pas une nuit « à 0 »).
 * Les composants sans donnée sont exclus et le poids est redistribué sur les autres.
 */
export function scoreNuit(n) {
  if (!n) return null;
  if (!(n.total_sec > 0)) return null;
  const parties = [
    ['duree', scoreDuree(n.total_sec)],
    ['efficacite', scorePalier(efficacitePct(n), ...SEUILS.efficacite, true)],
    ['waso', scorePalier(n.awake_sec != null ? n.awake_sec / 60 : null, ...SEUILS.waso, false)],
    ['reveils', scorePalier(n.awake_count, ...SEUILS.reveils, false)],
    ['latence', scorePalier(latenceMin(n), ...SEUILS.latence, false)],
    ['architecture', scoreArchitecture(n.deep_sec, n.rem_sec, n.total_sec)],
  ];
  let somme = 0;
  let poids = 0;
  const composants = {};
  for (const [cle, v] of parties) {
    if (v == null) continue;
    somme += v * POIDS[cle];
    poids += POIDS[cle];
    composants[cle] = Math.round(v);
  }
  if (!poids) return null;
  const total = Math.round(somme / poids);
  return { total, qualificatif: qualificatifDe(total), composants };
}

/** Nuits triées de la plus récente à la plus ancienne, chacune avec son score maison (champ `score_maison`). Les nuits sans durée sont écartées. */
export function preparer(nuits) {
  return [...(nuits || [])]
    .filter((n) => n?.total_sec > 0)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map((n) => ({ ...n, score_maison: scoreNuit(n) }));
}

// --- Heures ---------------------------------------------------------------------------------------------------------------

const heureEnMin = (h) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const decalerMidi = (m) => (m + 720) % 1440; // l'axe de la nuit commence à midi : 23h et 1h sont voisines
const retablirMidi = (s) => (((s - 720) % 1440) + 1440) % 1440;
const heureDe = (h) => (h ? String(h).split(' ')[1] || null : null);
const arrondir = (m, pas) => Math.round(m / pas) * pas;

/** « 7h42 » à partir de minutes. */
export const texteHM = (min) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
/** « 7h42 » à partir de secondes (« — » si absent). */
export const texteHMdepuisSec = (sec) => (sec == null ? '—' : texteHM(Math.round(sec / 60)));

/** Moyenne d'heures de la journée (« HH:MM »), en tenant compte du passage de minuit. Renvoie des minutes, ou null. */
export function moyenneHeure(heures) {
  const liste = (heures || []).map(heureEnMin).filter((m) => m != null);
  return liste.length ? retablirMidi(moy(liste.map(decalerMidi))) : null;
}

/** Écart signé entre deux heures de la journée (en minutes), par le chemin le plus court : 00h30 − 23h30 = +60, pas −1380. */
export function ecartHeures(a, b) {
  if (a == null || b == null) return null;
  return ((((a - b) % 1440) + 1440 + 720) % 1440) - 720;
}

// --- Analyses ------------------------------------------------------------------------------------------------------------

/** Régularité, durée moyenne, objectifs de coucher et de lever, composant le plus faible du score. null sans données. */
export function analyserHoraires(nuits) {
  const avecDetail = nuits.filter((n) => n.bedtime && n.wake_time && n.total_sec);
  if (!avecDetail.length) return null;
  const dureeMoyMin = moy(avecDetail.map((n) => n.total_sec / 60));
  const coucher = avecDetail.map((n) => decalerMidi(heureEnMin(heureDe(n.bedtime)))).filter((x) => x != null && !Number.isNaN(x));
  const lever = avecDetail.map((n) => decalerMidi(heureEnMin(heureDe(n.wake_time)))).filter((x) => x != null && !Number.isNaN(x));
  if (!coucher.length || !lever.length) return null;
  const moyCoucher = moy(coucher);
  const moyLever = moy(lever);

  const parComposant = {};
  for (const n of avecDetail) {
    const c = n.score_maison?.composants;
    if (!c) continue;
    for (const k of Object.keys(c)) (parComposant[k] = parComposant[k] || []).push(c[k]);
  }
  let plusFaible = null;
  let moyPlusFaible = 101;
  for (const k of Object.keys(parComposant)) {
    const m = moy(parComposant[k]);
    if (m < moyPlusFaible) {
      moyPlusFaible = m;
      plusFaible = k;
    }
  }
  const paradoxalMoy = moy(avecDetail.map((n) => (n.total_sec ? ((n.rem_sec || 0) / n.total_sec) * 100 : null)));
  const leverVise = arrondir(retablirMidi(moyLever), 15);
  const coucherVise = arrondir((leverVise - 7.5 * 60 + 1440) % 1440, 15);
  return {
    coucherMoyen: texteHM(retablirMidi(moyCoucher)),
    leverMoyen: texteHM(retablirMidi(moyLever)),
    ecartCoucherMin: Math.round(Math.max(...coucher) - Math.min(...coucher)),
    ecartLeverMin: Math.round(Math.max(...lever) - Math.min(...lever)),
    dureeMoyMin: Math.round(dureeMoyMin),
    paradoxalMoyPct: paradoxalMoy,
    plusFaible,
    coucherVise: texteHM(coucherVise),
    leverVise: texteHM(leverVise),
    nbNuits: avecDetail.length,
  };
}

function ecartRefMoyenne(nuits, champ) {
  const avec = nuits.filter((n) => n[champ] != null);
  if (!avec.length) return { derniere: null, reference: null, ecartPct: null };
  const derniere = avec[0][champ];
  const reste = avec.slice(1);
  const reference = reste.length ? moy(reste.map((n) => n[champ])) : null;
  return { derniere, reference, ecartPct: reference ? ((derniere - reference) / reference) * 100 : null };
}

/** Analyse « pro » sur les nuits récentes (la plus récente d'abord) : efficacité, endormissement, dette, phases, signaux. null sans nuit. */
export function analyser(nuitsTriees) {
  const valides = nuitsTriees.filter((n) => n.total_sec != null);
  if (!valides.length) return null;
  const recentes = valides.slice(0, 30);
  const r14 = valides.slice(0, 14);
  const r7 = valides.slice(0, 7);
  const latences = r14.map(latenceMin).filter((v) => v != null);
  const pct = (champ) => moy(r14.map((n) => (n.total_sec ? ((n[champ] || 0) / n.total_sec) * 100 : null)));
  return {
    horaires: analyserHoraires(nuitsTriees),
    nbNuits: valides.length,
    efficaciteMoy: moy(r14.map(efficacitePct)),
    latenceMoy: latences.length ? moy(latences) : null,
    detteMin: r7.reduce((a, n) => a + Math.max(0, REPERES.detteCibleMin * 60 - (n.total_sec || 0)), 0) / 60,
    profondPct: pct('deep_sec'),
    legerPct: pct('light_sec'),
    paradoxalPct: pct('rem_sec'),
    hrv: ecartRefMoyenne(recentes, 'hrv_avg'),
    fc: ecartRefMoyenne(recentes, 'avg_heart_rate'),
    respiration: ecartRefMoyenne(recentes, 'resp_avg'),
    spo2: ecartRefMoyenne(recentes, 'spo2_avg'),
    stress: ecartRefMoyenne(recentes, 'avg_stress'),
  };
}

export const bandeStress = (v) => (v == null ? '' : v <= 25 ? 'repos' : v <= 50 ? 'bas' : v <= 75 ? 'moyen' : 'élevé');

/** Signaux physiologiques de la dernière nuit comparée à la moyenne récente : [{ cle, titre, valeur, ton, texte }]. */
export function signauxPhysio(pro) {
  const lignes = [];
  const arrondi = (v) => Math.round(v);
  const signe = (d) => `${d >= 0 ? '+' : ''}${Math.round(d)} %`;
  if (pro.hrv.derniere != null) {
    const d = pro.hrv.ecartPct;
    lignes.push({
      cle: 'hrv', titre: 'HRV nocturne', valeur: `${arrondi(pro.hrv.derniere)} ms`,
      ton: d == null ? 'neutre' : d >= -5 ? 'bon' : d >= -15 ? 'attention' : 'mauvais',
      texte: d == null ? 'Pas encore assez de nuits pour une moyenne de référence.'
        : `${signe(d)} par rapport à ta moyenne récente (${arrondi(pro.hrv.reference)} ms). ${d < -15 ? 'Baisse marquée : signe de fatigue ou de récupération incomplète à surveiller.' : d < -5 ? 'Légèrement sous ta moyenne.' : 'Dans ta norme habituelle, bon signe de récupération.'}`,
    });
  }
  if (pro.fc.derniere != null) {
    const d = pro.fc.ecartPct;
    lignes.push({
      cle: 'fc', titre: 'FC pendant le sommeil', valeur: `${arrondi(pro.fc.derniere)} bpm`,
      ton: d == null ? 'neutre' : d <= 5 ? 'bon' : d <= 10 ? 'attention' : 'mauvais',
      texte: d == null ? 'Pas encore assez de nuits pour une moyenne de référence.'
        : `${signe(d)} par rapport à ta moyenne récente (${arrondi(pro.fc.reference)} bpm). ${d > 10 ? "FC nocturne élevée : souvent liée au stress, à l'alcool ou à une charge d'entraînement non digérée la veille." : 'Cohérent avec ta ligne de base.'}`,
    });
  }
  if (pro.respiration.derniere != null) {
    const [bas, haut] = REPERES.respiration;
    const dans = pro.respiration.derniere >= bas && pro.respiration.derniere <= haut;
    lignes.push({
      cle: 'resp', titre: 'Fréquence respiratoire', valeur: `${Math.round(pro.respiration.derniere * 10) / 10} /min`, ton: dans ? 'bon' : 'attention',
      texte: dans ? `Dans la plage habituelle au repos (${bas}–${haut}/min).` : `En dehors de la plage habituelle (${bas}–${haut}/min) : peut refléter une congestion, de la fièvre ou un léger stress respiratoire.`,
    });
  }
  if (pro.spo2.derniere != null) {
    const bonne = pro.spo2.derniere >= REPERES.spo2Bonne;
    lignes.push({
      cle: 'spo2', titre: 'SpO2 moyenne', valeur: `${arrondi(pro.spo2.derniere)} %`, ton: bonne ? 'bon' : 'mauvais',
      texte: bonne ? `Saturation normale (≥ ${REPERES.spo2Bonne} %).` : `Sous ${REPERES.spo2Bonne} % de moyenne : si c'est récurrent, parles-en à un médecin (piste possible : apnées du sommeil).`,
    });
  }
  if (pro.stress.derniere != null) {
    const bande = bandeStress(pro.stress.derniere);
    const calme = bande === 'repos' || bande === 'bas';
    lignes.push({
      cle: 'stress', titre: 'Stress pendant le sommeil', valeur: String(arrondi(pro.stress.derniere)),
      ton: calme ? 'bon' : bande === 'moyen' ? 'attention' : 'mauvais',
      texte: calme ? `Niveau « ${bande} » : système nerveux bien apaisé pendant la nuit, favorable à la récupération.` : `Niveau « ${bande} » : un stress nocturne élevé retarde l'entrée en sommeil profond et fragmente les cycles.`,
    });
  }
  return lignes;
}

/** Phrase de synthèse sur les 14 dernières nuits scorées. */
export function synthese(nuitsTriees, pro) {
  const scorees = nuitsTriees.filter((n) => n.score_maison != null).slice(0, 14);
  if (!scorees.length) return 'Pas encore assez de nuits scorées pour une synthèse.';
  const moyScore = Math.round(moy(scorees.map((n) => n.score_maison.total)));
  const mot = moyScore >= 80 ? 'bon' : moyScore >= 65 ? 'correct' : moyScore >= 50 ? 'modéré' : 'faible';
  let s = `Sur tes ${scorees.length} dernières nuits, ton sommeil est en moyenne ${mot} (score moyen ${moyScore}/100).`;
  const faible = pro.horaires?.plusFaible;
  if (faible && CONSEIL_COMPOSANT[faible]) s += ` Le facteur qui pèse le plus sur ce score : ${NOM_COMPOSANT[faible].toLowerCase()}.`;
  if (pro.efficaciteMoy != null) {
    const e = Math.round(pro.efficaciteMoy);
    s += pro.efficaciteMoy < REPERES.efficaciteMoyenne
      ? ` Ton efficacité de sommeil (${e} %) est nettement sous le seuil de ${REPERES.efficaciteBonne} % généralement visé : tu passes beaucoup de temps éveillé au lit.`
      : pro.efficaciteMoy < REPERES.efficaciteBonne
        ? ` Ton efficacité de sommeil (${e} %) est légèrement sous le seuil de ${REPERES.efficaciteBonne} %.`
        : ` Ton efficacité de sommeil (${e} %) est bonne.`;
  }
  if (pro.detteMin > 60) s += ` Dette de sommeil cumulée sur 7 jours : environ ${texteHM(Math.round(pro.detteMin))} par rapport à 8 h par nuit.`;
  return s;
}

/** Plan d'action priorisé : [{ impact: 'fort' | 'modere' | 'general', texte }]. */
export function planAction(pro) {
  const h = pro.horaires;
  const actions = [];
  if (h?.plusFaible && CONSEIL_COMPOSANT[h.plusFaible]) {
    actions.push({ impact: 'fort', texte: `Priorité n°1 : ${CONSEIL_COMPOSANT[h.plusFaible]}. C'est le point qui a le plus pénalisé ton score sur tes ${h.nbNuits} dernières nuits.` });
  }
  if (pro.efficaciteMoy != null && pro.efficaciteMoy < REPERES.efficaciteMoyenne) {
    actions.push({ impact: 'fort', texte: `Ton efficacité de sommeil est basse (${Math.round(pro.efficaciteMoy)} %) : ne va te coucher que quand tu as sommeil, et si tu ne t'endors pas en 20 min, lève-toi plutôt que de tourner au lit.` });
  }
  if (pro.latenceMoy != null && pro.latenceMoy > REPERES.latenceMoyenne) {
    actions.push({ impact: 'fort', texte: `Ton endormissement prend en moyenne ${Math.round(pro.latenceMoy)} min (cible ≤ ${REPERES.latenceBonne} min) : coupe les écrans 30 à 45 min avant le coucher et évite les activités stimulantes juste avant.` });
  }
  if (h && 450 - h.dureeMoyMin > 20) {
    actions.push({ impact: 'fort', texte: `Tu dors en moyenne ${texteHM(h.dureeMoyMin)} : vise plutôt 7h30 à 8h. Avance ton coucher progressivement (15 à 20 min tous les 2 à 3 jours).` });
  }
  if (h && h.ecartCoucherMin > 90) {
    actions.push({ impact: 'modere', texte: `Tes horaires de coucher varient de ${texteHM(h.ecartCoucherMin)} d'une nuit à l'autre. Un créneau stable aide autant que la durée : vise ± 30 min autour de ${h.coucherVise}.` });
  }
  if (h && h.paradoxalMoyPct != null && h.paradoxalMoyPct < REPERES.paradoxalPct[0]) {
    actions.push({ impact: 'modere', texte: `Ton sommeil paradoxal tourne autour de ${Math.round(h.paradoxalMoyPct)} %, sous la cible de ${REPERES.paradoxalPct[0]}–${REPERES.paradoxalPct[1]} %. Il se concentre en fin de nuit : une nuit écourtée le rogne en premier.` });
  }
  if (pro.fc.ecartPct != null && pro.fc.ecartPct > 10) {
    actions.push({ impact: 'modere', texte: "Ta FC pendant le sommeil est nettement au-dessus de ta moyenne récente : regarde du côté de la charge d'entraînement, de l'alcool ou du stress de la veille." });
  }
  actions.push({ impact: 'general', texte: 'Lumière du jour le matin (15 à 20 min) pour caler ton horloge circadienne.' });
  actions.push({ impact: 'general', texte: 'Caféine : éviter après le début d’après-midi (demi-vie d’environ 5 à 6 h).' });
  actions.push({ impact: 'general', texte: 'Repas lourds et alcool en fin de soirée fragmentent le sommeil profond : à limiter.' });
  actions.push({ impact: 'general', texte: 'Chambre : viser 17 à 19 °C, noire et calme.' });
  return actions;
}

// --- Comparaisons ---------------------------------------------------------------------------------------------------------

const estWeekEnd = (iso) => {
  const j = new Date(`${iso}T12:00:00`).getDay();
  return j === 0 || j === 6;
};

function statsGroupe(liste) {
  return {
    n: liste.length,
    dureeSec: moy(liste.map((n) => n.total_sec).filter((v) => v != null)),
    score: moy(liste.map((n) => n.score_maison?.total).filter((v) => v != null)),
    hrv: moy(liste.map((n) => n.hrv_avg).filter((v) => v != null)),
    efficacite: moy(liste.map(efficacitePct).filter((v) => v != null)),
    coucherMin: moyenneHeure(liste.map((n) => heureDe(n.bedtime))),
    leverMin: moyenneHeure(liste.map((n) => heureDe(n.wake_time))),
  };
}

/**
 * Deux comparaisons : 7 derniers jours contre les 7 précédents, et semaine contre week-end.
 * Chacune vaut null s'il manque des nuits ; `a` = période comparée (récent / week-end), `b` = référence.
 */
export function comparaisons(nuitsTriees) {
  const valides = nuitsTriees.filter((n) => n.total_sec != null);
  const r7 = valides.slice(0, 7);
  const p7 = valides.slice(7, 14);
  const semaine = valides.filter((n) => !estWeekEnd(n.date)).slice(0, 30);
  const weekEnd = valides.filter((n) => estWeekEnd(n.date)).slice(0, 12);
  return {
    recent: r7.length >= 3 && p7.length >= 3 ? { a: statsGroupe(r7), b: statsGroupe(p7) } : null,
    semaineWeekEnd: semaine.length >= 3 && weekEnd.length >= 2 ? { a: statsGroupe(weekEnd), b: statsGroupe(semaine) } : null,
  };
}
