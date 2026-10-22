import { useMemo } from 'react';
import { Text } from 'react-native';
import { CadreWidget } from '@/components/CadreWidget';
import { ListeCompacte } from '@/components/ListeCompacte';
import { Tuile } from '@/components/Tuile';
import { LigneSeance, Points } from '@/components/LigneSeance';
import { familleAffichage } from '@/data/familles';
import { recordsParSeance } from '@/data/force';
import { formatDateCourte, formatDistanceSport, formatDuree } from '@/data/format';
import { chargeSeance } from '@/data/synthese';
import type { Seance, WidgetProps } from '@/data/types';
import { couleurSport, SPORTS, type CleSport } from '@/theme/sports';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Les séances les plus récentes, quelle que soit leur date : la liste ne se vide pas pendant une pause.
// Sur téléphone : 3 lignes. Une pastille « Record » signale les records de force battus pendant la séance.
function detail(s: Seance): string {
  const morceaux = [formatDateCourte(s.start_date_local), formatDuree(s.moving_time)];
  const distance = formatDistanceSport(s.distance_km, familleAffichage(s.sport)); // en natation, en mètres
  if (distance) morceaux.push(distance);
  return morceaux.join(' · ');
}

export function WidgetDernieres({ contexte, taille = 'm' }: WidgetProps) {
  const p = usePalette();
  // Les records battus dans chaque séance (sur tout l'historique de force)
  const records = useMemo(() => recordsParSeance(contexte.force.series), [contexte.force.series]);
  const recentes = contexte.dernieres.slice(0, 4);

  // XS : la durée de la dernière ; S : + son nom et sa date ; M : + les trois dernières en liste (nom et charge) ; L : les quatre dernières avec détail et records
  if (taille !== 'l') {
    const derniere = contexte.dernieres[0];
    const famille = derniere ? familleAffichage(derniere.sport) : '';
    const nomDe = (x: Seance) => x.name || SPORTS[familleAffichage(x.sport) as CleSport]?.court || SPORTS.autre.court;
    return (
      <Tuile
        titre="Dernière séance"
        valeur={derniere ? formatDuree(derniere.moving_time) : '—'}
        note={derniere ? `${derniere.name || SPORTS[famille as CleSport]?.court || SPORTS.autre.court} · ${formatDateCourte(derniere.start_date_local)}` : 'Aucune séance'}
        large
      >
        {taille === 'm' && contexte.dernieres.length > 1 ? (
          <ListeCompacte lignes={contexte.dernieres.slice(0, 4).map((x) => ({ cle: x.id, nom: nomDe(x), valeur: `${chargeSeance(x)} pts`, point: couleurSport(p, familleAffichage(x.sport)) }))} />
        ) : null}
      </Tuile>
    );
  }

  return (
    <CadreWidget titre="Dernières séances">
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
    </CadreWidget>
  );
}
