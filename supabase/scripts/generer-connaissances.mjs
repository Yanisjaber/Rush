// Transforme les fiches de docs/ia/connaissances/*.md en un module TypeScript embarqué dans l'Edge Function
// (une Edge Function ne déploie que ce qu'elle importe : elle ne peut pas lire docs/).
//
// Lancer : node supabase/scripts/generer-connaissances.mjs
// Le test supabase/tests/edge/connaissances.test.mts échoue si le fichier généré n'est plus à jour : relancer ce script.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DOSSIER_FICHES = join(RACINE, 'docs', 'ia', 'connaissances');
export const FICHIER_SORTIE = join(RACINE, 'supabase', 'functions', '_shared', 'connaissances-data.ts');

const liste = (s) => s.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean);

function lireFiche(nom, texte) {
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
  return {
    id: en.id,
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
export function construire() {
  const fiches = readdirSync(DOSSIER_FICHES)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map((f) => lireFiche(f, readFileSync(join(DOSSIER_FICHES, f), 'utf-8')));
  return [
    '// GÉNÉRÉ par supabase/scripts/generer-connaissances.mjs à partir de docs/ia/connaissances/*.md : NE PAS MODIFIER À LA MAIN.',
    '// Pour changer une fiche : modifier le .md puis relancer le script.',
    "import type { Fiche } from './connaissances.ts';",
    '',
    `export const FICHES: Fiche[] = ${JSON.stringify(fiches, null, 2)};`,
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(FICHIER_SORTIE, construire(), 'utf-8');
  console.log(`Fiches écrites dans ${FICHIER_SORTIE}`);
}
