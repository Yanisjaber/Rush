// Open Dossard (résultats officiels) : normalisation des données, statistiques du palmarès. Fonctions pures, sans réseau.
//
// Les données viennent d'un service externe : on ne garde que des champs connus, convertis en nombres ou en textes courts.
// Rien n'est jamais interprété comme du HTML ; l'affichage passe par Svelte, qui échappe tout.

const texte = (v, max = 120) => (v == null ? '' : String(v).slice(0, max));
const entier = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Résultats de recherche de licence (liste ou { data: liste }) → liste de licences propres. */
export function normaliserLicences(brut) {
  const liste = Array.isArray(brut) ? brut : Array.isArray(brut?.data) ? brut.data : [];
  return liste
    .filter((l) => l && l.id != null)
    .slice(0, 50)
    .map((l) => ({
      id: String(l.id).slice(0, 40),
      numero: texte(l.licenceNumber, 40),
      prenom: texte(l.firstName, 60),
      nom: texte(l.lastName || l.name, 80),
      club: texte(l.club, 100),
      departement: texte(l.dept, 10),
    }));
}

/** Nom affichable d'une licence. */
export function nomLicence(l) {
  const n = `${l?.prenom || ''} ${l?.nom || ''}`.trim();
  return n || l?.numero || 'Licence';
}

/** Une licence relue du navigateur est-elle bien formée ? (le navigateur n'est pas une source sûre : on revalide) */
export function licenceValide(l) {
  return !!l && typeof l === 'object' && typeof l.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(l.id) && typeof nomLicence(l) === 'string';
}

/** Palmarès brut (réponse du service) → résultats propres : { date, nom, place, total, categorie, idCompetition, source: 'od' }. */
export function normaliserResultats(brut) {
  const liste = Array.isArray(brut?.results) ? brut.results : Array.isArray(brut) ? brut : [];
  return liste
    .filter((r) => r && /^\d{4}-\d{2}-\d{2}/.test(String(r.date || '')))
    .slice(0, 2000)
    .map((r) => ({
      date: String(r.date).slice(0, 10),
      nom: texte(r.competitionName || r.name, 140),
      place: entier(r.rankingScratch),
      total: entier(r.totalInCategory),
      categorie: texte(r.catev || r.category, 30),
      idCompetition: r.competitionId != null ? String(r.competitionId).slice(0, 40) : null,
      source: 'od',
    }));
}

/** Résultats saisis à la main sur les compétitions courues (colonnes result_place, result_total, result_catev de activities). */
export function resultatsManuels(courues) {
  return (courues || [])
    .filter((a) => entier(a.result_place) != null)
    .map((a) => ({
      date: String(a.start_date_local || '').slice(0, 10),
      nom: texte(a.name, 140),
      place: entier(a.result_place),
      total: entier(a.result_total),
      categorie: texte(a.result_catev, 30),
      idCompetition: null,
      source: 'manuel',
      idActivite: a.id,
    }));
}

/** Palmarès fusionné : résultats officiels + résultats saisis. Un résultat saisi pour une date déjà officielle est ignoré (doublon). */
export function fusionner(officiels, manuels) {
  const dates = new Set((officiels || []).map((r) => r.date));
  return [...(officiels || []), ...(manuels || []).filter((m) => !dates.has(m.date))].sort((a, b) => b.date.localeCompare(a.date));
}

export const anneesDe = (resultats) => [...new Set(resultats.map((r) => Number(r.date.slice(0, 4))))].filter(Boolean).sort((a, b) => b - a);

/** Statistiques d'une année (ou 'all') : courses, victoires, podiums, top 10, meilleur résultat, répartition. */
export function statistiques(resultats, annee = 'all') {
  const liste = annee === 'all' ? resultats : resultats.filter((r) => r.date.startsWith(`${annee}-`));
  let victoires = 0;
  let podiums = 0;
  let top10 = 0;
  let meilleur = null;
  const repartition = { victoire: 0, podium: 0, top10: 0, autre: 0 };
  for (const r of liste) {
    const p = r.place;
    if (p == null) {
      repartition.autre++;
      continue;
    }
    if (p === 1) {
      victoires++;
      repartition.victoire++;
    } else if (p <= 3) repartition.podium++;
    else if (p <= 10) repartition.top10++;
    else repartition.autre++;
    if (p <= 3) podiums++;
    if (p <= 10) top10++;
    if (!meilleur || p < meilleur.place) meilleur = r;
  }
  return { courses: liste.length, victoires, podiums, top10, meilleur, repartition, tauxTop10: liste.length ? Math.round((top10 / liste.length) * 100) : 0 };
}

/** Saison par saison : [{ annee, courses, victoires, podiums, top10 }], de la plus récente à la plus ancienne. */
export function parSaison(resultats) {
  return anneesDe(resultats).map((annee) => {
    const s = statistiques(resultats, annee);
    return { annee, courses: s.courses, victoires: s.victoires, podiums: s.podiums, top10: s.top10 };
  });
}

/** Meilleur résultat (plus petite place) d'une date, ou null. */
export function resultatDuJour(resultats, iso) {
  const jour = (resultats || []).filter((r) => r.date === iso);
  if (!jour.length) return null;
  return jour.reduce((m, r) => (r.place != null && (m.place == null || r.place < m.place) ? r : m), jour[0]);
}

/** Texte d'un classement : « 3e / 45 · Cat. 3 ». */
export function texteClassement(r) {
  if (!r || r.place == null) return '';
  const rang = r.place === 1 ? '1er' : `${r.place}e`;
  return `${rang}${r.total ? ` / ${r.total}` : ''}${r.categorie ? ` · ${r.categorie}` : ''}`;
}

// --- Validation du résultat saisi à la main ---------------------------------------------------------------------------------

/** Vérifie le formulaire d'un résultat saisi (place, nombre de partants, catégorie). { valeurs, erreurs } ; tout vide = effacer. */
export function validerResultat(f) {
  const erreurs = {};
  const place = String(f.place ?? '').trim();
  const total = String(f.total ?? '').trim();
  const categorie = String(f.categorie ?? '').trim();
  if (!place && !total && !categorie) return { erreurs, valeurs: { result_place: null, result_total: null, result_catev: null } };
  const p = Number(place);
  if (!place || !Number.isInteger(p) || p < 1 || p > 100000) erreurs.place = 'Entre ta place (un nombre entier).';
  const t = total ? Number(total) : null;
  if (total && (!Number.isInteger(t) || t < 1 || t > 100000)) erreurs.total = 'Nombre de partants invalide.';
  else if (t != null && Number.isInteger(p) && p > t) erreurs.total = 'La place ne peut pas dépasser le nombre de partants.';
  if (categorie.length > 30) erreurs.categorie = '30 caractères maximum.';
  if (Object.keys(erreurs).length) return { valeurs: null, erreurs };
  return { erreurs, valeurs: { result_place: p, result_total: t, result_catev: categorie || null } };
}
