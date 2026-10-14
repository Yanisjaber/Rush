// Charge de musculation : combien ta musculation te charge-t-elle, et est-ce que ça monte à un rythme sain ?
// Chaque série pèse « répétitions × intensité », l'intensité étant ton poids divisé par ton 1RM estimé de CET exercice.
// Un curl à 70 % et un squat à 70 % pèsent donc pareil : les exercices deviennent comparables entre eux, ce que le
// tonnage (kg soulevés) ne permet pas. Fonctions pures, sans réseau ni écran.
// Cette charge mesure le travail des MUSCLES : elle ne se compare pas à une charge de vélo ou de course (TSS), qui
// mesure surtout le travail du cœur et de l'énergie. Les deux se cumulent dans ta fatigue, mais pas dans la même unité.
import { GROUPES, ORDRE_GROUPES, groupeValide } from '../data/exercices.js';
import { dateIsoLocale, formatDateCourte } from '../utils/format.js';
import { moyenne, arrondi, decalerJour, lundiDe, ecartJours, ecartType } from './maths.js';
import { fatigueMusculaire, texteDelai } from './fatigue-musculaire.js';

const FENETRE_RM = 90; // le 1RM de référence d'un exercice = ton meilleur des 90 derniers jours
const INTENSITE_SANS_CHARGE = 0.6; // pompes, tractions au poids du corps… : pas de charge notée, on suppose un effort moyen
const ORDRE = { haute: 0, moyenne: 1, faible: 2, info: 3 };
const virgule = (v, n = 1) => String(arrondi(v, n)).replace('.', ',');
const pluriel = (n, mot, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`;
const iso = (s) => String(s.date).slice(0, 10);
const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const epley = (poids, reps) => poids * (1 + reps / 30); // 1RM estimé (formule d'Epley), sans plafond de répétitions

/**
 * Charge de chaque série : [{ date, groupe, cle, reps, intensite, charge, estimee }]
 * intensite = poids ÷ 1RM de référence de l'exercice (entre 0 et 1) ; charge = répétitions × intensité.
 * `estimee` vaut true quand l'intensité est supposée (exercice au poids du corps, sans charge notée).
 */
export function chargeParSerie(series) {
  const parExo = new Map();
  for (const s of series) {
    if (!(nombre(s.reps) > 0) || !groupeValide(s.muscle_group)) continue;
    if (!parExo.has(s.exercise_key)) parExo.set(s.exercise_key, []);
    parExo.get(s.exercise_key).push(s);
  }
  const sortie = [];
  for (const lignes of parExo.values()) {
    // Meilleur 1RM estimé de chaque jour (séries de 1 à 12 répétitions, plus fiables), puis référence glissante sur 90 jours
    const parJour = new Map();
    for (const s of lignes) {
      const p = nombre(s.weight_kg);
      const r = nombre(s.reps);
      if (p > 0 && r >= 1 && r <= 12) parJour.set(iso(s), Math.max(parJour.get(iso(s)) || 0, epley(p, r)));
    }
    const jours = [...parJour.keys()].sort();
    const reference = (date) => {
      let m = 0;
      for (const j of jours) if (j <= date && ecartJours(j, date) <= FENETRE_RM) m = Math.max(m, parJour.get(j));
      return m;
    };
    const cache = new Map();
    for (const s of lignes) {
      const d = iso(s);
      const p = nombre(s.weight_kg);
      const r = nombre(s.reps);
      let intensite;
      let estimee = false;
      if (!(p > 0)) {
        intensite = INTENSITE_SANS_CHARGE;
        estimee = true;
      } else {
        if (!cache.has(d)) cache.set(d, reference(d));
        const ref = cache.get(d) || epley(p, r); // aucun 1RM connu (séries longues seulement) : on part de la série elle-même
        intensite = Math.min(1, p / ref);
      }
      sortie.push({ date: d, groupe: s.muscle_group, cle: s.exercise_key, nom: s.exercise_name, reps: r, intensite, charge: r * intensite, estimee });
    }
  }
  return sortie;
}

const arrondiPts = (v) => Math.round(v);
/** Charge totale des séries dont la date est dans [debut, fin] (ISO inclus). */
const chargeEntre = (sets, debut, fin) => sets.filter((s) => s.date >= debut && s.date <= fin).reduce((t, s) => t + s.charge, 0);

/**
 * Pour le widget de l'accueil : charge des 7 derniers jours, habitude (moyenne des 4 semaines d'avant) et ratio,
 * plus la charge de chacune des `nbSemaines` dernières périodes de 7 jours glissants.
 */
export function chargeMuscuRecente(series, nbSemaines = 12, aujourdhui = new Date()) {
  const fin = dateIsoLocale(aujourdhui);
  const sets = chargeParSerie(series);
  const parSemaine = [];
  for (let i = nbSemaines - 1; i >= 0; i--) parSemaine.push(arrondiPts(chargeEntre(sets, decalerJour(fin, -(i * 7 + 6)), decalerJour(fin, -i * 7))));
  const derniere = parSemaine[nbSemaines - 1];
  const avant = parSemaine.slice(-5, -1); // les 4 semaines d'avant
  const habituelle = avant.length ? moyenne(avant) : 0;
  const ratio = habituelle > 0 ? derniere / habituelle : null;
  return { parSemaine, derniere, habituelle: arrondiPts(habituelle), ratio, zone: zoneRatio(ratio) };
}

/** Zone du ratio charge récente / habituelle (mêmes repères que la charge générale : 0,8 à 1,3 = progression sûre). */
export function zoneRatio(r) {
  if (r == null) return { cle: 'inconnu', libelle: 'pas encore de repère', ton: 'neutre' };
  if (r > 1.5) return { cle: 'danger', libelle: 'trop haute, risque de blessure', ton: 'danger' };
  if (r > 1.3) return { cle: 'attention', libelle: 'au-dessus de ton habitude', ton: 'alerte' };
  if (r >= 0.8) return { cle: 'ok', libelle: 'dans ta zone habituelle', ton: 'ok' };
  return { cle: 'basse', libelle: 'en dessous de ton habitude', ton: 'info' };
}

const METHODE = [
  { titre: 'Comment est calculée la charge', texte: 'Chaque série pèse « répétitions × intensité », où l\'intensité est ton poids divisé par ton 1RM estimé de cet exercice (ton meilleur des 90 derniers jours, formule d\'Epley). 10 répétitions à 75 % du 1RM valent 7,5 points. Un exercice au poids du corps sans charge notée compte pour 60 % d\'intensité. Le total d\'une période est la somme de ses séries.' },
  { titre: 'Pourquoi pas le tonnage', texte: 'Le tonnage (kg soulevés) ne se compare pas entre exercices : 5 000 kg au leg press n\'ont rien à voir avec 5 000 kg aux curls. En rapportant chaque série à ton 1RM, les exercices deviennent comparables.' },
  { titre: 'Le ratio récent / habituel', texte: 'Charge des 7 derniers jours divisée par ta moyenne hebdomadaire des 4 semaines d\'avant. Entre 0,8 et 1,3, tu progresses sans à-coup ; au-delà de 1,5, les blessures deviennent plus fréquentes dans les études (repère issu du sport en général, à prendre comme un garde-fou).' },
  { titre: 'Ce que cette charge n\'est pas', texte: 'Elle mesure le travail des muscles. Elle ne se compare pas à une charge de vélo ou de course (TSS), qui mesure surtout le cœur et l\'énergie : 100 points de muscu et 100 points de vélo ne fatiguent pas pareil. Les deux s\'additionnent dans ta récupération, pas dans la même unité.' },
];

const triConseils = (c) => c.sort((a, b) => ORDRE[a.priorite] - ORDRE[b.priorite]);

/**
/** Analyse de la charge de muscu : la charge, l'intensité, puis la fatigue de chaque groupe et muscle. */
export function analyserChargeMuscu({ series, aujourdhui = new Date(), semaines = 12 } = {}) {
  const fin = dateIsoLocale(aujourdhui);
  const debut = decalerJour(lundiDe(fin), -(semaines - 1) * 7);
  const tous = chargeParSerie(series).filter((s) => s.date <= fin);
  const sets = tous.filter((s) => s.date >= debut);
  const joursTotal = new Set(sets.map((s) => s.date)).size;
  const vide = (titre, texte) => ({ id: 'chargemuscu', insuffisant: true, verdict: { niveau: 'info', titre, texte }, chiffres: [], graphiques: [], lectures: [], conseils: [], methode: METHODE });
  if (joursTotal < 4) return vide('Pas encore assez de séances', 'Il faut au moins 4 séances de muscu enregistrées sur la période pour mesurer ta charge. Enregistre tes séances (ou importe ton export Hevy), l\'analyse se remplit toute seule.');

  // Semaines civiles (lundi → dimanche) pour le graphique
  const lundis = [];
  for (let i = 0; i < semaines; i++) lundis.push(decalerJour(debut, i * 7));
  const parLundi = new Map(lundis.map((l) => [l, { iso: l, charge: 0, series: 0, jours: new Set() }]));
  for (const s of sets) {
    const w = parLundi.get(lundiDe(s.date));
    if (!w) continue;
    w.charge += s.charge;
    w.series += 1;
    w.jours.add(s.date);
  }
  const semainesListe = lundis.map((l) => parLundi.get(l));
  for (const w of semainesListe) w.charge = arrondiPts(w.charge);
  const finie = new Date(`${fin}T12:00:00`).getDay() === 0;
  const pleines = finie ? semainesListe : semainesListe.slice(0, -1);
  const actives = pleines.filter((w) => w.charge > 0);
  const moyenneHebdo = actives.length ? moyenne(actives.map((w) => w.charge)) : 0;

  // Récent contre habituel : 7 jours glissants contre les 4 semaines d'avant
  const recente = chargeMuscuRecente(series, 12, aujourdhui);
  const ratio = recente.ratio;
  const zone = recente.zone;

  // Intensité : la part de la charge faite en léger, en moyen, en lourd
  const total = sets.reduce((t, s) => t + s.charge, 0) || 1;
  const part = (f) => Math.round((sets.filter(f).reduce((t, s) => t + s.charge, 0) / total) * 100);
  const intensites = { legere: part((s) => s.intensite < 0.65), moyenne: part((s) => s.intensite >= 0.65 && s.intensite < 0.8), lourde: part((s) => s.intensite >= 0.8) };
  const intensiteMoy = sets.reduce((t, s) => t + s.intensite * s.charge, 0) / total; // moyenne pondérée par la charge
  const partEstimee = Math.round((sets.filter((s) => s.estimee).length / sets.length) * 100);

  // Par séance (un jour = une séance)
  const parJourMap = new Map();
  for (const s of sets) parJourMap.set(s.date, (parJourMap.get(s.date) || 0) + s.charge);
  const chargesSeances = [...parJourMap.values()];
  const chargeSeanceMoy = moyenne(chargesSeances);
  const plusLourde = [...parJourMap.entries()].reduce((m, e) => (e[1] > m[1] ? e : m), ['', 0]);

  // Par groupe musculaire : 7 derniers jours contre l'habitude (moyenne hebdomadaire des 4 semaines d'avant)
  const f7 = decalerJour(fin, -6);
  const a28 = decalerJour(fin, -34);
  const a8 = decalerJour(fin, -7);
  const groupes = ORDRE_GROUPES.map((g) => {
    const recent = tous.filter((s) => s.groupe === g && s.date >= f7 && s.date <= fin).reduce((t, s) => t + s.charge, 0);
    const habitude = tous.filter((s) => s.groupe === g && s.date >= a28 && s.date <= a8).reduce((t, s) => t + s.charge, 0) / 4;
    const rapport = habitude > 0 ? recent / habitude : null;
    return { groupe: g, nom: GROUPES[g].nom, recent: arrondiPts(recent), habitude: arrondiPts(habitude), rapport };
  });

  // Dynamique : tendance des semaines complètes
  const ecartPct = (() => {
    const n = Math.min(4, Math.floor(pleines.length / 2));
    if (n < 2) return null;
    const r = moyenne(pleines.slice(-n).map((w) => w.charge));
    const a = moyenne(pleines.slice(-2 * n, -n).map((w) => w.charge));
    return a > 0 ? Math.round(((r - a) / a) * 100) : null;
  })();
  const sauts = pleines.filter((w, i) => i > 0 && pleines[i - 1].charge > 0 && w.charge > pleines[i - 1].charge * 1.3).length;
  const cv = moyenneHebdo > 0 && actives.length >= 5 ? (ecartType(actives.map((w) => w.charge)) / moyenneHebdo) * 100 : null;
  let serieSansDecharge = 0;
  if (actives.length >= 5) for (let i = pleines.length - 1; i >= 0 && pleines[i].charge >= moyenneHebdo * 0.8; i--) serieSansDecharge += 1;
  const meilleure = semainesListe.reduce((m, w) => (w.charge > m.charge ? w : m), semainesListe[0]);

  const chiffres = [
    { etiquette: '7 derniers jours', valeur: String(recente.derniere), unite: 'pts', note: ratio == null ? 'pas encore de repère' : `${ratio >= 1 ? '+' : ''}${Math.round((ratio - 1) * 100)} % vs ton habitude`, ton: zone.ton === 'danger' || zone.ton === 'alerte' ? 'alerte' : '' },
    { etiquette: 'Habitude par semaine', valeur: String(recente.habituelle), unite: 'pts', note: 'moyenne des 4 semaines d\'avant' },
    { etiquette: 'Ratio récent / habituel', valeur: ratio == null ? '—' : virgule(ratio, 2), unite: '', note: zone.libelle, ton: zone.ton === 'ok' ? 'ok' : zone.ton === 'neutre' || zone.ton === 'info' ? '' : 'alerte' },
    { etiquette: 'Intensité moyenne', valeur: String(Math.round(intensiteMoy * 100)), unite: '% du 1RM', note: `${intensites.lourde} % de la charge au-dessus de 80 %` },
    { etiquette: 'Par séance', valeur: String(arrondiPts(chargeSeanceMoy)), unite: 'pts', note: `${pluriel(joursTotal, 'séance')} sur la période` },
    { etiquette: 'Meilleure semaine', valeur: String(meilleure.charge), unite: 'pts', note: `semaine du ${formatDateCourte(meilleure.iso)}` },
  ];

  const graphiques = [
    {
      type: 'lignes',
      titre: 'Charge par semaine',
      etiquettes: semainesListe.map((w) => w.iso),
      series: [
        { nom: 'Charge', couleur: 'var(--sport-muscu)', valeurs: semainesListe.map((w) => w.charge) },
        { nom: 'Moyenne', couleur: 'var(--texte-doux)', pointille: true, valeurs: semainesListe.map(() => arrondiPts(moyenneHebdo)) },
      ],
      min: 0,
    },
    {
      type: 'repartition',
      titre: 'Quelle intensité tu travailles',
      segments: [
        { nom: 'Léger (moins de 65 % du 1RM)', valeur: intensites.legere, couleur: 'color-mix(in srgb, var(--sport-muscu) 35%, var(--surface-2))' },
        { nom: 'Moyen (65 à 80 %)', valeur: intensites.moyenne, couleur: 'color-mix(in srgb, var(--sport-muscu) 65%, var(--surface-2))' },
        { nom: 'Lourd (plus de 80 %)', valeur: intensites.lourde, couleur: 'var(--sport-muscu)' },
      ],
    },
    {
      type: 'tableau',
      titre: 'Charge par groupe musculaire',
      colonnes: ['Groupe', '7 jours', 'Habitude / semaine', 'Écart'],
      lignes: groupes.map((g) => [g.nom, `${g.recent} pts`, `${g.habitude} pts`, g.rapport == null ? '—' : `${g.rapport >= 1 ? '+' : ''}${Math.round((g.rapport - 1) * 100)} %`]),
    },
  ];

  // Fatigue de chaque groupe et de chaque muscle aujourd'hui (nécessite au moins 5 journées de travail d'un groupe pour le calibrer)
  const fatigue = fatigueMusculaire(tous, fin);
  const calibres = fatigue.groupes.filter((g) => g.pct != null);
  if (calibres.length) {
    const plusFatigue = [...calibres].sort((x, y) => y.pct - x.pct)[0];
    chiffres.splice(2, 0, { etiquette: 'Groupe le plus fatigué', valeur: plusFatigue.nom, unite: '', note: `${plusFatigue.pct} % · ${texteDelai(plusFatigue.heures)}`, ton: plusFatigue.zone.ton === 'ok' || plusFatigue.zone.ton === 'info' ? '' : 'alerte' });
    graphiques.splice(1, 0, { type: 'fatigue', titre: 'Fatigue de chaque groupe musculaire', groupes: fatigue.groupes });
  }

  const rush = rushChargeMuscu({ fatigue, recente, ratio, zone, intensites, intensiteMoy, groupes, ecartPct, sauts, cv, serieSansDecharge, moyenneHebdo, meilleure, pleines, chargeSeanceMoy, joursTotal, partEstimee, plusLourde });
  const conseils = [];
  return { id: 'chargemuscu', insuffisant: false, verdict: null, chiffres, graphiques, lectures: [], conseils: triConseils(conseils), methode: METHODE, rush, brut: { recente, ratio, zone, intensites, groupes, semaines: semainesListe, moyenneHebdo, ecartPct } };
}

// ---------------------------------------------------------------------------------------------------------------------
// Analyse Rush : diagnostic croisé et plan chiffré (même sortie que rush.js)
// ---------------------------------------------------------------------------------------------------------------------
function rushChargeMuscu(d) {
  const parties = [];
  const plan = [];
  const { recente, ratio, intensites, groupes, fatigue } = d;

  // 1. Où tu en es
  if (ratio != null) {
    const r = ratio;
    let ton = 'ok';
    let texte;
    if (r > 1.5) { ton = 'attention'; texte = `Tes 7 derniers jours pèsent ${recente.derniere} points, soit ${Math.round(r * 100)} % de ton habitude (${recente.habituelle}). Au-delà de 150 %, le risque de blessure grimpe nettement dans les études sur la charge d'entraînement : tendons et articulations n'ont pas eu le temps de suivre.`; }
    else if (r > 1.3) { ton = 'attention'; texte = `Tes 7 derniers jours pèsent ${recente.derniere} points, ${Math.round(r * 100)} % de ton habitude (${recente.habituelle}). Une semaine plus chargée se digère, deux de suite deviennent un pari.`; }
    else if (r >= 0.8) texte = `Tes 7 derniers jours pèsent ${recente.derniere} points, ${Math.round(r * 100)} % de ton habitude (${recente.habituelle}) : dans la zone où l'on progresse sans à-coup.`;
    else { ton = 'info'; texte = `Tes 7 derniers jours pèsent ${recente.derniere} points, ${Math.round(r * 100)} % de ton habitude (${recente.habituelle}). Voulu (décharge), c'est bien. Subi, c'est le moment de remettre un créneau fixe.`; }
    parties.push({ titre: 'Ta semaine face à ton habitude', ton, texte });
  }

  // 1 bis. La fatigue de chaque groupe : lesquels sont frais, lesquels sont cuits, que travailler aujourd'hui
  const calibres = fatigue.groupes.filter((g) => g.pct != null);
  if (calibres.length) {
    const cuits = calibres.filter((g) => g.pct >= 45).sort((a, b) => b.pct - a.pct);
    const frais = calibres.filter((g) => g.pct < 20);
    parties.push({
      titre: 'Où en est ta fatigue',
      ton: cuits.some((g) => g.pct >= 75) ? 'attention' : cuits.length ? 'info' : 'ok',
      texte: cuits.length
        ? `${cuits.map((g) => `${g.nom} (${g.pct} %, ${texteDelai(g.heures)})`).join(', ')} : ${cuits.length > 1 ? 'ces groupes sont encore fatigués' : 'ce groupe est encore fatigué'}, évite de ${cuits.length > 1 ? 'les' : 'le'} retravailler fort tant que la fatigue n'est pas retombée.${frais.length ? ` Frais et prêts : ${frais.map((g) => g.nom.toLowerCase()).join(', ')}.` : ''}`
        : `Tous tes groupes calibrés sont frais ou à peine fatigués : tu peux t'entraîner fort sur n'importe lequel.`,
    });
    // Que travailler aujourd'hui : un groupe frais ET en retard sur ton habitude (ou jamais travaillé cette semaine)
    const retard = frais
      .map((g) => ({ g, charge: groupes.find((x) => x.groupe === g.groupe) }))
      .filter((x) => x.charge && x.charge.habitude > 0)
      .sort((a, b) => a.charge.recent / a.charge.habitude - b.charge.recent / b.charge.habitude)
      .slice(0, 2);
    if (retard.length) {
      plan.unshift({ quand: 'Aujourd\'hui', action: `Tes meilleurs groupes à travailler : ${retard.map((x) => `${x.g.nom.toLowerCase()} (frais, ${x.charge.recent} points cette semaine pour ${x.charge.habitude} d'habitude)`).join(' et ')}. C'est là que tu peux t'entraîner fort sans empiler la fatigue.` });
    }
    for (const g of cuits.filter((x) => x.pct >= 75).slice(0, 2)) plan.push({ quand: `Ménager : ${g.nom.toLowerCase()}`, action: `${g.nom} est à ${g.pct} % de fatigue : ${texteDelai(g.heures)}. Reporte-le ou travaille-le en léger (moitié de ta charge habituelle).` });
  }

  // 2. L'intensité
  const dom = intensites.lourde >= 40 ? 'lourd' : intensites.legere >= 55 ? 'leger' : 'moyen';
  parties.push({
    titre: 'L\'intensité de ton travail',
    ton: intensites.lourde >= 50 ? 'attention' : 'info',
    texte: `${intensites.legere} % de ta charge est légère (moins de 65 % du 1RM), ${intensites.moyenne} % moyenne et ${intensites.lourde} % lourde (plus de 80 %). ${{
      lourd: 'Beaucoup de lourd : excellent pour la force, mais ça fatigue le système nerveux et les tendons plus que le volume. Garde des semaines plus légères pour récupérer.',
      leger: 'Surtout du léger : bon pour le volume et la technique, mais il manque un stimulus de force. Une ou deux séries lourdes (80 % et plus) sur tes gros mouvements aideraient.',
      moyen: 'Un mélange équilibré, la base classique pour progresser en force et en volume.',
    }[dom]}`,
  });

  // 3. La fatigue par groupe : le groupe le plus chargé par rapport à l'habitude, et ceux qu'on a lâchés
  const avecRatio = groupes.filter((g) => g.rapport != null && g.habitude >= 20);
  const surcharge = [...avecRatio].sort((a, b) => b.rapport - a.rapport)[0];
  if (surcharge && surcharge.rapport >= 1.3) {
    parties.push({
      titre: 'Où ta fatigue se concentre',
      ton: surcharge.rapport > 1.5 ? 'attention' : 'info',
      texte: `${surcharge.nom} : ${surcharge.recent} points cette semaine contre ${surcharge.habitude} d'habitude (${surcharge.rapport >= 1 ? '+' : ''}${Math.round((surcharge.rapport - 1) * 100)} %). ${surcharge.groupe === 'jambes' ? 'Des jambes très chargées pèsent sur le vélo et la course des 48 heures suivantes : évite d\'enchaîner une séance de jambes lourde et une sortie dure.' : 'Ce groupe est plus fatigué que les autres : laisse-lui 48 heures avant de le retravailler fort.'}`,
    });
  }
  const lachees = avecRatio.filter((g) => g.rapport < 0.4);
  if (lachees.length) parties.push({ titre: 'Ceux que tu as lâchés', ton: 'info', texte: `${lachees.map((g) => `${g.nom.toLowerCase()} (${g.recent} points contre ${g.habitude} d'habitude)`).join(', ')}. Si ce n'est pas voulu, un groupe qu'on laisse tomber perd vite le fil.` });

  // 4. La dynamique
  if (d.ecartPct != null) {
    parties.push({ titre: 'Ta dynamique', ton: d.ecartPct > 30 ? 'attention' : 'info', texte: `Ta charge des dernières semaines est ${d.ecartPct >= 0 ? '+' : ''}${d.ecartPct} % par rapport aux semaines d'avant${d.ecartPct > 30 ? ' : une montée rapide, surveille tes articulations' : d.ecartPct < -30 ? ' : un net relâchement' : ' : une évolution raisonnable'}.${d.sauts >= 2 ? ` Elle a fait ${d.sauts} bonds de plus de 30 % d'une semaine à l'autre : la progression en dents de scie est la plus risquée.` : ''}` });
  }
  if (d.cv != null) parties.push({ titre: 'La régularité de ta charge', ton: d.cv > 45 ? 'attention' : d.cv <= 25 ? 'ok' : 'info', texte: `Ta charge varie de ±${Math.round(d.cv)} % d'une semaine à l'autre. ${d.cv > 45 ? 'C\'est très irrégulier : le corps progresse mieux avec une charge qui monte par paliers.' : d.cv <= 25 ? 'Une base stable, idéale pour progresser.' : 'Assez variable, rien d\'alarmant.'}` });
  if (d.serieSansDecharge >= 5) {
    parties.push({ titre: 'La fatigue qui s\'accumule', ton: 'attention', texte: `${d.serieSansDecharge} semaines de suite à plus de 80 % de ta charge moyenne, sans semaine allégée. Une semaine à 60 ou 70 % toutes les 4 à 6 semaines laisse le corps assimiler le travail.` });
    plan.push({ quand: 'Dans les 2 semaines', action: `Programme une semaine de décharge à environ ${arrondiPts(d.moyenneHebdo * 0.65)} points (mêmes mouvements, moins de séries, charges un peu plus légères).` });
  }
  if (d.partEstimee >= 25) parties.push({ titre: 'Une précision à connaître', ton: 'info', texte: `${d.partEstimee} % de tes séries n'ont pas de charge notée (poids du corps) : j'ai supposé un effort moyen pour elles. Note le lest ou la charge quand tu en as, la mesure sera plus juste.` });

  // Plan
  const hab = recente.habituelle;
  if (hab > 0) {
    if (ratio != null && ratio > 1.3) plan.unshift({ quand: 'Cette semaine', action: `Reviens vers ${arrondiPts(hab * 1.1)} points (tu es à ${recente.derniere}) : garde les mêmes séances, mais retire 1 ou 2 séries par exercice.` });
    else if (ratio != null && ratio < 0.8) plan.unshift({ quand: 'Cette semaine', action: `Reviens vers ${hab} points (ton habitude), puis monte d'au plus 10 % par semaine.` });
    else plan.unshift({ quand: 'Cette semaine', action: `Vise entre ${hab} et ${arrondiPts(hab * 1.1)} points : ton habitude, jusqu'à +10 %. C'est la zone où le corps s'adapte sans casser.` });
    plan.push({ quand: 'Dans 4 semaines', action: `Objectif réaliste : ${arrondiPts(hab * 1.15)} points par semaine en moyenne (+15 %), avec une semaine plus légère au milieu.` });
  }
  if (intensites.lourde < 10 && intensites.legere >= 55) plan.push({ quand: 'Ce mois-ci', action: 'Ajoute 2 séries lourdes (80 à 85 % du 1RM, 3 à 5 répétitions) sur ton squat ou ton développé : un stimulus de force qui manque à ta charge.' });
  if (!plan.length) plan.push({ quand: 'Ce mois-ci', action: 'Enregistre quelques séances de plus : la charge se calibre sur ton historique.' });

  const niveau = d.recente.derniere;
  const constat = `${niveau} points sur 7 jours${ratio != null ? `, ${Math.round(ratio * 100)} % de ton habitude` : ''}, intensité moyenne de ${Math.round(d.intensiteMoy * 100)} % du 1RM.`;
  const n = parties.filter((p) => p.ton === 'attention').length;
  const fin = n >= 2 ? 'Plusieurs signaux méritent ton attention.' : n === 1 ? 'Un point mérite ton attention.' : 'Rien ne t\'alerte.';
  return {
    accroche: `${constat} ${fin}`,
    parties,
    plan,
    profil: [
      { etiquette: '7 derniers jours', valeur: `${recente.derniere} pts` },
      { etiquette: 'Habitude / semaine', valeur: `${recente.habituelle} pts` },
      { etiquette: 'Par séance', valeur: `${arrondiPts(d.chargeSeanceMoy)} pts` },
      { etiquette: 'Intensité', valeur: `${Math.round(d.intensiteMoy * 100)} % du 1RM` },
    ],
  };
}
