import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Filet de sécurité : le build ne détecte pas un nom utilisé sans import (ReferenceError seulement à l'ouverture de la page).
// On vérifie que les aides les plus utilisées sont bien importées ou déclarées partout où on s'en sert.
const NOMS = ['untrack', 'onMount', 'onDestroy', 'tick', 'route', 'ouvrirPanneau', 'fermerPanneau', 'regler', 'aller', 'construireAdresse', 'changerSport', 'lienPage', 'menu', 'auth', 'donnees', 'rafraichir', 'SPORTS', 'couleurSport', 'familleAffichage', 'dateIsoLocale', 'estimerTss'];

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((f) => {
    const p = join(dossier, f);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(svelte|js)$/.test(f) ? [p] : [];
  });
}

test('aucun fichier n\'utilise une aide courante sans l\'importer ou la déclarer', () => {
  const problemes = [];
  for (const f of fichiers('src')) {
    const s = readFileSync(f, 'utf8');
    const code = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, '""');
    for (const n of NOMS) {
      const utilise = new RegExp(`(?<![\\w.$])${n}\\s*[(.]`).test(code) || new RegExp(`(?<![\\w.$])${n}\\b(?=\\s*[,)}\\]])`).test(code);
      if (!utilise) continue;
      const declare =
        new RegExp(`import[^;]*\\b${n}\\b[^;]*from`).test(s) ||
        new RegExp(`(const|let|function|var)\\s+${n}\\b`).test(s) ||
        new RegExp(`\\{[^}]*\\b${n}\\b[^}]*\\}\\s*=\\s*\\$props`).test(s) ||
        new RegExp(`export (const|function|async function) ${n}\\b`).test(s) ||
        new RegExp(`\\(\\s*${n}\\s*[,)=]`).test(code) || // paramètre de fonction
        new RegExp(`[,(]\\s*${n}\\s*\\)?\\s*=>`).test(code);
      if (!declare) problemes.push(`${f} : « ${n} »`);
    }
  }
  assert.deepEqual(problemes, []);
});
