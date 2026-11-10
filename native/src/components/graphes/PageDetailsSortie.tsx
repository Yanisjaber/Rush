import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChiffreSeance } from '@/data/calendrier/seance-detail';
import { espace, rayon } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page 3 d'une sortie : un ruban de quatre données principales (distance, durée, allure ou vitesse, dénivelé), puis UN tableau avec toutes les autres données rangées par rubriques
// (Temps, Effort, Cœur, Rythme, Relief, Énergie : une ligne nom / valeur chacune), puis les records de la sortie (`records`), puis le reste (tours, notes, « compte dans mes calculs ») en `children`.
// Une rubrique sans aucune ligne n'est pas affichée. Pas de chiffre inventé : tout vient de la sortie.
interface Props {
  chiffres: ChiffreSeance[];
  /** La donnée est écartée des calculs (chiffre barré). */
  ecarte: (cle: string) => boolean;
  altitude: { min: number; max: number } | null;
  couleur: string;
  /** Les records de la sortie (courbe des meilleurs efforts), entre le tableau et le reste. */
  records?: ReactNode;
  children?: ReactNode;
}

interface Ligne {
  cle: string;
  libelle: string;
  valeur: string;
  unite?: string;
  ecarte?: boolean;
}

export function PageDetailsSortie({ chiffres, ecarte, altitude, couleur, records, children }: Props) {
  const p = usePalette();
  const parCle = (cle: string) => chiffres.find((c) => c.cle === cle);
  const ligne = (cle: string, libelle?: string): Ligne[] => {
    const c = parCle(cle);
    return c ? [{ cle, libelle: libelle ?? c.libelle, valeur: c.valeur, unite: c.unite, ecarte: ecarte(cle) }] : [];
  };
  // Les quatre données principales : distance, durée, allure (ou vitesse), dénivelé. Le tableau ne les répète pas.
  const cleRythme = parCle('allure') ? 'allure' : 'vitesse';
  const clesPrincipales = ['distance', 'duree', cleRythme, 'denivele'];
  const principaux = clesPrincipales.map(parCle).filter((c): c is ChiffreSeance => !!c);
  const ligneSi = (cle: string, libelle?: string): Ligne[] => (clesPrincipales.includes(cle) ? [] : ligne(cle, libelle));
  // Une note « max 188 » (cœur) ou « normalisée 241 » (puissance) devient une ligne à part
  const chiffreNote = (cle: string, libelle: string, unite: string): Ligne[] => {
    const v = /(\d+)/.exec(parCle(cle)?.note ?? '')?.[1];
    return v ? [{ cle: `${cle}-note`, libelle, valeur: v, unite }] : [];
  };
  // « 37 min au total » (sur la durée) devient la ligne « Temps écoulé »
  const tempsTotal = /^(.+?) au total$/.exec(parCle('duree')?.note ?? '')?.[1];

  // Quatre rubriques seulement (le temps écoulé va avec l'effort ; le rythme et le relief vont ensemble) : moins de titres, donc moins de hauteur
  const rubriques: { titre: string; lignes: Ligne[] }[] = [
    { titre: 'EFFORT', lignes: [...(tempsTotal ? [{ cle: 'ecoule', libelle: 'Temps écoulé', valeur: tempsTotal }] : []), ...ligne('charge'), ...ligne('if', 'Intensité (IF)'), ...ligne('rpe', 'Effort ressenti')] },
    { titre: 'CŒUR', lignes: [...ligne('fc', 'FC moyenne'), ...chiffreNote('fc', 'FC max', 'bpm'), ...ligne('derive', 'Dérive'), ...ligne('ef', 'Efficacité P/FC'), ...ligne('trimp', 'TRIMP')] },
    {
      titre: 'RYTHME ET RELIEF',
      lignes: [
        ...ligneSi('allure'),
        ...ligneSi('vitesse'),
        ...ligne('cadence'),
        ...(altitude ? [{ cle: 'haut', libelle: 'Plus haut', valeur: String(Math.round(altitude.max)), unite: 'm' }, { cle: 'bas', libelle: 'Plus bas', valeur: String(Math.round(altitude.min)), unite: 'm' }] : []),
      ],
    },
    { titre: 'ÉNERGIE', lignes: [...ligne('watts', 'Puiss. moyenne'), ...chiffreNote('watts', 'Puiss. normalisée', 'W'), ...ligne('pmax', 'Puiss. max'), ...ligne('energie'), ...ligne('kjftp', 'Travail > FTP')] },
  ].filter((r) => r.lignes.length > 0);
  const rpe = parCle('rpe');
  // Deux colonnes de rubriques, à peu près de la même hauteur : on remplit la première jusqu'à la moitié des lignes
  const totalLignes = rubriques.reduce((n, r) => n + r.lignes.length, 0);
  const colonnes: (typeof rubriques)[] = [[], []];
  let vues = 0;
  for (const r of rubriques) {
    colonnes[vues + r.lignes.length / 2 <= totalLignes / 2 + 1 ? 0 : 1].push(r);
    vues += r.lignes.length;
  }

  return (
    <>
      {principaux.length ? (
        <View style={[styles.ruban, { backgroundColor: p.surface }]}>
          {principaux.map((c, i) => (
            <View
              key={c.cle}
              accessible
              accessibilityLabel={`${c.libelle} ${c.valeur} ${c.unite ?? ''}`}
              style={[styles.cellule, i > 0 && { borderLeftColor: p.trait, borderLeftWidth: StyleSheet.hairlineWidth }]}
            >
              <Text numberOfLines={1} style={[typo.micro, styles.etiquette, { color: p.texteDoux }]}>
                {c.cle === 'denivele' ? 'D+' : c.libelle}
              </Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.valeur, { color: ecarte(c.cle) ? p.texteMuet : p.texte }, ecarte(c.cle) && styles.barre]}>
                {c.valeur}
                {c.unite ? <Text style={[styles.unite, { color: p.texteDoux }]}> {c.unite}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {rubriques.length ? (
        <View style={[styles.tableau, { backgroundColor: p.surface }]}>
          {colonnes.map((col, c) => (
            <View key={c} style={[styles.colonne, c > 0 && { borderLeftColor: p.trait, borderLeftWidth: StyleSheet.hairlineWidth }]}>
              {col.map((r, k) => (
                <View key={r.titre} style={k > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }}>
                  <Text numberOfLines={1} style={[typo.micro, styles.titre, { color: p.texteDoux }]}>{r.titre}</Text>
                  {r.lignes.map((l) => (
                    <View key={l.cle} accessible accessibilityLabel={[l.libelle, l.valeur, l.unite, l.ecarte ? 'écartée de tes calculs' : ''].filter(Boolean).join(' ')} style={styles.ligne}>
                      <Text numberOfLines={1} style={[styles.libelle, { color: p.texteDoux }]}>{l.libelle}</Text>
                      <Text numberOfLines={1} style={[styles.valeurLigne, { color: l.ecarte ? p.texteMuet : p.texte }, l.ecarte && styles.barre]}>
                        {l.valeur}
                        {l.unite ? <Text style={[styles.uniteLigne, { color: p.texteDoux }]}> {l.unite}</Text> : null}
                      </Text>
                    </View>
                  ))}
                  {/* Jauge de l'effort ressenti : dix segments, remplis jusqu'à la note */}
                  {r.titre === 'EFFORT' && rpe ? <JaugeRpe note={Number(rpe.valeur)} couleur={couleur} /> : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
      {records}
      {children}
    </>
  );
}

function JaugeRpe({ note, couleur }: { note: number; couleur: string }) {
  const p = usePalette();
  return (
    <View accessible accessibilityLabel={`Effort ressenti ${note} sur 10`} style={styles.jauge}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < note ? couleur : p.traitFort }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ruban: { flexDirection: 'row', borderRadius: rayon.base, paddingVertical: 10 },
  cellule: { width: '25%', paddingHorizontal: 10, justifyContent: 'center', overflow: 'hidden' },
  etiquette: { fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
  valeur: { fontFamily: police.titre800, fontSize: 20, lineHeight: 24, marginTop: 2, fontVariant: ['tabular-nums'] },
  unite: { fontFamily: police.texte600, fontSize: 11 },
  tableau: { flexDirection: 'row', borderRadius: rayon.base, overflow: 'hidden' },
  colonne: { flex: 1, minWidth: 0 },
  titre: { letterSpacing: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 0 },
  ligne: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 10, paddingVertical: 3 },
  libelle: { fontFamily: police.texte400, fontSize: 13, flexShrink: 1 },
  valeurLigne: { fontFamily: police.titre700, fontSize: 15, fontVariant: ['tabular-nums'], flexShrink: 0 },
  uniteLigne: { fontFamily: police.texte400, fontSize: 11 },
  barre: { textDecorationLine: 'line-through' },
  jauge: { flexDirection: 'row', gap: 3, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 2 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
});
