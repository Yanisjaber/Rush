import { useSyncExternalStore } from 'react';
import { filtreApres, filtreValide } from '@/data/menu';

// État du menu des sports : les sports proposés et le filtre choisi. Partagé par tous les écrans
// (on choisit « Course » sur l'Accueil, le Calendrier reste sur « Course »).
// Pour l'instant : les sports de la démo. Plus tard : les sports choisis dans le compte (user_preferences)
// plus ceux que les données révèlent (une séance de muscu, un programme, un test Hyrox…).
interface EtatMenu {
  familles: string[];
  filtre: string;
}

let etat: EtatMenu = { familles: ['course', 'velo', 'muscu', 'hyrox'], filtre: 'tout' };
const ecouteurs = new Set<() => void>();

function abonner(fn: () => void) {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
}

/** Choisit le sport affiché ; recliquer sur le sport déjà choisi revient à « Tous ». */
export function choisirFiltre(famille: string) {
  const filtre = filtreApres(etat.filtre, famille);
  if (filtre === etat.filtre) return;
  etat = { ...etat, filtre };
  ecouteurs.forEach((fn) => fn());
}

/** Le menu courant ; le filtre est déjà vérifié (un sport retiré du menu donne « tout »). */
export function useMenu(): EtatMenu {
  const e = useSyncExternalStore(abonner, () => etat, () => etat);
  return { familles: e.familles, filtre: filtreValide(e.filtre, e.familles) };
}
