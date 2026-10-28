import { RepartitionZones } from '@/components/RepartitionZones';
import { repartitionAllure } from '@/data/sports/course';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Où passe ton temps de course sur les 4 dernières semaines, zone d'allure par zone d'allure (zones recalculées depuis ta vitesse seuil).
// Une sortie est classée tout entière dans la zone de son allure moyenne : c'est une estimation, le grand format le dit.
export function WidgetZonesAllure({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const seuil = contexte.profil?.extras?.threshold_speed;
  const aSeuil = Number(seuil) > 0;
  return (
    <RepartitionZones
      taille={taille}
      titre="Zones d'allure"
      couleur={p.sportCourse}
      rep={repartitionAllure(contexte.toutesSeances, seuil)}
      videTuile={aSeuil ? 'Pas de course récente' : 'Renseigne ta vitesse seuil'}
      videL={aSeuil ? 'Pas de course sur les 4 dernières semaines.' : 'Renseigne ta vitesse seuil dans Paramètres › Physiologie pour voir où passe ton temps de course.'}
      uniteTotal="de course, 4 semaines"
      pied="Chaque sortie est classée dans la zone de son allure moyenne : une estimation."
    />
  );
}
