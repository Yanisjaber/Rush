import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { dateIsoLocale, msJusquaMinuit } from '@/data/outils/format';

// La date d'aujourd'hui, tenue à jour tant que l'app reste ouverte : elle change à minuit et quand l'app repasse au premier plan.
// Le Date renvoyé garde la même identité tant que le jour ne change pas (on peut s'en servir comme dépendance).
export function useAujourdhui(): Date {
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    const verifier = () => setMaintenant((ancien) => (dateIsoLocale(ancien) === dateIsoLocale(new Date()) ? ancien : new Date()));
    let minuteur: ReturnType<typeof setTimeout>;
    const programmer = () => {
      minuteur = setTimeout(() => {
        verifier();
        programmer();
      }, msJusquaMinuit(new Date()) + 1000); // une seconde après minuit, pour être sûr d'être dans le nouveau jour
    };
    programmer();
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      verifier();
      clearTimeout(minuteur); // le minuteur a pu être suspendu en arrière-plan : on le repose
      programmer();
    });
    return () => {
      clearTimeout(minuteur);
      abonnement.remove();
    };
  }, []);

  return maintenant;
}
