import { StyleSheet, Text, View } from 'react-native';
import { courtDuType } from '@/data/sports/catalogue-sports';
import { CadreWidget, TitreWidget } from '@/components/widgets/CadreWidget';
import { IconeRepos, IconeSport } from '@/components/ui/IconeSport';
import { elementsDuJour, infosDuJour, lignesDeLaBande, seancesDuJour, type ElementDuJour } from '@/data/accueil/aujourdhui';
import { formatHeuresMinutes } from '@/data/outils/format';
import { resumeProgramme } from '@/data/sports/force';
import type { WidgetProps } from '@/data/types';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La séance du jour, quel que soit le sport : ce qui est PRÉVU aujourd'hui et pas encore fait, empilé, chaque séance avec le logo de son sport.
// Une seule séance : son nom à gauche, ses infos à droite (« EF z2 ··· 2h30 · 70 km », « Legs ··· 1h00 · 5 exos »).
// Plusieurs : « 2 séances » à gauche, et à droite une ligne par sport avec sa durée seulement (« Vélo · 2h30 », « Muscu · 1h00 ») ; toutes les durées en 0h00, elles s'alignent :
// les km et les exercices ne s'affichent que pour une séance seule (et, en L, pour chaque séance). Plus de 2 dans la bande fine : la plus longue, puis « + 2 séances · 1h25 » (le nombre des autres et la somme de leurs durées).
// Une séance faite disparaît d'ici (on la retrouve dans « Dernière séance » et « Cette semaine »).
// Tout ce qui était prévu est fait : « Terminé ». Rien de prévu : « Repos » et une petite lune à droite.
const court = courtDuType;

