import { RepartitionZones } from '@/components/RepartitionZones';
import type { WidgetProps } from '@/data/types';
import { ftpReference, repartitionPuissance } from '@/data/velo';
import { usePalette } from '@/theme/usePalette';

// Où passe ton temps à vélo sur les 4 dernières semaines, zone de puissance par zone de puissance (zones recalculées depuis ta FTP).
// Une sortie est classée tout entière dans la zone de sa puissance normalisée : une estimation, le grand format le dit.
export function WidgetZonesPuissance({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  const ftp = ftpReference(contexte.profil?.ftp, contexte.toutesSeances);
  return (
    <RepartitionZones
      taille={taille}
      titre="Zones de puissance"
      couleur={p.sportVelo}
      rep={repartitionPuissance(contexte.toutesSeances, ftp)}
      videTuile={ftp ? 'Pas de sortie avec puissance' : 'Renseigne ta FTP'}
      videL={ftp ? 'Pas de sortie avec puissance sur les 4 dernières semaines.' : 'Renseigne ta FTP dans Paramètres › Physiologie pour voir où passe ton temps à vélo.'}
      uniteTotal="de vélo, 4 semaines"
      pied="Chaque sortie est classée dans la zone de sa puissance normalisée (à défaut, sa puissance moyenne) : une estimation."
    />
  );
}
