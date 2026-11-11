import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChiffreSeance } from '@/data/calendrier/seance-detail';
import { espace, rayon, sombre } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// La page 2 d'une sortie : UN tableau avec toutes les données qui ne sont pas déjà sur la page 1, rangées par rubriques
// (Sortie, Effort, Cœur, Rythme et relief, Énergie : une ligne nom / valeur chacune), puis les records de la sortie (`records`), puis le reste (tours, notes, « compte dans mes calculs ») en `children`.
// Une rubrique sans aucune ligne n'est pas affichée. Pas de chiffre inventé : tout vient de la sortie.
interface Props {
  chiffres: ChiffreSeance[];
  /** Les clés des chiffres déjà montrés sur la page 1 : on ne les répète pas. */
  dejaVus: string[];
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

export function PageDetailsSortie({ chiffres, dejaVus, ecarte, altitude, couleur, records, children }: Props) {
  const p = usePalette();
  const parCle = (cle: string) => chiffres.find((c) => c.cle === cle);
  const ligne = (cle: string, libelle?: string): Ligne[] => {
    const c = parCle(cle);
    return c ? [{ cle, libelle: libelle ?? c.libelle, valeur: c.valeur, unite: c.unite, ecarte: ecarte(cle) }] : [];
  };
  // Les chiffres de la page 1 ne reviennent pas ici
  const ligneSi = (cle: string, libelle?: string): Ligne[] => (dejaVus.includes(cle) ? [] : ligne(cle, libelle));
  // Une note « max 188 » (cœur) ou « normalisée 241 » (puissance) devient une ligne à part
  const chiffreNote = (cle: string, libelle: string, unite: string): Ligne[] => {
    const v = /(\d+)/.exec(parCle(cle)?.note ?? '')?.[1];
    return v ? [{ cle: `${cle}-note`, libelle, valeur: v, unite }] : [];
  };
  // « 37 min au total » (sur la durée) devient la ligne « Temps écoulé »
  const tempsTotal = /^(.+?) au total$/.exec(parCle('duree')?.note ?? '')?.[1];

  // Quatre rubriques seulement (le temps écoulé va avec l'effort ; le rythme et le relief vont ensemble) : moins de titres, donc moins de hauteur
  const rubriques: { titre: string; lignes: Ligne[] }[] = [
    { titre: 'SORTIE', lignes: [...ligneSi('duree'), ...(tempsTotal ? [{ cle: 'ecoule', libelle: 'Temps écoulé', valeur: tempsTotal }] : []), ...ligneSi('distance'), ...ligneSi('denivele', 'Dénivelé +'), ...ligneSi('descendu', 'Dénivelé descendu'), ...ligneSi('descentes'), ...ligneSi('vmax', 'Vitesse max')] },
    { titre: 'EFFORT', lignes: [...ligneSi('charge'), ...ligne('if', 'Intensité (IF)'), ...ligneSi('rpe', 'Effort ressenti'), ...ligne('type')] },
    { titre: 'CŒUR', lignes: [...ligneSi('fc', 'FC moyenne'), ...chiffreNote('fc', 'FC max', 'bpm'), ...ligne('derive', 'Dérive'), ...ligne('ef', 'Efficacité P/FC'), ...ligne('trimp', 'TRIMP')] },
    {
      titre: 'RYTHME ET RELIEF',
      lignes: [
        ...ligneSi('allure'),
        ...ligneSi('vitesse'),
        ...ligneSi('cadence'),
        ...(altitude ? [{ cle: 'haut', libelle: 'Plus haut', valeur: String(Math.round(altitude.max)), unite: 'm' }, { cle: 'bas', libelle: 'Plus bas', valeur: String(Math.round(altitude.min)), unite: 'm' }] : []),
        ...ligneSi('temperature'),
      ],
    },
    { titre: 'ÉNERGIE', lignes: [...ligneSi('watts', 'Puiss. moyenne'), ...chiffreNote('watts', 'Puiss. normalisée', 'W'), ...ligne('pmax', 'Puiss. max'), ...ligneSi('energie', 'Travail'), ...ligne('kjftp', 'Dont > FTP'), ...ligneSi('calories'), ...ligne('cho')] },
  ].filter((r) => r.lignes.length > 0);
  const rpe = parCle('rpe');
  // Les titres de rubrique dans la couleur du sport en thème sombre ; en thème clair elle manque de contraste en petit texte (voir IDENTITE.md), on garde le texte
  const couleurTitre = p.fond === sombre.fond ? couleur : p.texte;
  // Deux colonnes de rubriques, à peu près de la même hauteur : on remplit la première jusqu'à la moitié des lignes
  const totalLignes = rubriques.reduce((n, r) => n + r.lignes.length, 0);
  const colonnes: (typeof rubriques)[] = [[], []];
  let vues = 0;
  for (const r of rubriques) {
    colonnes[vues + r.lignes.length <= totalLignes / 2 + 0.5 ? 0 : 1].push(r);
    vues += r.lignes.length;
  }

  return (
    <>
      {rubriques.length ? (
        <View style={[styles.tableau, { backgroundColor: p.surface }]}>
          {colonnes.map((col, c) => (
            <View key={c} style={[styles.colonne, c > 0 && { borderLeftColor: p.trait, borderLeftWidth: StyleSheet.hairlineWidth }]}>
              {col.map((r, k) => (
                <View key={r.titre} style={k > 0 && { borderTopColor: p.trait, borderTopWidth: StyleSheet.hairlineWidth }}>
                  <Text numberOfLines={1} style={[typo.micro, styles.titre, { color: couleurTitre }]}>{r.titre}</Text>
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
  tableau: { flexDirection: 'row', borderRadius: rayon.base, overflow: 'hidden' },
  colonne: { flex: 1, minWidth: 0 },
  titre: { fontFamily: police.titre700, letterSpacing: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 0 },
  ligne: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 10, paddingVertical: 3 },
  libelle: { fontFamily: police.texte400, fontSize: 13, flexShrink: 1 },
  valeurLigne: { fontFamily: police.titre700, fontSize: 15, fontVariant: ['tabular-nums'], flexShrink: 0 },
  uniteLigne: { fontFamily: police.texte400, fontSize: 11 },
  barre: { textDecorationLine: 'line-through' },
  jauge: { flexDirection: 'row', gap: 3, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 2 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
});
