import { Text } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { Tuile } from '@/components/Tuile';
import { LigneSeance } from '@/components/LigneSeance';
import { familleAffichage } from '@/data/familles';
import { formatDateCourte, formatDuree } from '@/data/format';
import { prochainesPrevues } from '@/data/synthese';
import type { Prevue, WidgetProps } from '@/data/types';
import { SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les prochaines séances que tu as prévues (les compétitions sont dans le dossard d'objectif).
function detail(p: Prevue): string {
  const morceaux = [formatDateCourte(p.date)];
  if (p.duration) morceaux.push(formatDuree(p.duration * 60));
  if (p.km) morceaux.push(`${String(Math.round(p.km * 10) / 10).replace('.', ',')} km`);
  return morceaux.join(' · ');
}

// tuile : la prochaine séance prévue (la date en gros, son nom en note).
export function WidgetAvenir({ contexte, tuile = false }: WidgetProps) {
  const palette = usePalette();
  const prochaines = prochainesPrevues(contexte.planifiees, new Date(), 4);

  if (tuile) {
    const prochaine = prochaines[0];
    const famille = prochaine ? familleAffichage(prochaine.sport) : '';
    return (
      <Tuile
        titre="À venir"
        valeur={prochaine ? formatDateCourte(prochaine.date) : '—'}
        note={prochaine ? `${prochaine.name || SPORTS[famille as CleSport]?.court || SPORTS.autre.court}${prochaine.duration ? ` · ${formatDuree(prochaine.duration * 60)}` : ''}` : 'Rien de prévu'}
      />
    );
  }

  return (
    <CadreWidget titre="À venir">
      {prochaines.length ? (
        prochaines.map((p, i) => {
          const famille = familleAffichage(p.sport);
          return (
            <LigneSeance
              key={p.id}
              premiere={i === 0}
              sport={famille}
              nom={p.name || SPORTS[famille as CleSport]?.court || SPORTS.autre.court}
              detail={detail(p)}
            />
          );
        })
      ) : (
        <Text style={[typo.corps, { color: palette.texteDoux }]}>Aucune séance prévue. Planifie la prochaine depuis le calendrier.</Text>
      )}
    </CadreWidget>
  );
}
