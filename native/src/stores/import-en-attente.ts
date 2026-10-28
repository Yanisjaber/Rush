import type { DonneesImport } from '@/data/calendrier/import-activite';

// Ce que l'écran « Importer » a lu dans le fichier (flux compressés, trace, tours, chiffres) et que « Activité déjà faite » écrira avec la saisie.
// C'est gros (des centaines de Ko) : on ne le passe pas par les paramètres de navigation, on le garde ici le temps de l'écran de saisie.
let attente: DonneesImport | null = null;

export const garderImport = (d: DonneesImport | null) => {
  attente = d;
};
export const lireImport = (): DonneesImport | null => attente;
export const viderImport = () => {
  attente = null;
};
