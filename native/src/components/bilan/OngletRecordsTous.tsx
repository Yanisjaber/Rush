import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bloc } from '@/components/feuilles/Bloc';
import { activitesAnnee, type ActiviteBilan } from '@/data/bilan/bilan';
import { recordSemainesAffilee, recordsPeriodes, recordsRegularite, recordsSeance, type EntreeRecord, type RecordTop } from '@/data/bilan/records';
import { dateCourte, enAnnee, jourMoisCourt, libelleEntree, texteValeurRecord } from '@/data/bilan/records-texte';
import { IconeSport } from '@/components/ui/IconeSport';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// L'onglet Records de « Tous les sports » : seulement des records qui valent pour tous les sports à la fois (maquette 1 du 14 nov.).
// Rien de ce qu'on trouve déjà dans l'onglet Records d'un sport (puissance par durée, meilleurs temps, 1RM…).
//  - Sur une séance : la plus longue, la plus chargée, le plus de dénivelé en un jour ;
//  - Sur une période : le meilleur jour, la meilleure semaine, le meilleur mois (en temps) ;
//  - En série : jours actifs d'affilée, semaines d'affilée avec 3 séances ou plus.
interface Props {
  /** La période choisie dans le menu de l'année : l'année (« annee ») ou tout l'historique (« tout »). */
  portee: 'annee' | 'tout';
  toutes: ActiviteBilan[];
  annee: number;
  maintenant: Date;
  onOuvrir: (id: string) => void;
}

/** Une ligne de la fiche : le nom du record, une précision, la valeur. Touchable quand une séance précise est derrière. */
interface Ligne {
  cle: string;
  titre: string;
  sous: string;
  /** Le nom de la séance : seul à être coupé par « … » quand il est long ; la date, elle, reste toujours visible. */
  nom?: string;
  date?: string;
  valeur: string;
  /** Le sport brut de la séance, pour son logo. */
  sport?: string;
  /** La séance à ouvrir. */
  id?: string | null;
}

const ecrire = (valeur: number, unite: string): string => {
  const t = texteValeurRecord(valeur, unite);
  return t.unite ? `${t.nombre} ${t.unite}` : t.nombre;
};

/** Le record (la première entrée du classement) d'un RecordTop, ou null s'il n'y en a pas. */
const record = (r: RecordTop | undefined): EntreeRecord | null => r?.top[0] ?? null;

