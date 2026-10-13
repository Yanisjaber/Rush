// Analyse de la forme : où en est ta fraîcheur, quand étais-tu au top, et comment arriver frais à ta prochaine compétition ?
// Repose sur le moteur de charge (CTL / ATL / TSB) et simule l'avenir avec tes séances prévues. Fonctions pures.
import { estimerTss } from '../data/prevue.js';
import { dateIsoLocale } from '../utils/format.js';
import { serieCharge, zoneTsb, TAU_CTL, TAU_ATL } from './moteur-charge.js';
import { moyenne, arrondi, decalerJour, ecartJours, joursEntre, somme } from './maths.js';

const virgule = (v, n = 1) => String(arrondi(v, n)).replace('.', ',');
const signe = (v) => (v > 0 ? '+' : '') + Math.round(v);

/** Charge prévue de chaque jour (ISO → points) à partir des séances planifiées (TSS indiqué, sinon estimé d'après la durée). */
export function chargesPrevues(planifiees) {
  const m = new Map();
  for (const p of planifiees || []) {
    if (p.category === 'competition' || !p.date) continue;
    const tss = Number(p.tss) > 0 ? Number(p.tss) : estimerTss(Number(p.duration), Number(p.rpe) || null);
    if (tss > 0) m.set(p.date, (m.get(p.date) || 0) + tss);
  }
  return m;
}

/** Charge moyenne de chaque jour de la semaine (0 = dimanche) sur les 28 derniers jours : ta « semaine habituelle ». */
export function profilHebdo(serie) {
  const cumul = Array(7).fill(0);
  const nb = Array(7).fill(0);
  for (const j of serie.slice(-28)) {
    const d = new Date(`${j.iso}T12:00:00`).getDay();
    cumul[d] += j.charge;
    nb[d]++;
  }
  return cumul.map((c, i) => (nb[i] ? c / nb[i] : 0));
}

/** Fait avancer (ctl, atl) jour après jour avec les charges données ; renvoie la série [{ctl, atl, tsb}] de chaque jour. */
export function simuler(ctl0, atl0, charges) {
  let ctl = ctl0;
  let atl = atl0;
  return charges.map((c) => {
    const tsb = ctl - atl; // la veille, comme dans le moteur
    ctl += (c - ctl) / TAU_CTL;
    atl += (c - atl) / TAU_ATL;
    return { ctl, atl, tsb };
  });
}

/** TSB visé le jour de la course selon sa durée (minutes) : plus c'est court, plus on peut arriver frais. */
export function tsbVise(dureeMin) {
  const d = Number(dureeMin) || 0;
  if (d && d <= 75) return { min: 10, max: 22, cible: 16 };
  if (d && d <= 240) return { min: 5, max: 16, cible: 10 };
  if (d > 240) return { min: 0, max: 10, cible: 5 };
  return { min: 5, max: 18, cible: 11 }; // durée inconnue
}

/**
 * Plans d'affûtage testés : charge des N derniers jours réduite en rampe jusqu'à `reste` (part de la charge habituelle).
 * Renvoie celui dont le TSB du jour J est le plus proche de la cible (à égalité, le plus court : on perd moins de condition).
 */
export function meilleurAffutage({ ctl0, atl0, joursAvant, base, cible }) {
  const essais = [];
  for (const n of [3, 5, 7, 10, 14]) {
    if (n > joursAvant) continue;
    for (const reste of [0.7, 0.5, 0.4]) {
      const charges = base.slice(0, joursAvant).map((c, i) => {
        const restant = joursAvant - i; // 1 = veille de la course
        if (restant > n) return c;
        const p = 1 - (1 - reste) * ((n - restant + 1) / n); // de ~1 vers `reste`
        return c * p;
      });
      const sim = simuler(ctl0, atl0, [...charges, 0]); // le jour J lui-même : la TSB du matin
      const jourJ = sim[sim.length - 1];
      essais.push({ jours: n, reste, tsb: jourJ.tsb, ctl: jourJ.ctl, charges, ecart: Math.abs(jourJ.tsb - cible) });
    }
  }
  if (!essais.length) return null;
  essais.sort((a, b) => a.ecart - b.ecart || a.jours - b.jours);
  return essais[0];
}

