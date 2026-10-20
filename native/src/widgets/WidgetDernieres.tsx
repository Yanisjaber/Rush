import { useMemo } from 'react';
import { Text } from 'react-native';
import { Bloc } from '@/components/Bloc';
import { Tuile } from '@/components/Tuile';
import { LigneSeance, Points } from '@/components/LigneSeance';
import { familleAffichage } from '@/data/familles';
import { recordsParSeance } from '@/data/force';
import { formatDateCourte, formatDuree, formatKm } from '@/data/format';
import { chargeSeance } from '@/data/synthese';
import type { Seance, WidgetProps } from '@/data/types';
import { SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les séances les plus récentes, quelle que soit leur date : la liste ne se vide pas pendant une pause.
// Sur téléphone : 3 lignes. Une pastille « Record » signale les records de force battus pendant la séance.
function detail(s: Seance): string {
  const morceaux = [formatDateCourte(s.start_date_local), formatDuree(s.moving_time)];
  if (s.distance_km) morceaux.push(`${formatKm(s.distance_km)} km`);
  return morceaux.join(' · ');
}

// tuile : la dernière séance (sa durée en gros, son nom et sa date en note).
export function WidgetDernieres({ contexte, tuile = false }: WidgetProps) {
  const p = usePalette();
  // Les records battus dans chaque séance (sur tout l'historique de force)
  const records = useMemo(() => recordsParSeance(contexte.force.series), [contexte.force.series]);
  const recentes = contexte.dernieres.slice(0, 4);

  if (tuile) {
    const derniere = contexte.dernieres[0];
    const famille = derniere ? familleAffichage(derniere.sport) : '';
    return (
      <Tuile
        titre="Dernière séance"
        valeur={derniere ? formatDuree(derniere.moving_time) : '—'}
        note={derniere ? `${derniere.name || SPORTS[famille as CleSport]?.court || SPORTS.autre.court} · ${formatDateCourte(derniere.start_date_local)}` : 'Aucune séance'}
      />
    );
  }

  return (
    <Bloc titre="Dernières séances">
      {recentes.length ? (
        recentes.map((s, i) => {
          const famille = familleAffichage(s.sport);
          const nbRecords = records.get(s.id)?.length ?? 0;
          return (
            <LigneSeance
              key={s.id}
              premiere={i === 0}
              sport={famille}
              nom={s.name || SPORTS[famille as CleSport]?.court || SPORTS.autre.court}
              badge={nbRecords > 1 ? `${nbRecords} records` : nbRecords === 1 ? 'Record' : undefined}
              detail={detail(s)}
              droite={<Points valeur={chargeSeance(s)} />}
            />
          );
        })
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>Aucune séance à afficher.</Text>
      )}
    </Bloc>
  );
}
