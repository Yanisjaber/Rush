// Analyse Rush du tonnage : on croise volume, intensité, régularité et dynamique pour en tirer un vrai diagnostic.
// Fonctions pures. Entrées : les semaines déjà calculées par analyserTonnage et les séries valides de la période.
// Sortie : { accroche, parties: [{ titre, ton, texte }], plan: [{ quand, action }], profil: [{ etiquette, valeur }] }.
// Les seuils sont des repères courants en entraînement (pas des lois) : les textes le disent quand ça compte.
import { tonnageSerie } from '../data/force.js';
import { formatNombre } from '../utils/format.js';
import { moyenne, arrondi, ecartType, regression } from './maths.js';

const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v)} %`;
const kg = (v) => `${formatNombre(Math.round(v))} kg`;
const nSeances = (n) => `${n} séance${n > 1 ? 's' : ''}`;

/** Part (en %) des séries dans trois zones de répétitions : force (1-5), hypertrophie (6-12), endurance (13+). */
function zonesReps(series) {
  const t = series.filter((s) => Number(s.reps) > 0);
  if (!t.length) return null;
  const f = t.filter((s) => s.reps <= 5).length;
  const h = t.filter((s) => s.reps >= 6 && s.reps <= 12).length;
  const e = t.length - f - h;
  return { force: Math.round((f / t.length) * 100), hyper: Math.round((h / t.length) * 100), endurance: Math.round((e / t.length) * 100) };
}

export function rushTonnage({ pleines, valides, debut, fin }) {
  const actives = pleines.filter((w) => w.tonnage > 0);
  const premiere = pleines.findIndex((w) => w.jours.size > 0);
  const depuisDebut = premiere < 0 ? [] : pleines.slice(premiere); // semaines depuis ta première séance
  const dansPeriode = valides.filter((s) => String(s.date).slice(0, 10) >= debut && String(s.date).slice(0, 10) <= fin);
  const parties = [];
  const plan = [];

  // --- 1. Où tu en es par rapport à ton meilleur niveau (moyenne glissante sur 4 semaines)
  const N = 4;
  const glissantes = [];
  for (let i = 0; i + N <= pleines.length; i++) glissantes.push({ i, m: moyenne(pleines.slice(i, i + N).map((w) => w.tonnage)) });
  const recent = glissantes.length ? glissantes[glissantes.length - 1].m : 0;
  const pic = glissantes.reduce((m, g) => (g.m > m.m ? g : m), glissantes[0] || { m: 0, i: 0 });
  const partDuPic = pic.m > 0 ? Math.round((recent / pic.m) * 100) : null;
  if (partDuPic != null) {
    const ton = partDuPic >= 85 ? 'ok' : 'info';
    parties.push({
      titre: 'Ton niveau actuel',
      ton,
      texte: partDuPic >= 98
        ? `Tu es à ton meilleur niveau : ${kg(recent)} par semaine sur les ${N} dernières semaines, c'est ton record sur la période.`
        : `Sur les ${N} dernières semaines tu soulèves ${kg(recent)} par semaine, soit ${partDuPic} % de ton meilleur bloc de ${N} semaines (${kg(pic.m)}). ${partDuPic >= 85 ? 'Tu es tout près de ton sommet de volume.' : partDuPic >= 60 ? 'Il te reste de la marge pour retrouver ton pic.' : 'Tu es nettement en dessous de ton pic : ça se rattrape, mais pas en une semaine.'}`,
    });
  }

  // --- 2. Montée de charge : dernière semaine complète contre la moyenne des 4 d'avant (rapport aigu / chronique)
  const derniere = pleines[pleines.length - 1];
  const avant4 = pleines.slice(-(N + 1), -1);
  const chronique = avant4.length >= 3 ? moyenne(avant4.map((w) => w.tonnage)) : 0;
  if (derniere && chronique > 0) {
    const r = derniere.tonnage / chronique;
    let ton = 'ok';
    let texte;
    if (r > 1.5) { ton = 'attention'; texte = `Ta dernière semaine complète pèse ${Math.round(r * 100)} % de ta moyenne des 4 semaines d'avant. Au-delà de 150 %, le risque de douleurs tendineuses grimpe nettement dans les études sur la charge d'entraînement (c'est un repère statistique, pas une certitude pour toi).`; }
    else if (r > 1.3) { ton = 'attention'; texte = `Ta dernière semaine complète est à ${Math.round(r * 100)} % de ta moyenne récente : c'est une vraie bosse. Une semaine comme ça se digère, deux de suite deviennent un pari.`; }
    else if (r >= 0.8) texte = `Ta dernière semaine complète est à ${Math.round(r * 100)} % de ta moyenne récente : dans la zone 80 à 130 % que les études associent à une progression sans excès.`;
    else { ton = 'info'; texte = `Ta dernière semaine complète est à ${Math.round(r * 100)} % de ta moyenne récente : un net relâchement. Voulu (décharge), c'est bien. Subi, c'est le moment de remettre un créneau fixe.`; }
    parties.push({ titre: 'Ta dernière semaine face à ta routine', ton, texte });
  }

  // --- 3. Combien de temps sans semaine allégée (décharge) ?
  if (actives.length >= 5) {
    const ref = moyenne(actives.map((w) => w.tonnage));
    let serie = 0;
    for (let i = pleines.length - 1; i >= 0 && pleines[i].tonnage >= ref * 0.8; i--) serie += 1;
    if (serie >= 5) {
      parties.push({ titre: 'La fatigue qui s\'accumule', ton: 'attention', texte: `Tu enchaînes ${serie} semaines de suite à plus de 80 % de ton volume moyen, sans semaine allégée. Le plus souvent, on recommande une semaine à 60 ou 70 % toutes les 4 à 6 semaines : le corps assimile le travail pendant ce temps-là, et la progression repart plus fort.` });
      plan.push({ quand: 'Dans les 2 semaines', action: `Programme une semaine de décharge à environ ${kg(ref * 0.65)} (même séances, moins de séries et des charges un peu plus légères).` });
    }
  }

  // --- 4. Comment tu travailles : zones de répétitions
  const zones = zonesReps(dansPeriode);
  if (zones) {
    const dom = Object.entries(zones).sort((a, b) => b[1] - a[1])[0];
    const nom = { force: 'la force (1 à 5 répétitions)', hyper: 'la prise de volume musculaire (6 à 12 répétitions)', endurance: 'l\'endurance musculaire (13 répétitions et plus)' }[dom[0]];
    let texte = `${dom[1]} % de tes séries travaillent ${nom}. Détail : ${zones.force} % force, ${zones.hyper} % volume, ${zones.endurance} % endurance.`;
    let ton = 'info';
    if (zones.force < 5 && zones.hyper > 60) texte += ' Une touche de séries lourdes (3 à 5 répétitions) sur tes gros mouvements aiderait ta force pure, sans sacrifier le volume.';
    if (zones.endurance > 40) { ton = 'info'; texte += ' Beaucoup de séries longues : pour progresser, essaie de monter la charge et de rester entre 6 et 12 répétitions sur les exercices principaux.'; }
    parties.push({ titre: 'Comment tu travailles', ton, texte });
  }

  // --- 5. D'où vient la hausse (ou la baisse) : plus de séries ou plus de charge par série ?
  const n2 = Math.min(N, Math.floor(pleines.length / 2));
  if (n2 >= 2) {
    const a = pleines.slice(-n2);
    const b = pleines.slice(-2 * n2, -n2);
    const sA = a.reduce((t, w) => t + w.series, 0);
    const sB = b.reduce((t, w) => t + w.series, 0);
    const tA = a.reduce((t, w) => t + w.tonnage, 0);
    const tB = b.reduce((t, w) => t + w.tonnage, 0);
    if (sA > 0 && sB > 0 && tB > 0) {
      const dSeries = (sA / sB - 1) * 100;
      const dCharge = ((tA / sA) / (tB / sB) - 1) * 100;
      if (Math.abs(dSeries) >= 8 || Math.abs(dCharge) >= 8) {
        const moteur = Math.abs(dSeries) >= Math.abs(dCharge) ? 'le nombre de séries' : 'la charge moyenne par série';
        parties.push({
          titre: 'Le moteur de ta progression',
          ton: 'info',
          texte: `Tes séries ont évolué de ${pct(dSeries)} et le poids moyen soulevé par série de ${pct(dCharge)} par rapport aux ${n2} semaines d'avant. Ton tonnage bouge surtout grâce à ${moteur}. ${Math.abs(dCharge) >= Math.abs(dSeries) && dCharge > 0 ? 'Monter en charge plutôt qu\'en volume, c\'est le signe d\'une vraie progression de force.' : dSeries > 0 && dCharge < 0 ? 'Tu fais plus de séries mais plus légères : le volume grimpe sans que ta force avance forcément.' : ''}`.trim(),
        });
      }
    }
  }

  // --- 6. Régularité du volume
  if (actives.length >= 6) {
    const m = moyenne(actives.map((w) => w.tonnage));
    const cv = m > 0 ? (ecartType(actives.map((w) => w.tonnage)) / m) * 100 : 0;
    parties.push({
      titre: 'La régularité de ton volume',
      ton: cv > 45 ? 'attention' : cv <= 25 ? 'ok' : 'info',
      texte: cv > 45
        ? `Ton tonnage varie de ±${Math.round(cv)} % d'une semaine à l'autre : c'est très irrégulier. Le corps progresse mieux avec un volume qui monte par paliers qu'avec des semaines en dents de scie.`
        : cv > 25
          ? `Ton tonnage varie de ±${Math.round(cv)} % d'une semaine à l'autre : assez variable. Rien d'alarmant, mais un volume plus constant rendrait ta progression plus facile à piloter.`
          : `Ton tonnage varie de ±${Math.round(cv)} % d'une semaine à l'autre : c'est une base stable, idéale pour progresser.`,
    });
  }

  // --- 7. Projection : où ça va si tu continues comme ça (régression sur les 8 dernières semaines complètes)
  const fenetre = pleines.slice(-8).map((w) => w.tonnage);
  if (fenetre.length >= 6 && fenetre.some((v) => v > 0)) {
    const { pente, r2 } = regression(fenetre);
    const m = moyenne(fenetre);
    const parSemainePct = m > 0 ? (pente / m) * 100 : 0;
    if (r2 >= 0.25 && Math.abs(parSemainePct) >= 2) {
      parties.push({
        titre: 'Ta trajectoire',
        ton: 'info',
        texte: `Sur les 8 dernières semaines, ton volume ${pente > 0 ? 'monte' : 'descend'} d'environ ${kg(Math.abs(pente))} par semaine (${pct(parSemainePct)} par semaine). Si tu gardes cette pente, tu seras vers ${kg(Math.max(0, fenetre[fenetre.length - 1] + pente * 4))} dans 4 semaines. La tendance explique ${Math.round(r2 * 100)} % des variations : ${r2 >= 0.6 ? 'elle est nette.' : 'elle reste à confirmer.'}`,
      });
    }
  }

  // --- Plan d'action chiffré : prochaine semaine, rythme, objectif à 4 semaines
  if (recent > 0) {
    const bas = Math.round(recent * 1.0);
    const haut = Math.round(recent * 1.1);
    plan.unshift({ quand: 'Cette semaine', action: `Vise entre ${kg(bas)} et ${kg(haut)} : ta moyenne récente, jusqu'à +10 %. C'est la zone où le corps s'adapte sans casser.` });
  }
  const seancesMoy = depuisDebut.length ? moyenne(depuisDebut.map((w) => w.jours.size)) : 0;
  if (seancesMoy > 0 && seancesMoy < 3) plan.push({ quand: 'Ce mois-ci', action: `Passe de ${arrondi(seancesMoy, 1).toString().replace('.', ',')} à ${Math.floor(seancesMoy) + 1} séance${Math.floor(seancesMoy) + 1 > 1 ? 's' : ''} par semaine : à volume égal, répartir sur plus de séances limite la fatigue par séance et améliore la qualité des séries.` });
  if (recent > 0) plan.push({ quand: 'Dans 4 semaines', action: `Objectif réaliste : ${kg(recent * 1.15)} par semaine en moyenne (+15 %), avec une semaine plus légère au milieu.` });

  // --- Profil chiffré
  const seancesTotal = new Set(dansPeriode.map((s) => String(s.date).slice(0, 10))).size;
  const tonnageTotal = dansPeriode.reduce((t, s) => t + tonnageSerie(s), 0);
  const profil = [
    { etiquette: 'Tonnage total', valeur: kg(tonnageTotal) },
    { etiquette: 'Séries', valeur: formatNombre(dansPeriode.length) },
    { etiquette: 'Par séance', valeur: seancesTotal ? kg(tonnageTotal / seancesTotal) : '—' },
    { etiquette: 'Séries par séance', valeur: seancesTotal ? String(Math.round(dansPeriode.length / seancesTotal)) : '—' },
  ];

  // --- Accroche : une phrase qui résume la situation et parle à la personne
  const attention = parties.filter((p) => p.ton === 'attention').length;
  const niveau = recent > 0 ? `${kg(recent)} par semaine en ce moment${partDuPic != null ? `, soit ${partDuPic} % de ton pic` : ''}` : 'peu de volume en ce moment';
  let fin2;
  if (attention >= 2) fin2 = 'deux signaux méritent ton attention : rien de grave si tu ajustes maintenant.';
  else if (attention === 1) fin2 = 'ta base est solide, avec un point à surveiller.';
  else if (partDuPic != null && partDuPic < 60) fin2 = 'tu as de la marge pour retrouver ton niveau, sans te presser.';
  else fin2 = 'rien ne t\'alerte : le but est de tenir le rythme et de monter par paliers.';
  const accroche = `${nSeances(seancesTotal)} sur la période, ${niveau} : ${fin2}`;

  return { accroche, parties, plan, profil };
}
