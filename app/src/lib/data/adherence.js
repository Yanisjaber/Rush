// Adhérence prévu / réalisé : compare chaque effort de la structure prévue à la puissance réellement produite. Fonctions pures.
//
// Méthode :
//  - la structure est aplatie en segments dans l'ordre (effort, récupération, effort…) ;
//  - pour chaque effort en puissance, on cherche dans la courbe (1 valeur par seconde) la MEILLEURE fenêtre de la durée prévue :
//    c'est la tentative réelle de l'athlète (la récupération réelle peut durer plus longtemps que prévu) ;
//  - score d'un effort = puissance moyenne réelle / puissance cible (milieu de la fourchette) ; dépasser n'est pas « adhérent » non plus ;
//  - échauffement, récupération et retour au calme ne sont pas notés : ils servent seulement à positionner la recherche.
import { segmentsDuBloc, milieu, NOM_TYPE } from './structure.js';

const TYPES_EFFORT = new Set(['interval', 'steady']);

/** Segments dans l'ordre : [{ type, metrique, libelle, min, bas, haut, effort }]. */
export function aplatir(structure) {
  const liste = [];
  for (const b of Array.isArray(structure) ? structure : []) {
    if (!b?.work) continue;
    let n = 0;
    for (const { seg, role } of segmentsDuBloc(b)) {
      if (role === 'travail') n++;
      const bas = Number(seg.int) || 0;
      const haut = seg.intHi != null && Number(seg.intHi) > 0 ? Number(seg.intHi) : bas;
      liste.push({
        type: role === 'travail' ? b.type : 'recovery',
        metrique: b.metric || 'power',
        libelle: role === 'travail' ? `${NOM_TYPE[b.type] || b.name || 'Bloc'}${b.reps > 1 ? ` ${n}` : ''}` : 'Récupération',
        min: Number(seg.min) || 0,
        bas,
        haut,
        effort: role === 'travail' && TYPES_EFFORT.has(b.type),
      });
    }
  }
  return liste;
}

/** Meilleure fenêtre de `longueur` secondes dont le début est entre `de` et `a` (somme maximale), via des sommes cumulées. */
function meilleureFenetre(cumul, de, a, longueur) {
  const n = cumul.length - 1;
  const debutMin = Math.max(0, Math.min(de, n - longueur));
  const debutMax = Math.max(debutMin, Math.min(a, n - longueur));
  let meilleur = debutMin;
  let somme = -1;
  for (let t = debutMin; t <= debutMax; t++) {
    const s = cumul[t + longueur] - cumul[t];
    if (s > somme) {
      somme = s;
      meilleur = t;
    }
  }
  return { debut: meilleur, moyenne: somme / longueur };
}

/** Ton d'un effort selon le rapport réel / cible : 'bon' (95–110 %), 'attention' (85–95 % ou 110–125 %), 'mauvais'. */
export function tonAdherence(rapport) {
  if (rapport >= 0.95 && rapport <= 1.1) return 'bon';
  if ((rapport >= 0.85 && rapport < 0.95) || (rapport > 1.1 && rapport <= 1.25)) return 'attention';
  return 'mauvais';
}

/**
 * Adhérence d'une séance : { global (0 à 100), items: [{ libelle, minutes, cibleBas, cibleHaut, moyenne, pct, adherence, ton, tronque }] }
 * ou null si rien n'est évaluable (pas de structure en puissance, pas de courbe, pas de FTP).
 *  structure : blocs de la séance prévue · watts : puissance par seconde · ftp : FTP en watts
 */
export function calculerAdherence(structure, watts, ftp) {
  if (!Array.isArray(structure) || !structure.length) return null;
  if (!Array.isArray(watts) || !watts.length || !(Number(ftp) >= 50)) return null;
  const segments = aplatir(structure);
  if (!segments.some((s) => s.effort && s.metrique === 'power' && s.min > 0 && s.bas > 0)) return null;

  const n = watts.length;
  const cumul = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cumul[i + 1] = cumul[i] + (Number(watts[i]) || 0);

  const items = [];
  let curseur = 0;
  let poidsTotal = 0;
  let pondere = 0;
  for (const s of segments) {
    const duree = Math.round(s.min * 60);
    if (duree <= 0) continue;
    if (!s.effort || s.metrique !== 'power' || !s.bas) {
      curseur += duree;
      continue;
    }
    if (curseur >= n - 10) break; // la courbe se termine avant la fin du plan
    const longueur = Math.min(duree, n - 1);
    const fenetre = meilleureFenetre(cumul, curseur, Math.min(n - longueur, curseur + duree * 3 + 600), longueur);
    const cible = (Number(ftp) * ((s.bas + s.haut) / 2)) / 100;
    const rapport = cible > 0 ? fenetre.moyenne / cible : 0;
    const adherence = Math.max(0, 1 - Math.abs(1 - rapport));
    items.push({
      libelle: s.libelle,
      minutes: s.min,
      cibleBas: Math.round((Number(ftp) * s.bas) / 100),
      cibleHaut: Math.round((Number(ftp) * s.haut) / 100),
      moyenne: Math.round(fenetre.moyenne),
      pct: Math.round(rapport * 100),
      adherence,
      ton: tonAdherence(rapport),
      tronque: longueur < duree,
    });
    poidsTotal += duree;
    pondere += adherence * duree;
    curseur = fenetre.debut + longueur;
  }
  if (!items.length) return null;
  return { global: Math.round((pondere / poidsTotal) * 100), items };
}

/** Une valeur de planned_id est-elle un lien réel (uuid) ? 'none' = délié à la main ; vide = pas encore évalué. */
export const estLien = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Séances prévues du même jour et de la même famille de sport qu'une sortie réalisée (candidates au rapprochement). */
export function candidates(planifiees, sortie, familleDe) {
  const jour = String(sortie.start_date_local || '').slice(0, 10);
  const f = familleDe(sortie.sport);
  return (planifiees || []).filter((p) => p.category !== 'competition' && String(p.date) === jour && familleDe(p.sport) === f);
}
