import { elementsDuJour, seancesDuJour } from './aujourdhui.ts';
import type { Contexte } from '../types.ts';

// Où mène le toucher d'un widget de l'Accueil. Un widget absent d'ici reste une carte fixe (pas de toucher).
// Une destination est soit un écran avec ses paramètres (`ecran`), soit un onglet (`onglet`).
export type Destination =
  | { type: 'ecran'; pathname: '/seance' | '/prevue'; params: Record<string, string> }
  | { type: 'onglet'; chemin: '/calendrier' | '/bilan' };

const VERS_BILAN = new Set(['charge', 'forme', 'regularite']);
const VERS_CALENDRIER = new Set(['semaine', 'avenir']);

export function destinationWidget(id: string, contexte: Contexte, aujourdhui: Date = new Date()): Destination | null {
  if (VERS_BILAN.has(id)) return { type: 'onglet', chemin: '/bilan' };
  if (VERS_CALENDRIER.has(id)) return { type: 'onglet', chemin: '/calendrier' };

  if (id === 'dernieres') {
    const derniere = contexte.dernieres[0];
    return derniere ? { type: 'ecran', pathname: '/seance', params: { id: derniere.id } } : null;
  }

  if (id === 'objectif') {
    const objectif = contexte.objectifs[0];
    return objectif ? { type: 'ecran', pathname: '/prevue', params: { id: objectif.id, competition: '1' } } : null;
  }

  if (id === 'aujourdhui' || id === 'seancedujour') {
    // La première séance prévue pas encore faite ; à défaut, rien (« Repos » n'ouvre rien)
    const elements = elementsDuJour(seancesDuJour(contexte.planifiees, contexte.toutesSeances, aujourdhui));
    const aFaire = elements.find((e) => e.prevue && !e.fait);
    if (!aFaire) return null;
    const prevue = contexte.planifiees.find((p) => `p${p.id}` === aFaire.cle);
    if (!prevue) return null;
    return { type: 'ecran', pathname: '/prevue', params: prevue.category === 'competition' ? { id: prevue.id, competition: '1' } : { id: prevue.id } };
  }

  return null;
}