export function OngletRecordsTous({ portee, toutes, annee, maintenant, onOuvrir }: Props) {
  const p = usePalette();
  const acts = useMemo(() => (portee === 'annee' ? activitesAnnee(toutes, annee, maintenant) : toutes), [portee, toutes, annee, maintenant]);

  const { seance, periode, serie } = useMemo(() => {
    const s = recordsSeance(acts).records;
    const per = recordsPeriodes(acts, 'heures', 1).records;
    const reg = recordsRegularite(acts).records;
    const semaines = recordSemainesAffilee(acts);

    const seanceLignes: Ligne[] = [];
    const ajouterSeance = (cle: string, titre: string, unite: string) => {
      const r = s.find((x) => x.cle === cle);
      const e = record(r);
      if (!e) return;
      seanceLignes.push({
        cle,
        titre,
        sous: [e.nom ? e.nom : '', dateCourte(e.iso)].filter(Boolean).join(' · '),
        nom: e.nom || undefined,
        date: dateCourte(e.iso),
        valeur: ecrire(e.valeur, unite),
        sport: e.sport ?? e.famille,
        id: e.id,
      });
    };
    ajouterSeance('duree', 'La plus longue séance', 'min');
    ajouterSeance('tss', 'La plus chargée', 'TSS');
    ajouterSeance('dplus_seance', 'Le plus gros dénivelé', 'm');

    const periodeLignes: Ligne[] = [];
    const noms: Record<string, string> = { jour: 'Meilleur jour', semaine: 'Meilleure semaine', mois: 'Meilleur mois' };
    for (const r of per) {
      const e = record(r);
      if (!e) continue;
      const l = libelleEntree(r, e);
      // L'année est toujours écrite (« Mercredi 4 mars 2026 »), le nom du mois la porte déjà
      const an = e.iso.slice(0, 4);
      const quand = l.titre.includes(an) ? l.titre : `${l.titre} ${an}`;
      periodeLignes.push({ cle: r.cle, titre: noms[r.cle] ?? r.libelle, sous: [quand, e.detail].filter(Boolean).join(' · '), valeur: ecrire(e.valeur, 'h') });
    }

    const serieLignes: Ligne[] = [];
    const j = record(reg.find((x) => x.cle === 'serie'));
    if (j) serieLignes.push({ cle: 'serie', titre: "Jours actifs d'affilée", sous: `Du ${jourMoisCourt(j.iso)} au ${jourMoisCourt(j.fin ?? j.iso)} ${(j.fin ?? j.iso).slice(0, 4)}`, valeur: ecrire(j.valeur, 'jours') });
    const w = record(semaines);
    if (w) serieLignes.push({ cle: 'serie_semaines', titre: 'Semaines à 3 séances ou +', sous: `Du ${jourMoisCourt(w.iso)} au ${jourMoisCourt(w.fin ?? w.iso)} ${(w.fin ?? w.iso).slice(0, 4)}`, valeur: ecrire(w.valeur, 'semaines') });

    return { seance: seanceLignes, periode: periodeLignes, serie: serieLignes };
  }, [acts]);

  const vide = `Pas encore de record${portee === 'annee' ? ` ${enAnnee(annee, maintenant)}` : ''}.`;

  const bloc = (titre: string, lignes: Ligne[]) => (
    <Bloc titre={titre}>
      {lignes.length ? (
        lignes.map((l, i) => {
          const etiquette = `${l.titre}, ${l.valeur}. ${l.sous}`;
          const contenu = (
            <>
              <View style={styles.centre}>
                {/* Le logo du sport vient juste après le titre */}
                <View style={styles.titre}>
                  <Text numberOfLines={1} style={[typo.corpsFort, { color: p.texte, flexShrink: 1 }]}>
                    {l.titre}
                  </Text>
                  {l.sport ? <IconeSport sport={l.sport} taille={16} /> : null}
                </View>
                {l.nom && l.date ? (
                  <View style={styles.sousLigne}>
                    <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet, flexShrink: 1 }]}>
                      {l.nom}
                    </Text>
                    <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet, flexShrink: 0 }]}>
                      · {l.date}
                    </Text>
                  </View>
                ) : (
                  <Text numberOfLines={1} style={[typo.petit, { color: p.texteMuet }]}>
                    {l.sous}
                  </Text>
                )}
              </View>
              <Text style={[styles.valeur, { color: p.texte }]}>{l.valeur}</Text>
            </>
          );
          const style = [styles.ligne, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.trait } : undefined];
          return l.id ? (
            <Pressable key={l.cle} onPress={() => onOuvrir(l.id as string)} accessibilityRole="button" accessibilityLabel={`${etiquette}. Ouvrir la séance`} style={style}>
              {contenu}
            </Pressable>
          ) : (
            <View key={l.cle} accessible accessibilityLabel={etiquette} style={style}>
              {contenu}
            </View>
          );
        })
      ) : (
        <Text style={[typo.corps, { color: p.texteDoux }]}>{vide}</Text>
      )}
    </Bloc>
  );

  return (
    <>
      {bloc('Sur une séance', seance)}
      {bloc('Sur une période', periode)}
      {bloc('En série', serie)}
    </>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 8 },
  centre: { flex: 1 },
  titre: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sousLigne: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valeur: { fontFamily: police.titre700, fontSize: 17, fontVariant: ['tabular-nums'] },
});
