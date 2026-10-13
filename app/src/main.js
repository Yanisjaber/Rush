import { mount } from 'svelte';

// Polices hébergées avec l'app (aucun appel à Google Fonts).
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';

import './lib/design/tokens.css';
import './lib/design/global.css';

import App from './App.svelte';

// Thème mémorisé (sombre par défaut), appliqué avant l'affichage pour éviter un éclair de mauvaise couleur.
try {
  document.documentElement.dataset.theme = localStorage.getItem('coachia-v2-theme') === 'clair' ? 'light' : 'dark';
} catch (e) {
  document.documentElement.dataset.theme = 'dark';
}

mount(App, { target: document.getElementById('app') });
