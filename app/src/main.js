import { mount } from 'svelte';

// Polices hébergées avec l'app (aucun appel à Google Fonts).
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';

import './lib/design/tokens.css';
import './lib/design/global.css';

import App from './App.svelte';
import { migrerClesLocales } from './lib/stockage-local.js';

// Pas de zoom au pincement : Safari sur iPhone ignore parfois la balise viewport, ses gestes de zoom sont donc bloqués ici aussi.
for (const geste of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(geste, (e) => e.preventDefault());
}

// Les réglages du navigateur ont changé de nom avec l'app : on les recopie une fois sous leur nouveau nom, avant de les lire.
migrerClesLocales();

// Thème mémorisé (sombre par défaut), appliqué avant l'affichage pour éviter un éclair de mauvaise couleur.
try {
  document.documentElement.dataset.theme = localStorage.getItem('rush-theme') === 'clair' ? 'light' : 'dark';
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}

mount(App, { target: document.getElementById('app') });