/**
 * Analyse complète.
 *  - seances : séances réalisées (filtrées par sport) sur toute la fenêtre + du recul
 *  - planifiees : séances prévues à venir · objectifs : compétitions à venir (la prochaine sert à la projection)
 *  - courues : compétitions passées (séances), pour savoir dans quel état tu arrivais
 */
export function analyserForme({ seances, planifiees = [], objectifs = [], courues = [], aujourdhui = new Date(), semaines = 26, nomSport = '' } = {}) {
  const fin = dateIsoLocale(aujourdhui);
  const debut = decalerJour(fin, -(semaines * 7 - 1));
  const methode = [
    { titre: 'Condition, fatigue, fraîcheur', texte: 'Modèle de Banister : condition (CTL) = moyenne exponentielle de ta charge sur 42 jours, fatigue (ATL) sur 7 jours, fraîcheur (TSB) = condition − fatigue de la veille.' },
    { titre: 'Zones de fraîcheur', texte: 'Au-dessus de +25 tu te désentraînes ; de +5 à +25 tu es frais ; de −10 à +5 neutre ; de −30 à −10 charge productive ; sous −30 la fatigue devient excessive.' },
    { titre: 'Projection', texte: 'On fait avancer le modèle jour par jour jusqu\'à ta compétition, avec tes séances prévues (complétées par ta semaine habituelle quand le plan est clairsemé), puis on teste plusieurs affûtages et on garde celui qui t\'amène le plus près de la fraîcheur idéale pour la durée de ta course.' },
    { titre: 'Fraîcheur idéale', texte: 'Épreuve de moins de 75 minutes : +10 à +22 ; jusqu\'à 4 heures : +5 à +16 ; plus long : 0 à +10 (on affûte moins pour ne pas perdre de condition).' },
  ];

  const toutes = serieCharge(seances, debut, fin);
  const premier = seances.map((s) => String(s.start_date_local).slice(0, 10)).sort()[0];
  const nb = seances.filter((s) => String(s.start_date_local).slice(0, 10) >= debut).length;
  if (!toutes.length || nb < 4 || !premier || ecartJours(premier, fin) < 21) {
    return {
      id: 'forme',
      insuffisant: true,
      verdict: { niveau: 'info', titre: 'Pas encore assez de recul', texte: 'Il faut au moins 4 séances sur 3 semaines pour estimer ta forme. Continue de t\'entraîner, l\'analyse se remplit toute seule.' },
      chiffres: [],
      graphiques: [],
      lectures: [],
      conseils: [],
      methode,
    };
  }

  const dernier = toutes[toutes.length - 1];
  const zone = zoneTsb(dernier.tsb);

  // --- Pic de condition et état par rapport à lui ---
  const pic = toutes.reduce((m, j) => (j.ctl > m.ctl ? j : m), toutes[0]);
  const partDuPic = pic.ctl > 0 ? (dernier.ctl / pic.ctl) * 100 : 100;
  const depuisPic = ecartJours(pic.iso, fin);

  // --- Temps passé dans chaque zone de fraîcheur ---
  const dansZone = { detrain: 0, frais: 0, transition: 0, optimal: 0, risque: 0 };
  for (const j of toutes) dansZone[zoneTsb(j.tsb).cle]++;
  const pct = (c) => Math.round((dansZone[c] / toutes.length) * 100);

  // --- Dans quel état arrivais-tu aux courses passées ? ---
  const joursCourse = new Map(toutes.map((j) => [j.iso, j]));
  const aLaCourse = courues
    .map((c) => ({ nom: c.name, iso: String(c.start_date_local).slice(0, 10) }))
    .map((c) => ({ ...c, j: joursCourse.get(c.iso) }))
    .filter((c) => c.j);
  const tsbCourses = aLaCourse.map((c) => c.j.tsb);

  // --- Projection jusqu'à la prochaine compétition ---
  const prochaine = [...objectifs].filter((o) => o.date > fin).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  let projection = null;
  if (prochaine) {
    const joursAvant = ecartJours(fin, prochaine.date);
    if (joursAvant >= 1 && joursAvant <= 200) {
      const prevues = chargesPrevues(planifiees);
      const futur = joursEntre(decalerJour(fin, 1), decalerJour(prochaine.date, -1));
      const habituel = Math.max(0, dernier.chronique);
      const aDesPrevues = futur.some((j) => prevues.has(j));
      const couverture = futur.length ? futur.filter((j) => prevues.has(j)).length / futur.length : 0;
      // Un plan qui couvre l'essentiel des jours est pris tel quel (les jours vides sont des repos). Un plan clairsemé est
      // complété par ta semaine habituelle : personne ne s'arrête de s'entraîner parce qu'il n'a pas tout planifié.
      const mode = !aDesPrevues ? 'habituel' : couverture >= 0.55 ? 'plan' : 'mixte';
      const profil = profilHebdo(toutes);
      const base = futur.map((j) => (prevues.has(j) ? prevues.get(j) : mode === 'plan' ? 0 : profil[new Date(`${j}T12:00:00`).getDay()]));
      const vise = tsbVise(prochaine.duration);
      const sansAffutage = simuler(dernier.ctl, dernier.atl, [...base, 0]);
      const tsbSans = sansAffutage[sansAffutage.length - 1];
      const affut = meilleurAffutage({ ctl0: dernier.ctl, atl0: dernier.atl, joursAvant: futur.length, base, cible: vise.cible });
      // on repart de la sortie de demain : simuler() est appelée sur [...charges, 0], on enlève le dernier (le jour J lui-même)
      projection = {
        nom: prochaine.name,
        date: prochaine.date,
        joursAvant,
        vise,
        sansAffutage: { tsb: tsbSans.tsb, ctl: tsbSans.ctl },
        affutage: affut,
        base,
        futur,
        aDesPrevues,
        mode,
        couverture,
        habituel,
        serieSans: sansAffutage,
        serieAffut: affut ? simuler(dernier.ctl, dernier.atl, [...affut.charges, 0]) : null,
      };
    }
  }

  // --- Verdict ---
  let verdict;
  if (zone.cle === 'risque') verdict = { niveau: 'danger', titre: 'Fatigue excessive', texte: `Ta fraîcheur est à ${signe(dernier.tsb)} : tu es très chargé. Ce n'est pas le moment d'ajouter de l'intensité, ta priorité est de récupérer.` };
  else if (partDuPic < 70 && depuisPic > 21) verdict = { niveau: 'info', titre: 'Ta condition a baissé', texte: `Tu es frais (${signe(dernier.tsb)}), mais parce que tu t'entraînes moins : ta condition est à ${Math.round(partDuPic)} % de ton pic d'il y a ${depuisPic} jours. Frais ne veut pas dire en forme : reprends progressivement.` };
  else if (zone.cle === 'detrain') verdict = { niveau: 'info', titre: 'Tu perds en condition', texte: `Ta fraîcheur est à ${signe(dernier.tsb)} depuis un moment : tu es très frais, mais parce que tu t'entraînes peu. Si ta condition est ton objectif, il est temps de reprendre.` };
  else if (zone.cle === 'frais') verdict = { niveau: 'ok', titre: 'Frais et prêt à performer', texte: `Ta fraîcheur est à ${signe(dernier.tsb)} : c'est la zone où l'on bat ses records. ${projection ? '' : 'Une compétition ou un test maintenant serait bien placé.'}` };
  else if (zone.cle === 'optimal') verdict = { niveau: 'ok', titre: 'Tu es dans la charge productive', texte: `Ta fraîcheur est à ${signe(dernier.tsb)} : tu es fatigué comme il faut pour progresser. Pas pour performer : ça, c'est après un affûtage.` };
  else verdict = { niveau: 'ok', titre: 'Forme équilibrée', texte: `Ta fraîcheur est à ${signe(dernier.tsb)} : ni très frais, ni fatigué. C'est l'état normal d'un entraînement régulier.` };

  const chiffres = [
    { etiquette: 'Fraîcheur (TSB)', valeur: signe(dernier.tsb), unite: '', note: zone.libelle, ton: zone.ton },
    { etiquette: 'Condition (CTL)', valeur: Math.round(dernier.ctl), unite: '', note: `${Math.round(partDuPic)} % de ton pic`, ton: partDuPic < 80 ? 'alerte' : 'neutre' },
    { etiquette: 'Fatigue (ATL)', valeur: Math.round(dernier.atl), unite: '', note: 'moyenne sur 7 jours', ton: 'neutre' },
    { etiquette: 'Pic de condition', valeur: Math.round(pic.ctl), unite: '', note: depuisPic === 0 ? 'aujourd\'hui' : `il y a ${depuisPic} jour${depuisPic > 1 ? 's' : ''}`, ton: 'neutre' },
  ];
  if (projection) {
    const tsbProjete = projection.affutage ? projection.affutage.tsb : projection.sansAffutage.tsb;
    chiffres.push({ etiquette: `Fraîcheur prévue à « ${projection.nom} »`, valeur: signe(tsbProjete), unite: '', note: `dans ${projection.joursAvant} jour${projection.joursAvant > 1 ? 's' : ''}${projection.affutage ? ' avec affûtage' : ''}`, ton: tsbProjete >= projection.vise.min && tsbProjete <= projection.vise.max + 8 ? 'ok' : 'alerte' });
  }

  // --- Graphiques ---
  const pas = semaines > 26 ? 3 : 1;
  const idx = toutes.map((_, i) => i).filter((i) => i % pas === 0 || i === toutes.length - 1);
  const marqueurs = [
    ...aLaCourse.filter((c) => idx.some((i) => toutes[i].iso >= c.iso)).map((c) => ({ iso: c.iso, libelle: c.nom || 'Course' })),
  ];
  const graphiques = [];
  const etHisto = idx.map((i) => toutes[i].iso);
  let etiquettes = etHisto;
  let ctlH = idx.map((i) => arrondi(toutes[i].ctl, 1));
  let atlH = idx.map((i) => arrondi(toutes[i].atl, 1));
  let tsbH = idx.map((i) => arrondi(toutes[i].tsb, 1));
  const series = [];
  if (projection) {
    const futur = projection.futur.concat(projection.date);
    const choisie = projection.serieAffut || projection.serieSans;
    etiquettes = [...etHisto, ...futur];
    const nulH = etHisto.map(() => null);
    const proj = (cle) => [...nulH.slice(0, -1), arrondi(toutes[toutes.length - 1][cle], 1), ...choisie.map((p) => arrondi(p[cle], 1))];
    series.push(
      { nom: 'Condition', couleur: 'var(--sport-velo)', valeurs: [...ctlH, ...futur.map(() => null)] },
      { nom: 'Fatigue', couleur: 'var(--sport-course)', valeurs: [...atlH, ...futur.map(() => null)] },
      { nom: 'Condition prévue', couleur: 'var(--sport-velo)', pointille: true, valeurs: proj('ctl') },
      { nom: 'Fatigue prévue', couleur: 'var(--sport-course)', pointille: true, valeurs: proj('atl') },
    );
    tsbH = [...tsbH, ...futur.map(() => null)];
    const tsbProj = [...nulH.slice(0, -1), arrondi(toutes[toutes.length - 1].tsb, 1), ...choisie.map((p) => arrondi(p.tsb, 1))];
    graphiques.push({
      type: 'lignes',
      titre: 'Condition et fatigue, passé et prévu',
      description: `En pointillés : ce qui t'attend jusqu'à « ${projection.nom} » ${projection.affutage ? 'avec l\'affûtage conseillé' : 'avec ta charge actuelle'}.`,
      etiquettes,
      series,
      marqueurs: [...marqueurs, { iso: projection.date, libelle: projection.nom }],
    });
    graphiques.push({
      type: 'lignes',
      titre: 'Fraîcheur (TSB)',
      description: 'Vise la bande verte le jour de ta course. En dessous de −30 la fatigue devient excessive.',
      etiquettes,
      series: [
        { nom: 'Fraîcheur', couleur: 'var(--texte)', valeurs: tsbH },
        { nom: 'Fraîcheur prévue', couleur: 'var(--texte)', pointille: true, valeurs: tsbProj },
      ],
      bandes: [
        { de: projection.vise.min, a: projection.vise.max, couleur: 'var(--ok)', libelle: 'Idéal le jour J' },
        { de: -80, a: -30, couleur: 'var(--danger)', libelle: 'Fatigue excessive' },
      ],
      marqueurs: [...marqueurs, { iso: projection.date, libelle: projection.nom }],
    });
  } else {
    graphiques.push({
      type: 'lignes',
      titre: 'Condition et fatigue',
      description: 'La condition monte avec la régularité, la fatigue réagit à chaque séance. Leur écart est ta fraîcheur.',
      etiquettes,
      series: [
        { nom: 'Condition', couleur: 'var(--sport-velo)', valeurs: ctlH },
        { nom: 'Fatigue', couleur: 'var(--sport-course)', valeurs: atlH },
      ],
      marqueurs,
    });
    graphiques.push({
      type: 'lignes',
      titre: 'Fraîcheur (TSB)',
      description: 'De +5 à +25 tu es frais et prêt à performer. Entre −30 et −10, tu es en charge productive. En dessous de −30, fatigue excessive.',
      etiquettes,
      series: [{ nom: 'Fraîcheur', couleur: 'var(--texte)', valeurs: tsbH }],
      bandes: [
        { de: 5, a: 25, couleur: 'var(--ok)', libelle: 'Frais' },
        { de: -80, a: -30, couleur: 'var(--danger)', libelle: 'Fatigue excessive' },
      ],
      marqueurs,
    });
  }
  graphiques.push({
    type: 'repartition',
    titre: 'Temps passé dans chaque zone',
    description: `Sur ${semaines} semaines. Un bon cycle alterne des périodes de charge et des périodes fraîches.`,
    segments: [
      { nom: 'Désentraînement', valeur: pct('detrain'), couleur: 'var(--sport-neutre)' },
      { nom: 'Frais', valeur: pct('frais'), couleur: 'var(--ok)' },
      { nom: 'Neutre', valeur: pct('transition'), couleur: 'var(--sport-velo)' },
      { nom: 'Charge productive', valeur: pct('optimal'), couleur: 'var(--sport-hybride)' },
      { nom: 'Fatigue excessive', valeur: pct('risque'), couleur: 'var(--danger)' },
    ],
  });

  // --- Lectures ---
  const lectures = [];
  lectures.push(`Ta condition est de ${Math.round(dernier.ctl)}${depuisPic > 7 ? `, soit ${Math.round(partDuPic)} % de ton pic de ${Math.round(pic.ctl)} atteint il y a ${depuisPic} jours` : ' : tu es proche de ton meilleur niveau de la période'}.`);
  if (pct('risque') >= 10) lectures.push(`Tu as passé ${pct('risque')} % de la période en fatigue excessive : c'est trop.`);
  if (pct('detrain') >= 25) lectures.push(`${pct('detrain')} % de la période en désentraînement : de longues phases très fraîches, mais sans charge.`);
  if (tsbCourses.length) lectures.push(`À tes ${tsbCourses.length} dernières compétitions de la période, tu arrivais avec une fraîcheur moyenne de ${signe(moyenne(tsbCourses))}${moyenne(tsbCourses) < 0 ? ' : tu courais fatigué' : moyenne(tsbCourses) > 22 ? ' : tu étais peut-être trop reposé' : ' : bien placé'}.`);
  if (projection) {
    const a = projection.affutage;
    lectures.push(`« ${projection.nom} » est dans ${projection.joursAvant} jours. ${projection.mode === 'plan' ? 'Avec ton plan' : projection.mode === 'mixte' ? 'Avec tes séances prévues, complétées par ta semaine habituelle' : 'Si tu gardes ta semaine habituelle'}, tu y arriverais à ${signe(projection.sansAffutage.tsb)} de fraîcheur (idéal : ${signe(projection.vise.min)} à ${signe(projection.vise.max)}).`);
    if (a) lectures.push(`Avec un affûtage de ${a.jours} jours (jusqu'à ${Math.round(a.reste * 100)} % de ta charge habituelle la veille), tu arrives à ${signe(a.tsb)} avec une condition de ${Math.round(a.ctl)}.`);
  }

  // --- Conseils ---
  const conseils = [];
  if (projection) {
    const { affutage: a, vise, sansAffutage: s0, joursAvant } = projection;
    if (a && joursAvant <= a.jours + 3) {
      conseils.push({ priorite: 'haute', titre: 'Commence l\'affûtage maintenant', texte: `Réduis ta charge progressivement sur les ${a.jours} prochains jours jusqu'à environ ${Math.round(a.reste * 100)} % de ton volume habituel, en gardant une ou deux courtes séances à allure course pour rester vif. Tu arriveras à ${signe(a.tsb)} de fraîcheur le jour J.` });
    } else if (a) {
      const debutAffut = decalerJour(projection.date, -a.jours);
      conseils.push({ priorite: 'moyenne', titre: `Prévois ton affûtage à partir du ${debutAffut.slice(8)}/${debutAffut.slice(5, 7)}`, texte: `D'ici là, continue ta charge normale : elle construit la condition qui servira le jour J. Ensuite, ${a.jours} jours de baisse progressive (jusqu'à ${Math.round(a.reste * 100)} % du volume) te mettront à ${signe(a.tsb)} de fraîcheur, dans ta zone idéale.` });
    }
    if (s0.tsb < vise.min - 8) conseils.push({ priorite: 'haute', titre: 'Sans affûtage, tu arriverais fatigué', texte: `Avec ton plan actuel, tu serais à ${signe(s0.tsb)} de fraîcheur à « ${projection.nom} », sous la zone idéale (${signe(vise.min)} à ${signe(vise.max)}). Un affûtage est indispensable.` });
    if (s0.tsb > vise.max + 12) conseils.push({ priorite: 'moyenne', titre: 'Tu arriverais trop reposé', texte: `À ${signe(s0.tsb)}, tu serais plus frais que nécessaire : ta condition aura baissé. Ajoute quelques séances de qualité avant le dernier affûtage.` });
    if (projection.mode !== 'plan') conseils.push({ priorite: 'faible', titre: 'Planifie tes séances', texte: projection.mode === 'habituel' ? 'Tu n\'as encore rien de prévu avant la course : la projection suppose ta semaine habituelle. Ajoute tes séances au plan pour qu\'elle devienne exacte.' : `Seulement ${Math.round(projection.couverture * 100)} % des jours avant la course ont une séance prévue : la projection complète avec ta semaine habituelle. Ajoute tes séances au plan pour la rendre exacte.` });
  }
  if (zone.cle === 'risque') conseils.push({ priorite: 'haute', titre: 'Récupère avant tout', texte: `À ${signe(dernier.tsb)}, deux ou trois jours très faciles ou de repos ramèneraient ta fraîcheur d'environ ${Math.round(dernier.atl * 0.3)} points. Insister maintenant augmente le risque de blessure et de maladie.` });
  if ((zone.cle === 'detrain' || (partDuPic < 70 && depuisPic > 21)) && !projection) conseils.push({ priorite: 'moyenne', titre: 'Reprends progressivement', texte: `Tu es à ${signe(dernier.tsb)} : ta condition est en train de baisser (${Math.round(partDuPic)} % de ton pic). Reviens vers ${Math.round(dernier.ctl * 7 * 1.0)} points par semaine, puis monte de 10 % par semaine.` });
  if (zone.cle === 'frais' && !projection) conseils.push({ priorite: 'info', titre: 'Profites-en', texte: 'Tu es au sommet de ta fraîcheur : c\'est le bon moment pour un test, une compétition ou une séance clé. Après, reprends la charge progressivement.' });
  if (zone.cle === 'optimal' && !projection) conseils.push({ priorite: 'info', titre: 'Continue la charge, puis place du repos', texte: 'Tu construis ta condition. Prévois une semaine plus légère (60 à 70 % du volume) toutes les 3 à 4 semaines pour absorber la charge.' });
  if (tsbCourses.length && moyenne(tsbCourses) < -8) conseils.push({ priorite: 'moyenne', titre: 'Tu arrivais fatigué en course', texte: `Ta fraîcheur moyenne le jour de tes compétitions était de ${signe(moyenne(tsbCourses))}. Vise plutôt +5 à +15 : trois à cinq jours de baisse de charge avant la course feraient la différence.` });
  if (!conseils.length) conseils.push({ priorite: 'info', titre: 'Rien à corriger', texte: 'Ta fraîcheur et ta condition sont cohérentes. Ajoute une compétition à ton calendrier pour que je te prépare un affûtage sur mesure.' });
  const ordre = { haute: 0, moyenne: 1, faible: 2, info: 3 };
  conseils.sort((a, b) => ordre[a.priorite] - ordre[b.priorite]);

  return {
    id: 'forme',
    insuffisant: false,
    verdict,
    chiffres,
    graphiques,
    lectures,
    conseils,
    methode,
    brut: { ctl: dernier.ctl, atl: dernier.atl, tsb: dernier.tsb, pic, partDuPic, depuisPic, dansZone, projection, tsbCourses },
  };
}
