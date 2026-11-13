import { StyleSheet, Text, View } from 'react-native';
import { LIBELLE_PROVENANCE, texteValeur, type NoteDomaine, type ValeurRepere } from '@/data/profil/evaluation';
import { espace, rayon, type Palette } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';

// Le détail d'un domaine de la planche : chaque repère avec sa valeur, d'où elle vient, sa note sur 100 (une barre)
// et la référence mondiale. Les tests se saisissent dans l'onglet Santé.

interface Props {
  palette: Palette;
  accent: string;
  numero: number;
  note: NoteDomaine;
  sexe: 'homme' | 'femme';
}

const virgule = (n: number) => String(n).replace('.', ',');
const dateCourte = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

export function DetailDomaine({ palette: p, accent, numero, note, sexe }: Props) {
  return (
    <View style={[styles.bloc, { backgroundColor: p.surface, borderColor: p.trait }]}>
      <View style={styles.tete}>
        <View style={{ flex: 1 }}>
          <Text style={[typo.micro, { color: p.texteDoux }]}>Domaine {numero}</Text>
          <Text style={[typo.titre3, { color: p.texte }]}>{note.domaine.nom}</Text>
        </View>
        <Text style={[styles.grandeNote, { color: note.note === null ? p.texteMuet : p.texte }]}>{note.note === null ? '—' : note.note}</Text>
      </View>
      <Text style={[typo.petit, { color: p.texteDoux }]}>
        {note.mesures}/{note.reperes.filter((r) => !r.def.aVenir).length} mesurés · 100 = record {sexe === 'femme' ? 'femmes' : 'hommes'}
      </Text>
      {note.reperes.map((v) => (
        <LigneRepere key={v.def.cle} palette={p} accent={accent} v={v} sexe={sexe} />
      ))}
    </View>
  );
}

function LigneRepere({ palette: p, accent, v, sexe }: { palette: Palette; accent: string; v: ValeurRepere; sexe: 'homme' | 'femme' }) {
  const ref = sexe === 'femme' ? v.def.ref.femme : v.def.ref.homme;
  const unite = v.def.unite ? ` ${v.def.unite}` : '';
  const libelle = v.def.aVenir
    ? `${v.def.nom} : bientôt`
    : v.valeur === null
      ? `${v.def.nom} : pas encore de valeur`
      : `${v.def.nom} : ${texteValeur(v)}${unite}, ${v.note} sur 100, ${LIBELLE_PROVENANCE[v.provenance!]}`;
  return (
    <View style={[styles.ligne, { borderTopColor: p.trait }]}>
      <View accessible accessibilityLabel={libelle} style={styles.haut}>
        <Text style={[typo.corpsFort, { color: v.def.aVenir ? p.texteMuet : p.texte, flex: 1 }]}>{v.def.nom}</Text>
        <Text style={[styles.valeur, { color: v.valeur === null ? p.texteMuet : p.texte }]}>
          {v.def.aVenir ? 'Bientôt' : `${texteValeur(v)}${v.valeur === null ? '' : unite}`}
        </Text>
      </View>
      {!v.def.aVenir ? (
        <>
          <View style={styles.barreLigne}>
            <View style={[styles.piste, { backgroundColor: p.surface2 }]}>
              {v.note !== null ? <View style={{ width: `${Math.max(2, v.note)}%`, height: '100%', backgroundColor: accent, borderRadius: rayon.s }} /> : null}
            </View>
            <Text style={[styles.noteLigne, { color: v.note === null ? p.texteMuet : p.texte }]}>{v.note === null ? '—' : v.note}</Text>
          </View>
          <Text style={[typo.petit, { color: p.texteMuet }]}>
            {v.provenance ? `${LIBELLE_PROVENANCE[v.provenance]}${v.date ? ` · ${dateCourte(v.date)}` : ''} · ` : ''}100 = {virgule(ref)}
            {unite}
            {v.def.ref.statut === 'a_confirmer' ? ' (à confirmer)' : ''}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { borderWidth: 1, borderRadius: rayon.l, padding: espace.e4, gap: espace.e2 },
  tete: { flexDirection: 'row', alignItems: 'flex-end', gap: espace.e3 },
  grandeNote: { fontFamily: police.titre800, fontSize: 40, lineHeight: 44, fontVariant: ['tabular-nums'] },
  ligne: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: espace.e3, marginTop: espace.e2, gap: espace.e1 },
  haut: { flexDirection: 'row', alignItems: 'baseline', gap: espace.e3 },
  valeur: { fontFamily: police.titre700, fontSize: 18, lineHeight: 22, fontVariant: ['tabular-nums'] },
  barreLigne: { flexDirection: 'row', alignItems: 'center', gap: espace.e3 },
  piste: { flex: 1, height: 8, borderRadius: rayon.s, overflow: 'hidden' },
  noteLigne: { width: 32, textAlign: 'right', fontFamily: police.texte600, fontSize: 14, fontVariant: ['tabular-nums'] },
});