export function WidgetAujourdhui({ contexte, taille }: WidgetProps) {
  const p = usePalette();
  const elements = elementsDuJour(seancesDuJour(contexte.planifiees, contexte.toutesSeances));
  const aFaire = elements.filter((e) => !e.fait);
  const toutFait = !aFaire.length && elements.some((e) => e.prevue);
  // Le nombre d'exercices du programme relié (muscu)
  const exos = (e: ElementDuJour): number | null => {
    const prog = e.programmeId ? contexte.force.programmes.find((x) => x.id === e.programmeId) : null;
    return prog ? resumeProgramme(prog).exercices : null;
  };
  const plusieurs = aFaire.length > 1;
  // Plusieurs séances : la durée seule ; une séance seule : durée, distance et exercices
  const infos = (e: ElementDuJour) => (plusieurs ? infosDuJour({ prevueMinutes: e.prevueMinutes, km: null }) : infosDuJour(e, exos(e)));
  const titre = plusieurs ? `${aFaire.length} séances` : aFaire[0] ? aFaire[0].nom || court(aFaire[0].sport) : toutFait ? 'Terminé' : 'Repos';
  const vide = !aFaire.length ? (toutFait ? 'Tout ce qui était prévu est fait' : "Rien de prévu aujourd'hui") : '';
  const lecture = aFaire.length ? `Séance du jour : ${aFaire.map((e) => `${e.nom || court(e.sport)} ${infos(e)}`).join(', ')}` : `Séance du jour : ${titre}. ${vide}`;

  // Les lignes de droite : une séance = ses infos seules ; plusieurs = le sport puis les infos
  const bande = lignesDeLaBande(aFaire);
  const lignes = bande.lignes.map((e) => ({ cle: e.cle, sport: e.sport, texte: plusieurs ? [court(e.sport), infos(e)].filter(Boolean).join(' · ') : infos(e) || court(e.sport) }));

  if (taille === 'xs') {
    return (
      <CadreWidget>
        <View accessible accessibilityLabel={lecture} style={styles.fine}>
          <View style={styles.gauche}>
            <TitreWidget titre="Séance du jour" serre petit />
            <Text numberOfLines={1} style={[styles.valeurFine, { color: p.texte }]}>
              {titre}
            </Text>
          </View>
          {lignes.length ? (
            <View style={styles.pile}>
              {lignes.map((l) => (
                <View key={l.cle} style={styles.ligneFine}>
                  <IconeSport sport={l.sport} taille={16} />
                  <Text numberOfLines={1} style={[styles.texteFin, { color: p.texteDoux }]}>
                    {l.texte}
                  </Text>
                </View>
              ))}
              {bande.autres > 0 ? (
                <View style={[styles.pastille, { backgroundColor: p.surface2 }]}>
                  <Text style={[styles.texteFin, { color: p.texteDoux }]}>
                    + {bande.autres} séance{bande.autres > 1 ? 's' : ''}
                    {bande.autresMinutes > 0 ? ` · ${formatHeuresMinutes(bande.autresMinutes * 60)}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : toutFait ? (
            <Text numberOfLines={2} style={[typo.petit, styles.noteVide, { color: p.texteDoux }]}>
              {vide}
            </Text>
          ) : (
            // Rien de prévu : un petit dessin de repos à droite
            <View style={styles.repos}>
              <IconeRepos taille={34} />
            </View>
          )}
        </View>
      </CadreWidget>
    );
  }

  // S, M, L : une ligne par séance, le logo, le nom et les infos à droite.
  // S et M n'ont la place que pour 2 lignes : au-delà, la plus longue puis « + 2 séances · 1h25 » (comme la bande fine). En S, le nom court du sport (« Vélo »).
  const visibles = taille === 'l' ? aFaire : bande.lignes;
  const autres = taille === 'l' ? 0 : bande.autres;
  return (
    <CadreWidget titre="Séance du jour">
      {aFaire.length ? (
        <>
          {visibles.map((e, i) => {
            const nom = taille === 's' && plusieurs ? court(e.sport) : e.nom || court(e.sport);
            return (
              <View key={e.cle} accessible accessibilityLabel={`${e.nom || court(e.sport)} ${infos(e)}`} style={[styles.ligne, i > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <IconeSport sport={e.sport} taille={22} />
                <Text numberOfLines={1} style={[typo.corpsFort, styles.nom, { color: p.texte }]}>
                  {nom}
                </Text>
                <Text numberOfLines={1} style={[typo.petit, { color: p.texteDoux }]}>
                  {taille === 'l' ? infosDuJour(e, exos(e)) : infos(e)}
                </Text>
              </View>
            );
          })}
          {autres > 0 ? (
            <View style={[styles.pastille, styles.pastilleBas, { backgroundColor: p.surface2 }]}>
              <Text style={[styles.texteFin, { color: p.texteDoux }]}>
                + {autres} séance{autres > 1 ? 's' : ''}
                {bande.autresMinutes > 0 ? ` · ${formatHeuresMinutes(bande.autresMinutes * 60)}` : ''}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>{toutFait ? "Tout ce qui était prévu aujourd'hui est fait. Bien joué !" : "Rien de prévu aujourd'hui. Planifie une séance depuis le calendrier, ou profite de ton repos."}</Text>
      )}
    </CadreWidget>
  );
}

const styles = StyleSheet.create({
  fine: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gauche: { flex: 1, minWidth: 0 },
  valeurFine: { fontFamily: police.titre700, fontSize: 22, lineHeight: 26 },
  pile: { flexShrink: 1, maxWidth: '55%', gap: 1 },
  // 9 pt à droite = le remplissage de la pastille « + 2 séances » : les temps de toutes les lignes tombent les uns sous les autres
  ligneFine: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginRight: 9 },
  texteFin: { flexShrink: 1, fontFamily: police.texte600, fontSize: 13, lineHeight: 15, fontVariant: ['tabular-nums'] },
  pastille: { alignSelf: 'flex-end', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 1, marginTop: 2 },
  pastilleBas: { alignSelf: 'flex-start', marginTop: 6 },
  repos: { paddingRight: 4 },
  noteVide: { flexShrink: 1, maxWidth: '42%', textAlign: 'right' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  nom: { flex: 1, minWidth: 0 },
});
