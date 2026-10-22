import { SerieHebdo } from '@/components/SerieHebdo';
import { formatNombre } from '@/data/format';
import { deniveleParSemaineSport, type SportDenivele } from '@/data/trail';
import type { WidgetProps } from '@/data/types';
import { usePalette } from '@/theme/usePalette';

// Le dénivelé positif grimpé chaque semaine, sur 12 semaines (voir SerieHebdo) : le même widget pour le trail et pour le VTT.
export function DeniveleParSemaine({ contexte, taille = 'm', sport }: WidgetProps & { sport: SportDenivele }) {
  const p = usePalette();
  const d = deniveleParSemaineSport(contexte.toutesSeances, sport);
  const nom = sport === 'vtt' ? 'VTT' : 'trail';
  return (
    <SerieHebdo
      taille={taille}
      couleur={sport === 'vtt' ? p.sportVelo : p.sportCourse}
      titreTuile="D+ / semaine"
      titreL="Dénivelé par semaine"
      valeur={formatNombre(d.derniere)}
      unite="m"
      parSemaine={d.parSemaine}
      formater={(n) => formatNombre(n)}
      badge={d.ecartPct != null ? { texte: `${d.ecartPct > 0 ? '+' : ''}${d.ecartPct} % vs moyenne`, ton: d.ecartPct >= 0 ? 'ok' : 'neutre' } : null}
      periode="12 dernières semaines"
      pied={`Dénivelé positif de tes sorties de ${nom}, additionné sur 7 jours glissants. Pointillés : ta moyenne.`}
      videTuile={`Pas encore de ${nom}`}
      videL={`Pas encore de dénivelé en ${nom}. Dès qu'une sortie de ${nom} en a, ton D+ par semaine apparaît ici.`}
      etiquette={`Dénivelé positif en ${nom} par semaine sur 12 semaines`}
    />
  );
}

export function WidgetDeniveleTrail(props: WidgetProps) {
  return <DeniveleParSemaine {...props} sport="trail" />;
}
