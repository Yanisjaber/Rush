// « Seule la dernière demande compte » : quand on lance plusieurs chargements d'affilée (changement de nuit, bouton Réessayer…),
// la réponse d'un chargement plus ancien, arrivée en retard, ne doit pas écraser la plus récente.
//   const suivi = derniereDemande();  const id = suivi.nouvelle();  … await …  if (!suivi.estActuelle(id)) return;
//   suivi.annuler() : la réponse en cours (s'il y en a une) sera ignorée (ex. : le panneau vient d'être fermé).

export function derniereDemande() {
  let courante = 0;
  return {
    nouvelle: () => ++courante,
    estActuelle: (id) => id === courante,
    annuler: () => {
      courante++;
    },
  };
}
