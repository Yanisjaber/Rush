import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Politique de sécurité du contenu, injectée uniquement dans le build de production
// (en développement, Vite a besoin de WebSocket et de scripts inline pour le rechargement à chaud).
// - scripts : uniquement ceux de notre origine
// - styles : l'origine + attributs style (les composants posent des couleurs de sport en ligne)
// - images : notre origine + les tuiles de carte OpenStreetMap (parcours GPX)
// - connexions : notre origine + Supabase (le projet coach-ia)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // Fonds de carte du parcours GPX (OpenStreetMap) : seules les images de leurs serveurs de tuiles sont autorisées
  "img-src 'self' data: https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self' https://gfavgstyyaaidkpadkxz.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function injecterCsp() {
  return {
    name: 'coach-ia-csp',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (ctx.server) return html; // pas en développement
        return html.replace('</head>', `  <meta http-equiv="Content-Security-Policy" content="${CSP}">\n  </head>`);
      },
    },
  };
}

export default defineConfig({
  // Chemins relatifs : la v2 sera servie dans un sous-dossier (GitHub Pages).
  base: './',
  plugins: [svelte(), injecterCsp()],
  build: { outDir: 'dist', sourcemap: false },
});
