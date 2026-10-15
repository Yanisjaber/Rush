// Taille de l'écran, partagée : `ecran.telephone` est vrai sous 760 px de large (la même limite que les règles CSS « téléphone »).
// Sert aux widgets qui changent de FORME sur téléphone (tuiles compactes), pas seulement de taille.
const requete = typeof matchMedia === 'function' ? matchMedia('(max-width: 760px)') : null;

export const ecran = $state({ telephone: requete ? requete.matches : false });

if (requete) requete.addEventListener('change', (e) => (ecran.telephone = e.matches));
