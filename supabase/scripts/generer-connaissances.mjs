// Transforme les fiches de docs/ia/connaissances/*.md en un module TypeScript embarqué dans l'Edge Function
// (une Edge Function ne déploie que ce qu'elle importe : elle ne peut pas lire docs/).
//
// Lancer : node supabase/scripts/generer-connaissances.mjs
// Le test supabase/tests/edge/connaissances.test.mts échoue si le fichier généré n'est plus à jour : relancer ce script.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DOSSIER_FICHES = join(RACINE, 'docs', 'ia', 'connaissances');
export const FICHIER_INDEX = join(DOSSIER_FICHES, 'INDEX.md');
export const FICHIER_SORTIE = join(RACINE, 'supabase', 'functions', '_shared', 'connaissances-data.ts');

/** Les dossiers de sport (premier niveau) et les parties de l'entraînement (second niveau) : une fiche est rangée dans docs/ia/connaissances/<sport>/<partie>/<id>.md.
 *  « commun » = vaut pour tous les sports. Ajouter un dossier ici avant de l'utiliser (une faute de frappe dans un nom de dossier fait échouer la génération). */
export const SPORTS_DOSSIERS = { commun: 'Tous les sports', course: 'Course à pied', velo: 'Vélo', natation: 'Natation', triathlon: 'Triathlon', muscu: 'Musculation', hyrox: 'Hyrox' };
export const PARTIES = {
  endurance: "Endurance de base (volume facile, sorties longues)", intensite: 'Intensité (seuil, VO2max, vitesse, répartition)', force: 'Force et musculation', technique: 'Technique et gestes',
  planification: 'Planification (périodisation, plans, reprise)', 'charge-suivi': 'Charge et suivi (forme, monotonie, indicateurs)', recuperation: 'Récupération (sommeil, fatigue, HRV)',
  nutrition: 'Nutrition et hydratation', sante: 'Santé et blessures', mesure: 'Tests et mesures (zones, seuils)', competition: 'Compétition (affûtage, allure, jour J)',
  environnement: 'Environnement (chaleur, altitude, froid)', profils: 'Profils (débutants, femmes, vétérans, jeunes)', materiel: 'Matériel', mental: 'Mental',
};

const liste = (s) => s.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean);

function lireFiche(nom, texte, dossier, theme) {
  const m = texte.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${nom} : en-tête manquant`);
  const en = Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
  const sections = {};
  for (const bloc of ('\n' + m[2]).split(/\n## /).slice(1)) {
    const fin = bloc.indexOf('\n');
    sections[bloc.slice(0, fin).trim()] = bloc.slice(fin + 1).trim();
  }
  // Une section est repérée par le début de son titre (« Pièges » et « Pièges (à ne pas dire) » sont la même section)
  const prend = (titre) => {
    const cle = Object.keys(sections).find((k) => k.startsWith(titre));
    if (!cle) throw new Error(`${nom} : section « ${titre} » manquante`);
    return sections[cle];
  };
  const sources = [...prend('Sources').matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map((x) => ({ titre: x[1], url: x[2] }));
  const voirAussi = [...new Set([...m[2].matchAll(/\[\[([a-z0-9-]+)\]\]/g)].map((x) => x[1]))];
  const attendu = nom.replace(/\.md$/, '');
  if (en.id !== attendu) throw new Error(`${nom} : l'id (${en.id}) doit être le nom du fichier`);
  return {
    id: en.id,
    dossier,
    theme,
    titre: en.titre,
    sports: liste(en.sports),
    motsCles: liste(en.mots_cles),
    preuve: en.preuve,
    maj: en.maj,
    essentiel: prend("L'essentiel"),
    recherche: prend('Ce que dit la recherche'),
    regles: prend('Règles pour le coach'),
    pieges: prend('Pièges'),
    sources,
    voirAussi,
  };
}

/** Le contenu complet du fichier TypeScript généré */
/** Tous les fichiers .md des fiches : docs/ia/connaissances/<sport>/<partie>/<id>.md */
function listerFiches() {
  const sortie = [];
  for (const sport of readdirSync(DOSSIER_FICHES).sort()) {
    const dSport = join(DOSSIER_FICHES, sport);
    if (!statSync(dSport).isDirectory()) continue;
    if (!(sport in SPORTS_DOSSIERS)) throw new Error(`Dossier de sport inconnu : ${sport} (ajoute-le à SPORTS_DOSSIERS)`);
    for (const partie of readdirSync(dSport).sort()) {
      const dPartie = join(dSport, partie);
      if (!statSync(dPartie).isDirectory()) throw new Error(`${sport}/${partie} : une fiche va dans docs/ia/connaissances/<sport>/<partie>/`);
      if (!(partie in PARTIES)) throw new Error(`Partie inconnue : ${sport}/${partie} (ajoute-la à PARTIES)`);
      for (const f of readdirSync(dPartie).sort()) if (f.endsWith('.md')) sortie.push({ f, sport, partie, chemin: join(dPartie, f) });
    }
  }
  return sortie;
}

/** Le contenu complet du fichier TypeScript généré */
export function construire() {
  const fiches = listerFiches()
    .map((x) => lireFiche(x.f, readFileSync(x.chemin, 'utf-8'), x.sport, x.partie))
    .sort((a, b) => a.id.localeCompare(b.id));
  return [
    '// GÉNÉRÉ par supabase/scripts/generer-connaissances.mjs à partir de docs/ia/connaissances/<sport>/<partie>/*.md : NE PAS MODIFIER À LA MAIN.',
    '// Pour changer une fiche : modifier le .md puis relancer le script.',
    "import type { Fiche } from './connaissances.ts';",
    '',
    `export const FICHES: Fiche[] = ${JSON.stringify(fiches, null, 2)};`,
    '',
  ].join('\n');
}

/** L'index lisible (INDEX.md) : sport → partie → fiches, avec le niveau de preuve et le nombre de sources. Généré, ne pas modifier à la main. */
export function construireIndex() {
  const fiches = JSON.parse(JSON.stringify(JSON.parse(construire().split('export const FICHES: Fiche[] = ')[1].replace(/;\n$/, ''))));
  const lignes = ['# Index des fiches de connaissances', '', 'GÉNÉRÉ par `supabase/scripts/generer-connaissances.mjs` : ne pas modifier à la main. Une fiche est dans `<sport>/<partie>/<id>.md`.', '', `**${fiches.length} fiches.**`, ''];
  for (const [sport, nomSport] of Object.entries(SPORTS_DOSSIERS)) {
    const duSport = fiches.filter((f) => f.dossier === sport);
    lignes.push(`## ${nomSport} (\`${sport}/\`) — ${duSport.length} fiche${duSport.length > 1 ? 's' : ''}`, '');
    if (!duSport.length) { lignes.push('_Aucune fiche pour l\'instant._', ''); continue; }
    for (const [partie, nomPartie] of Object.entries(PARTIES)) {
      const l = duSport.filter((f) => f.theme === partie);
      if (!l.length) continue;
      lignes.push(`### ${nomPartie} (\`${sport}/${partie}/\`)`, '');
      for (const f of l) lignes.push(`- [${f.titre}](${sport}/${partie}/${f.id}.md) — \`${f.id}\` · preuve : ${f.preuve} · ${f.sources.length} source${f.sources.length > 1 ? 's' : ''}`);
      lignes.push('');
    }
  }
  return lignes.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(FICHIER_SORTIE, construire(), 'utf-8');
  writeFileSync(FICHIER_INDEX, construireIndex(), 'utf-8');
  console.log(`Fiches écrites dans ${FICHIER_SORTIE}`);
}
