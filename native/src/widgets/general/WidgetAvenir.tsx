import { Text } from 'react-native';
import { courtDuType } from '@/data/sports/catalogue-sports';
import { CadreWidget } from '@/components/widgets/CadreWidget';
import { ListeCompacte } from '@/components/ui/ListeCompacte';
import { Tuile } from '@/components/ui/Tuile';
import { LigneSeance } from '@/components/calendrier/LigneSeance';
import { formatDateCourte, formatDuree } from '@/data/outils/format';
import { prochainesPrevues } from '@/data/bilan/synthese';
import type { Prevue, WidgetProps } from '@/data/types';
import { couleurSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les prochaines séances que tu as prévues (les compétitions sont dans le dossard d'objectif).
function detail(p: Prevue): string {
  const morceaux = [formatDateCourte(p.date)];
  if (p.duration) morceaux.push(formatDuree(p.duration * 60));
  if (p.km) morceaux.push(`${String(Math.round(p.km * 10) / 10).replace('.', ',')} km`);
  return morceaux.join(' · ');
}

export function WidgetAvenir({ contexte, taille = 'm' }: WidgetProps) {
  const palette = usePalette();
  const prochaines = prochainesPrevues(contexte.planifiees, new Date(), 4);

  // XS : la date de la prochaine ; S : + son nom ; M : + les trois suivantes en liste ; L : les quatre prochaines avec leur détail
  if (taille !== 'l') {
    const prochaine = prochaines[0];
    const nomDe = (x: Prevue) => x.name || courtDuType(x.sport);
    return (
      <Tuile
        titre="À venir"
        valeur={prochaine ? formatDateCourte(prochaine.date) : '—'}
        note={prochaine ? `${prochaine.name || courtDuType(prochaine.sport)}${prochaine.duration ? ` · ${formatDuree(prochaine.duration * 60)}` : ''}` : 'Rien de prévu'}
        large
      >
        {taille === 'm' && prochaines.length > 1 ? (
          <ListeCompacte lignes={prochaines.slice(0, 4).map((x) => ({ cle: x.id, nom: nomDe(x), valeur: formatDateCourte(x.date), point: couleurSport(palette, x.sport) }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="À venir">
      {prochaines.length ? (
        prochaines.map((p, i) => {
          return (
            <LigneSeance
              key={p.id}
              premiere={i === 0}
              sport={p.sport}
              nom={p.name || courtDuType(p.sport)}
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
