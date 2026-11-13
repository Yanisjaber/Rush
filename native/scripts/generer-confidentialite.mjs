// Génère la page publique de la politique de confidentialité (app/public/confidentialite.html) à partir du texte de l'app.
// Usage (depuis native/) : node --no-warnings scripts/generer-confidentialite.mjs
// Une seule source : src/data/confidentialite.ts. La page est servie à https://yanisjaber.github.io/Rush/confidentialite.html
// (adresse à donner à l'App Store et au Play Store). Page autonome : pas de script, pas de police ni d'appel externe.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CONTACT, DATE_MAJ, SECTIONS } from '../src/data/confidentialite.ts';

const echapper = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sections = SECTIONS.map((s) => {
  const ps = (s.paragraphes ?? []).map((t) => `<p>${echapper(t)}</p>`).join('\n      ');
  const ul = s.puces?.length ? `<ul>\n${s.puces.map((t) => `        <li>${echapper(t)}</li>`).join('\n')}\n      </ul>` : '';
  return `    <section id="${echapper(s.id)}">\n      <h2>${echapper(s.titre)}</h2>\n      ${ul}\n      ${ps}\n    </section>`;
}).join('\n');

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Confidentialité · Rush</title>
  <meta name="description" content="Politique de confidentialité de Rush : ce qui est enregistré, où, qui y accède, le Coach IA et tes droits.">
  <style>
    :root { --fond: #f5f4f0; --texte: #14161a; --doux: #4a4f5a; --trait: #dcd9d0; color-scheme: light dark; }
    @media (prefers-color-scheme: dark) { :root { --fond: #0c0d10; --texte: #f2f3f5; --doux: #b4b9c4; --trait: #262a33; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--fond); color: var(--texte); font: 17px/1.6 -apple-system, "Helvetica Neue", Arial, sans-serif; }
    main { max-width: 720px; margin: 0 auto; padding: 32px 20px 72px; }
    h1 { font-size: clamp(34px, 7vw, 48px); line-height: 1.05; margin: 0 0 6px; }
    h2 { font-size: 22px; margin: 36px 0 8px; padding-top: 20px; border-top: 1px solid var(--trait); }
    p, li { color: var(--doux); }
    ul { padding-left: 20px; } li { margin: 8px 0; }
    .maj { font-size: 14px; margin: 0 0 8px; }
    a { color: var(--texte); }
  </style>
</head>
<body>
  <main>
    <h1>Confidentialité</h1>
    <p class="maj">Rush · dernière mise à jour : ${echapper(DATE_MAJ)}</p>
${sections}
    <section id="contact">
      <h2>Contact</h2>
      <p>Une question, une demande d’accès, de correction ou de suppression ? Écris à Yanis : <a href="mailto:${echapper(CONTACT)}">${echapper(CONTACT)}</a>.</p>
    </section>
  </main>
</body>
</html>
`;

const sortie = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'public', 'confidentialite.html');
writeFileSync(sortie, html);
console.log(`Écrit : app/public/confidentialite.html (${SECTIONS.length} sections)`);
