// Analyse Rush des autres pages : on croise les indicateurs déjà calculés (champ `brut` de chaque analyse) pour en tirer
// un diagnostic, puis un plan chiffré. Fonctions pures. Même sortie que rush-tonnage.js :
// { accroche, parties: [{ titre, ton, texte }], plan: [{ quand, action }], profil: [{ etiquette, valeur }] }.
// Les seuils viennent de repères courants en entraînement (ACWR, polarisation 80/20, volume hebdomadaire…) : ce sont des
// repères statistiques, les textes le disent quand ça compte.
import { formatKg, formatNombre } from '../utils/format.js';
import { formatTemps, formatAllure } from './maths.js';

const v1 = (v, n = 1) => String(Math.round(v * 10 ** n) / 10 ** n).replace('.', ',');
const pts = (v) => `${formatNombre(Math.round(v))} pts`;
const signe = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}`;
const pluriel = (n, mot, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`;
const maj = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Compose l'accroche : un constat, puis une conclusion selon le nombre de signaux d'alerte. */
function accroche(constat, parties, { ok = 'rien ne t\'alerte.', un = 'un point mérite ton attention.', deux = 'plusieurs signaux méritent ton attention.' } = {}) {
  const n = parties.filter((p) => p.ton === 'attention').length;
  return `${maj(constat)} ${n >= 2 ? maj(deux) : n === 1 ? maj(un) : maj(ok)}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Charge d'entraînement
// ---------------------------------------------------------------------------------------------------------------------
export function rushCharge({ brut: b }) {
  const parties = [];
  const plan = [];
  const cible = Math.round(b.chroniqueSemaine);

  parties.push({
    titre: 'Ton socle de condition',
    ton: 'info',
    texte: `Ta condition est de ${Math.round(b.ctl)} : ton corps a intégré environ ${pts(cible)} par semaine. C'est ta base : tout ce qui dépasse trop vite cette base est une charge « nouvelle » pour lui.`,
  });

  if (b.acwr != null) {
    let ton = 'ok';
    let texte;
    if (b.acwr > 1.5) { ton = 'attention'; texte = `Ton ratio aigu/chronique est de ${v1(b.acwr, 2)} : tu charges ${Math.round((b.acwr - 1) * 100)} % au-dessus de ce que ton corps connaît. Dans les études sur la blessure, au-delà de 1,5 le risque grimpe nettement (c'est un repère statistique, pas une certitude pour toi).`; }
    else if (b.acwr > 1.3) { ton = 'attention'; texte = `Ton ratio aigu/chronique est de ${v1(b.acwr, 2)} : tu es sorti de la zone la plus sûre (0,8 à 1,3). Une semaine comme ça se digère, la répéter est un pari.`; }
    else if (b.acwr >= 0.8) texte = `Ton ratio aigu/chronique est de ${v1(b.acwr, 2)} : dans la zone 0,8 à 1,3 où l'on progresse avec le moins de risque.`;
    else { ton = 'info'; texte = `Ton ratio aigu/chronique est de ${v1(b.acwr, 2)} : tu en fais moins que d'habitude. Idéal pour récupérer, mais ta condition redescend si ça dure.`; }
    parties.push({ titre: 'Charge récente contre habitude', ton, texte });
  }

  if (b.variation != null) {
    parties.push({
      titre: 'Tes 7 derniers jours',
      ton: b.variation > 30 ? 'attention' : 'info',
      texte: `${pts(b.charge7)} sur 7 jours, soit ${signe(b.variation)} % par rapport à ta moyenne des 4 semaines d'avant. ${b.variation > 30 ? 'Une hausse de plus de 30 % d\'une semaine à l\'autre est le seuil de prudence classique.' : b.variation < -30 ? 'Une grosse baisse : voulue (décharge) ou subie ?' : 'Une variation raisonnable.'}`,
    });
  }

  parties.push({
    titre: 'Vitesse de progression',
    ton: b.rampe > 8 ? 'attention' : 'info',
    texte: b.rampe > 8
      ? `Ta condition prend ${v1(b.rampe)} points cette semaine. Au-delà de 8 par semaine, tendons et articulations suivent mal : la condition (muscles, cœur) progresse plus vite que les tissus.`
      : b.rampe >= 2
        ? `Ta condition prend ${v1(b.rampe)} points cette semaine : un rythme sain, entre 2 et 8.`
        : b.rampe <= -3
          ? `Ta condition perd ${v1(-b.rampe)} points cette semaine : tu t'entraînes moins que ton niveau habituel.`
          : `Ta condition est stable cette semaine (${signe(b.rampe)} point${Math.abs(b.rampe) >= 1.5 ? 's' : ''}).`,
  });

  if (b.monotonie != null) {
    parties.push({
      titre: 'La variété de tes jours',
      ton: b.monotonie > 2.5 ? 'attention' : 'ok',
      texte: b.monotonie > 2.5
        ? `Ta monotonie est de ${v1(b.monotonie)} avec ${pluriel(b.joursActifs, 'jour')} actif${b.joursActifs > 1 ? 's' : ''} sur 7 : tes jours se ressemblent trop. Sans vrai jour facile ou de repos, la fatigue s'installe (Foster).`
        : `Ta monotonie est de ${v1(b.monotonie)} : tes jours alternent bien dur et facile, c'est ce contraste qui fait progresser.`,
    });
  }

  if (b.intensite) {
    const { facile, modere, intense, profil } = b.intensite;
    const texte = `${facile} % de ton temps est facile, ${modere} % modéré, ${intense} % intense. ${{
      polarise: 'C\'est une répartition polarisée, le modèle des endurants (environ 80 % facile, 20 % dur).',
      zone_grise: 'Beaucoup de modéré : assez dur pour fatiguer, pas assez pour progresser vite. C\'est la « zone grise ».',
      tout_facile: 'Presque tout est facile : très sûr, mais il manque un stimulus pour progresser.',
      tout_dur: 'Une grande part est intense : c\'est ce qui use le plus, la récupération devient le facteur limitant.',
      equilibre: 'Une répartition équilibrée, sans excès marqué.',
    }[profil]}`;
    parties.push({ titre: 'Comment tu répartis l\'intensité', ton: profil === 'zone_grise' || profil === 'tout_dur' ? 'attention' : 'info', texte });
  }

  if (b.sports.length > 1) {
    const [p, s] = b.sports;
    parties.push({ titre: 'Le poids de chaque sport', ton: 'info', texte: `Un sport pèse ${p.part} % de ta charge, le suivant ${s.part} %. Les sports différents se cumulent dans la même fatigue : le corps additionne tout, pas sport par sport.` });
  }

  // Plan
  if (b.acwr != null && b.acwr > 1.3) plan.push({ quand: 'Cette semaine', action: `Reste à environ ${pts(cible * 1.1)} sur 7 jours (tu es à ${pts(b.charge7)}), avec un jour de repos complet et deux séances faciles.` });
  else if (b.acwr != null && b.acwr < 0.8) plan.push({ quand: 'Cette semaine', action: `Reviens vers ${pts(cible)} : ta charge de fond. Puis monte d'au plus 10 % par semaine.` });
  else plan.push({ quand: 'Cette semaine', action: `Vise entre ${pts(cible)} et ${pts(cible * 1.1)} : le maintien, jusqu'à +10 %.` });
  if (b.intensite && b.intensite.profil === 'zone_grise') plan.push({ quand: 'Ce mois-ci', action: 'Rends tes séances faciles vraiment faciles (tu dois pouvoir parler) et garde une ou deux séances réellement dures.' });
  if (b.monotonie != null && b.monotonie > 2.5) plan.push({ quand: 'Ce mois-ci', action: 'Place au moins deux jours très faciles ou de repos par semaine, et concentre la charge sur une ou deux journées plus dures.' });
  plan.push({ quand: 'Dans 4 semaines', action: `Objectif : ${pts(cible * 1.2)} par semaine en moyenne (+20 % sur 4 semaines, soit environ +5 % par semaine), avec une semaine plus légère toutes les 3 à 4 semaines.` });

  const constat = `ta condition est de ${Math.round(b.ctl)} pour ${pts(b.charge7)} sur 7 jours${b.acwr != null ? `, ratio ${v1(b.acwr, 2)}` : ''}.`;
  return {
    accroche: accroche(constat, parties),
    parties,
    plan,
    profil: [
      { etiquette: 'Condition (CTL)', valeur: String(Math.round(b.ctl)) },
      { etiquette: 'Fatigue (ATL)', valeur: String(Math.round(b.atl)) },
      { etiquette: 'Fraîcheur (TSB)', valeur: signe(b.tsb) },
      { etiquette: 'Charge 7 jours', valeur: pts(b.charge7) },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Forme et fraîcheur
// ---------------------------------------------------------------------------------------------------------------------
export function rushForme({ brut: b }) {
  const parties = [];
  const plan = [];
  const jours = Object.values(b.dansZone).reduce((t, v) => t + v, 0) || 1;
  const pct = (c) => Math.round((b.dansZone[c] / jours) * 100);
  const tsb = b.tsb;

  let ton = 'ok';
  let texte;
  if (tsb < -30) { ton = 'attention'; texte = `Ta fraîcheur est de ${signe(tsb)} : fatigue excessive. Le corps n'a plus la marge pour encaisser de l'intensité : le risque de blessure et de maladie augmente.`; }
  else if (tsb < -10) texte = `Ta fraîcheur est de ${signe(tsb)} : charge productive. Tu es fatigué comme il faut pour progresser, mais pas pour performer.`;
  else if (tsb < 5) texte = `Ta fraîcheur est de ${signe(tsb)} : neutre, l'état normal d'un entraînement régulier.`;
  else if (tsb <= 25) texte = `Ta fraîcheur est de ${signe(tsb)} : frais. C'est la zone où l'on bat ses records, le bon moment pour une compétition ou un test.`;
  else { ton = 'info'; texte = `Ta fraîcheur est de ${signe(tsb)} : très frais, mais sans doute parce que tu t'entraînes peu. Frais ne veut pas dire en forme.`; }
  parties.push({ titre: 'Ton état aujourd\'hui', ton, texte });

  parties.push({
    titre: 'Ta condition face à ton pic',
    ton: b.partDuPic < 70 && b.depuisPic > 21 ? 'attention' : b.partDuPic >= 90 ? 'ok' : 'info',
    texte: b.depuisPic <= 7
      ? `Ta condition (${Math.round(b.ctl)}) est tout près de ton pic de la période (${Math.round(b.pic.ctl)}).`
      : `Ta condition (${Math.round(b.ctl)}) est à ${Math.round(b.partDuPic)} % de ton pic de ${Math.round(b.pic.ctl)}, atteint il y a ${b.depuisPic} jours. ${b.partDuPic < 70 ? 'Un net recul : reprendre vite fait mal, reprends progressivement.' : b.partDuPic >= 95 ? 'Tu es quasiment à ton niveau maximum de la période.' : 'Il te reste de la marge pour le retrouver.'}`,
  });

  parties.push({
    titre: 'Où tu passes ton temps',
    ton: pct('risque') >= 10 ? 'attention' : 'info',
    texte: `${pct('frais')} % de la période en fraîcheur, ${pct('transition')} % en neutre, ${pct('optimal')} % en charge productive, ${pct('detrain')} % en désentraînement et ${pct('risque')} % en fatigue excessive. ${pct('risque') >= 10 ? 'Trop de fatigue excessive : c\'est là que ça casse.' : pct('transition') >= 80 ? 'Presque tout en zone neutre : stable, mais sans phases marquées de charge ni de fraîcheur.' : pct('optimal') + pct('transition') < 30 ? 'Peu de temps en charge : la condition progresse surtout quand on charge.' : 'Un bon cycle alterne charge et fraîcheur.'}`,
  });

  if (b.tsbCourses.length) {
    const m = b.tsbCourses.reduce((t, v) => t + v, 0) / b.tsbCourses.length;
    parties.push({
      titre: 'Dans quel état tu arrives en course',
      ton: m < -8 ? 'attention' : 'info',
      texte: `Tes ${pluriel(b.tsbCourses.length, 'compétition')} récente${b.tsbCourses.length > 1 ? 's' : ''} : fraîcheur moyenne de ${signe(m)} le jour J. ${m < -8 ? 'Tu courais fatigué : un affûtage de 3 à 5 jours aiderait.' : m > 22 ? 'Peut-être trop reposé : une condition qui a commencé à baisser.' : 'Bien placé.'}`,
    });
  }

  const p = b.projection;
  if (p) {
    const a = p.affutage;
    const s0 = p.sansAffutage;
    parties.push({
      titre: `Cap sur « ${p.nom} »`,
      ton: s0.tsb < p.vise.min - 8 ? 'attention' : 'info',
      texte: `Dans ${pluriel(p.joursAvant, 'jour')}. Sans affûtage tu y arriverais à ${signe(s0.tsb)} de fraîcheur (idéal : ${signe(p.vise.min)} à ${signe(p.vise.max)}).${a ? ` Avec ${a.jours} jours d'affûtage (jusqu'à ${Math.round(a.reste * 100)} % de ta charge habituelle), tu arrives à ${signe(a.tsb)} avec une condition de ${Math.round(a.ctl)}.` : ''}`,
    });
    if (a) plan.push({ quand: `Les ${a.jours} jours avant ${p.nom}`, action: `Baisse progressivement ta charge jusqu'à environ ${Math.round(a.reste * 100)} % de l'habituel, en gardant une ou deux courtes séances à allure course pour rester vif.` });
    plan.push({ quand: 'D\'ici là', action: 'Continue ta charge normale : elle construit la condition qui servira le jour J. Ajoute tes séances au plan pour affiner la projection.' });
  } else if (tsb < -30) {
    plan.push({ quand: 'Cette semaine', action: `Deux ou trois jours très faciles ou de repos : ta fraîcheur remonterait d'environ ${Math.round(b.atl * 0.3)} points.` });
  } else if (tsb > 25 || (b.partDuPic < 70 && b.depuisPic > 21)) {
    plan.push({ quand: 'Cette semaine', action: `Reprends : vise environ ${formatNombre(Math.round(b.ctl * 7))} pts par semaine (ta charge de fond), puis +10 % par semaine.` });
  } else {
    plan.push({ quand: 'Cette semaine', action: 'Continue la charge, puis prévois une semaine plus légère (60 à 70 % du volume) toutes les 3 à 4 semaines.' });
  }
  if (!p) plan.push({ quand: 'Ce mois-ci', action: 'Ajoute une compétition à ton calendrier : Rush te calculera un affûtage sur mesure.' });

  const constat = `fraîcheur ${signe(tsb)}, condition ${Math.round(b.ctl)} (${Math.round(b.partDuPic)} % de ton pic).`;
  return {
    accroche: accroche(constat, parties, { ok: 'ton état est cohérent avec ton entraînement.' }),
    parties,
    plan,
    profil: [
      { etiquette: 'Fraîcheur (TSB)', valeur: signe(tsb) },
      { etiquette: 'Condition (CTL)', valeur: String(Math.round(b.ctl)) },
      { etiquette: 'Fatigue (ATL)', valeur: String(Math.round(b.atl)) },
      { etiquette: 'Pic de condition', valeur: String(Math.round(b.pic.ctl)) },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Prédictions de temps (course à pied)
// ---------------------------------------------------------------------------------------------------------------------
export function rushPredictions({ brut: b }) {
  const parties = [];
  const plan = [];
  const nom = { haute: 'fiable : tu as couru près de ton maximum', moyenne: 'plutôt fiable', faible: 'prudente : tes sorties étaient tranquilles, ton vrai niveau est sans doute meilleur' }[b.actuel.confiance];
  parties.push({ titre: 'Ton niveau', ton: b.actuel.confiance === 'faible' ? 'info' : 'ok', texte: `Ton VDOT est de ${v1(b.actuel.vdot)}, calculé sur ${pluriel(b.actuel.nbEfforts, 'sortie')} de 5 km et plus. L'estimation est ${nom}.` });

  const e = b.actuel.meilleurEffort;
  parties.push({ titre: 'Ta meilleure sortie récente', ton: 'info', texte: `« ${e.nom} » : ${v1(e.distanceM / 1000)} km en ${formatTemps(e.tempsS, true)}. C'est elle qui tire ton niveau : une sortie plus rapide la remplacerait.` });

  if (b.penteRelative != null) {
    parties.push({
      titre: 'Ta trajectoire',
      ton: b.fiable && b.penteRelative < -0.4 ? 'attention' : 'info',
      texte: b.fiable
        ? `Ton niveau ${b.penteRelative >= 0 ? 'monte' : 'baisse'} d'environ ${v1(Math.abs(b.penteRelative))} % par mois. ${b.penteRelative > 1.5 ? 'C\'est rapide : c\'est aussi la zone où l\'on se blesse, protège ta progression.' : b.penteRelative < -0.4 ? 'Manque de régularité, de qualité ou fatigue ? Regarde la charge.' : 'Une progression régulière.'} (Repère sain : 0,5 à 1,5 % par mois.)`
        : 'Ta tendance est trop irrégulière pour être lue avec certitude : continue d\'enregistrer des sorties de 5 km et plus.',
    });
  }

  parties.push({
    titre: 'Ton volume, la limite du marathon',
    ton: b.plus >= 0.05 ? 'attention' : 'ok',
    texte: `Tu cours environ ${Math.round(b.kmSemaine)} km par semaine. ${b.plus > 0 ? `Pour un marathon à ce niveau, c'est trop peu : j'ai ajouté ${Math.round(b.plus * 100)} % à ton temps prédit.` : 'C\'est suffisant pour que ton marathon prédit soit réaliste.'}`,
  });

  const o = b.objectif;
  if (o) {
    parties.push({
      titre: `Ton objectif : ${o.nom}`,
      ton: o.marge >= 0 ? 'ok' : 'attention',
      texte: o.ecartPct <= 0
        ? `Il demande un VDOT de ${v1(o.requis)} et tu es à ${v1(b.actuel.vdot)} : ton objectif est déjà à ta portée.`
        : `Il demande un VDOT de ${v1(o.requis)}, tu es à ${v1(b.actuel.vdot)} : ${v1(o.ecartPct)} % à gagner. À ton rythme, tu en gagneras environ ${v1(o.gainPossible)} % d'ici la course. ${o.marge >= 0 ? 'C\'est jouable si tu restes régulier.' : o.marge > -3 ? 'C\'est ambitieux pour l\'échéance.' : 'C\'est trop loin pour cette échéance : vise un temps plus réaliste ou une course plus tardive.'}`,
    });
    plan.push({ quand: `Avant ${o.nom}`, action: o.marge >= 0 ? 'Une séance de seuil par semaine est le levier le plus efficace, en gardant le reste en footing facile.' : 'Ajoute une séance d\'intervalles par semaine et sois très régulier. Garde un temps de repli en tête.' });
  }

  plan.unshift({ quand: 'Cette semaine', action: `Une séance de seuil : 3 × 10 min à ${formatAllure(b.zones.seuil)} avec 2 min de trot. Le reste en footing à ${formatAllure(b.zones.facile.de)} ou plus lent.` });
  plan.push({ quand: 'Ce mois-ci', action: b.actuel.confiance === 'faible' ? `Fais un test (5 km à fond ou 20 min d'effort) : ton niveau est probablement sous-estimé. Vise ${formatAllure(b.zones.intervalles * 1.03)} au km.` : `Une séance d'intervalles : 5 × 1 000 m à ${formatAllure(b.zones.intervalles)} avec 3 min de récupération.` });
  if (b.plus >= 0.05) plan.push({ quand: 'Dans 8 semaines', action: `Monte progressivement vers ${Math.round(Math.max(40, b.kmSemaine * 1.25))} km par semaine (jamais plus de +10 % d'une semaine à l'autre).` });

  const t10 = b.predictions[1];
  const constat = `VDOT ${v1(b.actuel.vdot)}, soit ${formatTemps(t10.secondes)} sur 10 km.`;
  return {
    accroche: accroche(constat, parties, { ok: 'ton niveau est solide, voici comment le prolonger.' }),
    parties,
    plan,
    profil: b.predictions.map((p) => ({ etiquette: p.label, valeur: formatTemps(p.secondes) })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Régularité
// ---------------------------------------------------------------------------------------------------------------------
export function rushRegularite({ brut: b }) {
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const parties = [];
  const plan = [];
  const total = b.parJour.reduce((t, v) => t + v, 0) || 1;

  parties.push({
    titre: 'Ton rythme',
    ton: b.moyenneHebdo >= 3 ? 'ok' : 'info',
    texte: `Tu t'entraînes ${v1(b.moyenneHebdo)} jour${b.moyenneHebdo >= 1.5 ? 's' : ''} par semaine en moyenne. ${b.moyenneHebdo >= 3 ? 'Au-dessus du seuil de 3 jours, le rythme qui permet de progresser dans la plupart des sports.' : b.moyenneHebdo >= 2 ? 'Entre 2 et 3 : suffisant pour entretenir, juste pour progresser vite.' : 'Sous 2 jours par semaine : difficile de progresser, surtout de façon durable.'}`,
  });
  parties.push({
    titre: 'Tes semaines tenues',
    ton: b.pct >= 50 ? 'ok' : 'attention',
    texte: `${b.tenues} semaine${b.tenues > 1 ? 's' : ''} sur ${b.nbSemaines} atteignent 3 jours (${b.pct} %). ${b.enCours >= 2 ? `Tu es sur une série de ${b.enCours} semaines tenues d'affilée` : 'Ta série est à ' + b.enCours}${b.meilleure > b.enCours ? ` (ta meilleure : ${b.meilleure})` : ''}.`,
  });
  parties.push({
    titre: 'Les pauses',
    ton: b.pauseMax >= 14 ? 'attention' : 'info',
    texte: `Ta plus longue pause est de ${pluriel(b.pauseMax, 'jour')}.${b.pauseEnCours >= 5 ? ` Tu es en pause depuis ${b.pauseEnCours} jours : plus on attend, plus c'est dur de repartir (et le corps perd de la condition au bout de 2 semaines).` : ' Au-delà de deux semaines sans séance, on perd de la condition : tu restes loin de ce seuil.'}`,
  });
  if (b.sansRepos >= 1) parties.push({ titre: 'Tes jours de repos', ton: 'attention', texte: `${pluriel(b.sansRepos, 'semaine')} avec 6 ou 7 jours d'entraînement : sans vrai jour de repos, le corps n'assimile pas le travail.` });

  const pref = b.parJour.indexOf(Math.max(...b.parJour));
  const weekend = Math.round(((b.parJour[5] + b.parJour[6]) / total) * 100);
  parties.push({ titre: 'Tes habitudes', ton: weekend >= 60 && total >= 8 ? 'attention' : 'info', texte: `Ton jour préféré est le ${JOURS[pref]} (${b.parJour[pref]} séance${b.parJour[pref] > 1 ? 's' : ''}). ${weekend} % de tes séances tombent le week-end${weekend >= 60 && total >= 8 ? ' : une séance en semaine rendrait ton rythme plus stable.' : '.'}` });
  if (b.ecart != null && Math.abs(b.ecart) >= 0.5) parties.push({ titre: 'Ta dynamique', ton: b.ecart <= -1 ? 'attention' : 'info', texte: `Sur les dernières semaines complètes, tu t'entraînes ${v1(Math.abs(b.ecart))} jour${Math.abs(b.ecart) >= 1.5 ? 's' : ''} par semaine de ${b.ecart > 0 ? 'plus' : 'moins'} qu'avant.` });

  const cibleJours = b.moyenneHebdo >= 3 ? Math.min(5, Math.ceil(b.moyenneHebdo)) : 3;
  if (b.moyenneHebdo >= 5.5) plan.push({ quand: 'Cette semaine', action: 'Ta régularité est là : l\'enjeu est maintenant de t\'accorder au moins un vrai jour sans séance, et de varier l\'intensité d\'un jour à l\'autre.' });
  else plan.push({ quand: 'Cette semaine', action: `Bloque ${cibleJours} créneaux fixes dans ton agenda, même courts : la régularité compte plus que la durée de chaque séance.` });
  if (b.vides >= 2) plan.push({ quand: 'Ce mois-ci', action: 'Évite les semaines blanches : une séance minimale de 20 minutes suffit à garder le fil.' });
  if (b.sansRepos >= 1 && b.moyenneHebdo < 5.5) plan.push({ quand: 'Ce mois-ci', action: 'Garde au moins un jour sans séance chaque semaine.' });
  plan.push({ quand: 'Dans 4 semaines', action: b.moyenneHebdo >= 5.5 ? 'Objectif : 4 semaines de suite avec au moins un jour de repos complet.' : `Objectif : ${Math.min(b.nbSemaines, 4)} semaines tenues d'affilée (3 jours ou plus). Ta série actuelle est de ${b.enCours}.` });

  const constat = `${v1(b.moyenneHebdo)} jour${b.moyenneHebdo >= 1.5 ? 's' : ''} par semaine, ${b.pct} % de semaines tenues.`;
  return {
    accroche: accroche(constat, parties, { ok: 'ton rythme est régulier.', un: 'un point à ajuster pour la régularité.' }),
    parties,
    plan,
    profil: [
      { etiquette: 'Jours par semaine', valeur: v1(b.moyenneHebdo) },
      { etiquette: 'Semaines tenues', valeur: `${b.pct} %` },
      { etiquette: 'Série en cours', valeur: pluriel(b.enCours, 'semaine') },
      { etiquette: 'Plus longue pause', valeur: pluriel(b.pauseMax, 'jour') },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Équilibre entre groupes musculaires
// ---------------------------------------------------------------------------------------------------------------------
export function rushGroupes({ brut: b }) {
  const parties = [];
  const plan = [];
  const nom = (g) => g.nom.toLowerCase();
  const manques = b.groupes.filter((g) => g.etat === 'oublie' || g.etat === 'sous');
  const dessus = b.groupes.filter((g) => g.etat === 'au-dessus');
  const dans = b.groupes.filter((g) => g.etat === 'zone');

  parties.push({
    titre: 'Où tu en es',
    ton: manques.length >= 3 ? 'attention' : manques.length ? 'info' : 'ok',
    texte: `${dans.length} groupe${dans.length > 1 ? 's' : ''} sur ${b.groupes.length} ${dans.length > 1 ? 'sont' : 'est'} dans la zone visée${dans.length ? ` (${dans.map(nom).join(', ')})` : ''}. ${manques.length ? `Sous la zone : ${manques.map(nom).join(', ')}.` : ''} ${dessus.length ? `Au-dessus : ${dessus.map(nom).join(', ')}.` : ''}`.replace(/\s+/g, ' ').trim(),
  });

  const tot = b.groupes.reduce((t, g) => t + g.parSemaine, 0);
  if (manques.length >= b.groupes.length - 1) parties.push({ titre: 'Un souci de volume, pas d\'équilibre', ton: 'info', texte: `Presque tous tes groupes sont sous leur zone : ce n'est pas tant un déséquilibre qu'un volume global modeste (${v1(tot)} séries par semaine au total). Avant de rééquilibrer, monte d'abord le volume, groupe après groupe.` });
  const plus = [...b.groupes].sort((x, y) => y.series - x.series)[0];
  parties.push({ titre: 'Ton groupe favori', ton: plus.part >= 35 ? 'attention' : 'info', texte: `${plus.nom} concentre ${plus.part} % de tes séries (${v1(plus.parSemaine)} par semaine). ${plus.part >= 35 ? 'Une grosse concentration : les autres groupes en paient le prix.' : 'Une répartition raisonnable.'}` });

  if (b.rapportDos != null) {
    parties.push({
      titre: 'Dos contre pectoraux',
      ton: b.rapportDos < 0.8 ? 'attention' : 'ok',
      texte: `Tu fais ${v1(b.rapportDos, 2)} série de dos pour 1 de pectoraux. ${b.rapportDos < 0.8 ? 'Trop de poussée par rapport au tirage : à la longue, cela arrondit les épaules. Vise au moins 0,8, idéalement 1.' : 'Un bon équilibre poussée / tirage, protecteur pour tes épaules.'}`,
    });
  }
  parties.push({
    titre: 'La place des jambes',
    ton: b.partJambes < 20 ? 'attention' : 'ok',
    texte: `Les jambes représentent ${b.partJambes} % de tes séries. ${b.partJambes < 20 ? 'Ce sont les plus gros muscles du corps : en dessous de 20 %, on parle de jambes oubliées.' : b.partJambes > 40 ? 'Beaucoup de jambes : assure-toi que le haut du corps ne passe pas à la trappe.' : 'Une bonne part.'}`,
  });

  for (const g of manques.slice(0, 3)) {
    const manque = Math.max(1, Math.round(g.cible[0] - g.parSemaine));
    plan.push({ quand: `Cette semaine : ${nom(g)}`, action: `Ajoute ${pluriel(manque, 'série')} (tu es à ${v1(g.parSemaine)} pour une zone de ${g.cible[0]} à ${g.cible[1]}), sans monter de plus de 2 ou 3 séries d'un coup.` });
  }
  if (b.rapportDos != null && b.rapportDos < 0.8) plan.push({ quand: 'Ce mois-ci', action: 'Ajoute des tirages (rowing, tractions) ou retire quelques séries de pectoraux pour tendre vers autant de dos que de pectoraux.' });
  for (const g of dessus.slice(0, 2)) plan.push({ quand: `Si tu stagnes : ${nom(g)}`, action: `${v1(g.parSemaine)} séries par semaine, au-dessus de ${g.cible[1]} : si ce groupe n'avance plus, c'est peut-être la récupération qui limite, pas le volume.` });
  if (!plan.length) plan.push({ quand: 'Ce mois-ci', action: 'Garde cet équilibre, et vérifie qu\'il tient quand ton programme change.' });

  const constat = `${dans.length} groupe${dans.length > 1 ? 's' : ''} sur ${b.groupes.length} dans la zone, ${b.partJambes} % de jambes.`;
  return {
    accroche: accroche(constat, parties, { ok: 'ton entraînement est bien réparti.', un: 'un déséquilibre à corriger.', deux: 'plusieurs déséquilibres à corriger.' }),
    parties,
    plan,
    profil: b.groupes.map((g) => ({ etiquette: g.nom, valeur: `${v1(g.parSemaine)} / sem.` })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Records et plateaux
// ---------------------------------------------------------------------------------------------------------------------
export function rushRecords({ brut: b }) {
  const parties = [];
  const plan = [];
  const { suivis, records, plateaux, progres } = b;
  const stables = suivis.filter((e) => e.statut === 'stable');

  if (records.length) parties.push({ titre: 'Tes records récents', ton: 'ok', texte: `${records.map((e) => `${e.nom} (${formatKg(e.meilleurRm)} kg)`).join(', ')} : record${records.length > 1 ? 's' : ''} battu${records.length > 1 ? 's' : ''} ces 4 dernières semaines. C'est la preuve que ton entraînement paie.` });
  if (progres.length) parties.push({ titre: 'Ceux qui montent', ton: 'ok', texte: `${progres.map((e) => e.nom).join(', ')} : la courbe monte sur les dernières séances, même sans nouveau record. Continue sur cette lancée.` });
  if (plateaux.length) parties.push({ titre: 'Ceux qui stagnent', ton: 'attention', texte: `${plateaux.map((e) => `${e.nom} (${Math.round(e.joursRecord / 7)} semaines sans record)`).join(', ')}. Les séances s'enchaînent sans progrès : le corps s'est habitué au même stimulus.` });
  if (stables.length) parties.push({ titre: 'Ceux qui tiennent', ton: 'info', texte: `${stables.map((e) => e.nom).join(', ')} : charges stables, ni record récent ni plateau inquiétant.` });

  const gains = suivis.map((e) => ({ e, g: e.dansFenetre[e.dansFenetre.length - 1].rm - e.dansFenetre[0].rm }));
  const top = gains.reduce((m, x) => (x.g > m.g ? x : m), gains[0]);
  if (top.g > 0) parties.push({ titre: 'Ton plus gros progrès', ton: 'info', texte: `${top.e.nom} : +${formatKg(top.g)} kg de 1RM estimé depuis ta première séance de la période.` });

  for (const e of plateaux.slice(0, 2)) {
    plan.push({ quand: `Casser le plateau : ${e.nom}`, action: `Une semaine plus légère (60 à 70 % de ta charge), puis change le schéma : par exemple passe de 5 × 5 à 4 × 6, ou ajoute une série à charge égale.` });
  }
  if (records.length || progres.length) plan.push({ quand: 'Pour ceux qui montent', action: 'Avance par petits pas (+1 à +2,5 kg) plutôt qu\'un gros saut : c\'est ce qui fait durer la série de progrès.' });
  if (!plan.length) plan.push({ quand: 'Ce mois-ci', action: 'Choisis un exercice principal et vise +1 répétition à charge égale, ou +2,5 kg : un petit objectif concret relance la progression.' });
  plan.push({ quand: 'Toujours', action: 'Note chaque série avec sa charge réelle : plus tes données sont précises, plus ce suivi est fiable.' });

  const plusLourd = suivis.reduce((m, e) => (e.meilleurRm > m.meilleurRm ? e : m), suivis[0]);
  const constat = `${pluriel(records.length, 'record')} récent${records.length > 1 ? 's' : ''}, ${pluriel(plateaux.length, 'plateau')}, ${suivis.length} exercices suivis.`;
  return {
    accroche: accroche(constat, parties, { ok: 'ta progression est saine.', un: 'un exercice demande un changement de stratégie.', deux: 'plusieurs exercices demandent un changement de stratégie.' }),
    parties,
    plan,
    profil: [
      { etiquette: 'Records récents', valeur: String(records.length) },
      { etiquette: 'En progression', valeur: String(progres.length) },
      { etiquette: 'En plateau', valeur: String(plateaux.length) },
      { etiquette: '1RM le plus haut', valeur: `${formatKg(plusLourd.meilleurRm)} kg` },
    ],
  };
}
