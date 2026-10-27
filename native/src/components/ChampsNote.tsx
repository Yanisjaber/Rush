import { StyleSheet, Text, View } from 'react-native';
import { ChoixCouleur } from '@/components/ChampsFeuille';
import { ChampPeriode } from '@/components/ChampPeriode';
import { ChampTexte } from '@/components/ChampTexte';
import { MenuDeroulantChoix } from '@/components/MenuDeroulantChoix';
import { MenuDeroulantMulti } from '@/components/MenuDeroulantMulti';
import { OngletsSegment } from '@/components/OngletsSegment';
import { SilhouetteZone } from '@/components/SilhouetteZone';
import { PALETTE_NOTE, TEXTE_MAX_NOTE, TYPES_NOTE, type FormulaireNote } from '@/data/ajouts';
import { COTES, DOULEURS, detailsParDefaut, ENTRAINEMENT_INDISPO, ENTRAINEMENT_MALADIE, GRAVITES, MALADIES, MOTIFS, NATURES, SYMPTOMES, TEXTE_MAX_COURT, ZONES, type DetailsNote, type TypeNote } from '@/data/sante-notes';
import { espace } from '@/theme/couleurs';
import { police, typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

/** Le bouton de validation, selon le type : « Ajouter la maladie », « Ajouter l'indisponibilité »… */
export const BOUTON_AJOUT: Record<TypeNote, string> = {
  texte: 'Ajouter la note',
  maladie: 'Ajouter la maladie',
  blessure: 'Ajouter la blessure',
  indisponible: "Ajouter l'indisponibilité",
};

/**
 * Les champs d'une note, selon son type : une note (texte, couleur), une maladie (nom, symptômes, gravité, entraînement), une blessure (zone, côté, nature, douleur)
 * ou une indisponibilité (motif, entraînement possible, lieu). La période (calendrier) et la note facultative sont communes. Partagé par l'écran d'ajout et la feuille de modification.
 */
export function ChampsNote({ f, change, sur = 'fond' }: { f: FormulaireNote; change: (suite: FormulaireNote) => void; sur?: 'fond' | 'surface' }) {
  const p = usePalette();
  const d = f.details;
  const maj = (suite: Partial<DetailsNote>) => change({ ...f, details: { ...d, ...suite } });
  const choisirType = (type: TypeNote) => {
    if (type === f.type) return;
    change({ ...f, type, couleur: TYPES_NOTE.find((t) => t.cle === type)?.couleur ?? f.couleur, details: detailsParDefaut(type) });
  };
  const noteLibre = (
    <ChampTexte
      etiquette={f.type === 'texte' ? 'Ta note' : 'Note (facultatif)'}
      sur={sur}
      value={f.texte}
      onChangeText={(t) => change({ ...f, texte: t })}
      maxLength={TEXTE_MAX_NOTE}
      multiline
      placeholder="Un mot sur ta journée…"
      accessibilityLabel="Texte de la note"
    />
  );
  const periode = <ChampPeriode sur={sur} de={f.de} a={f.a} couleur={f.couleur} onChange={(de, a) => change({ ...f, de, a })} />;
  const precise = (etiquette: string) => (
    <ChampTexte etiquette={etiquette} sur={sur} value={d.autre ?? ''} onChangeText={(t) => maj({ autre: t })} maxLength={TEXTE_MAX_COURT} placeholder="Précise…" />
  );

  return (
    <View style={{ gap: espace.e4 }}>
      <OngletsSegment taille={13} etiquette="Type de note" actuel={f.type} onChoisir={choisirType} onglets={TYPES_NOTE.map((t) => ({ cle: t.cle, nom: t.nom }))} />

      {f.type === 'texte' ? (
        <>
          {noteLibre}
          {periode}
          <View style={{ gap: 6 }}>
            <Text style={[typo.petit, { color: p.texteDoux, paddingLeft: 16, fontFamily: police.texte600 }]}>Couleur</Text>
            <ChoixCouleur couleurs={PALETTE_NOTE.map((hex) => ({ hex, nom: hex }))} actuelle={f.couleur} onChoisir={(hex) => change({ ...f, couleur: hex })} />
          </View>
        </>
      ) : null}

      {f.type === 'maladie' ? (
        <>
          <MenuDeroulantChoix sur={sur} sansVide etiquette="Quelle maladie ?" valeur={d.maladie ?? ''} options={MALADIES} onChoisir={(c) => maj({ maladie: c })} />
          {d.maladie === 'autre' ? precise('Nom de la maladie') : null}
          <MenuDeroulantMulti sur={sur} etiquette="Symptômes" valeurs={d.symptomes ?? []} options={SYMPTOMES} onChange={(c) => maj({ symptomes: c })} vide="Aucun symptôme" />
          <MenuDeroulantChoix sur={sur} sansVide etiquette="Gravité" valeur={d.gravite ?? ''} options={GRAVITES} onChoisir={(c) => maj({ gravite: c })} />
          <MenuDeroulantChoix sur={sur} sansVide etiquette="Entraînement" valeur={d.entrainement ?? ''} options={ENTRAINEMENT_MALADIE} onChoisir={(c) => maj({ entrainement: c })} />
          {periode}
          {noteLibre}
        </>
      ) : null}

      {f.type === 'blessure' ? (
        <>
          <View style={styles.corps}>
            <SilhouetteZone zone={d.zone} />
            <View style={{ flex: 1, gap: espace.e3 }}>
              <MenuDeroulantChoix sur={sur} sansVide etiquette="Zone touchée" valeur={d.zone ?? ''} options={ZONES} onChoisir={(c) => maj({ zone: c })} />
              <MenuDeroulantChoix sur={sur} sansVide etiquette="Côté" valeur={d.cote ?? ''} options={COTES} onChoisir={(c) => maj({ cote: c })} />
            </View>
          </View>
          <MenuDeroulantChoix sur={sur} sansVide etiquette="Type de blessure" valeur={d.nature ?? ''} options={NATURES} onChoisir={(c) => maj({ nature: c })} />
          {d.nature === 'autre' ? precise('Nature de la blessure') : null}
          <MenuDeroulantChoix sur={sur} sansVide etiquette="Douleur" valeur={d.douleur ? String(d.douleur) : ''} options={DOULEURS} onChoisir={(c) => maj({ douleur: Number(c) })} />
          {periode}
          {noteLibre}
        </>
      ) : null}

      {f.type === 'indisponible' ? (
        <>
          <MenuDeroulantChoix sur={sur} sansVide etiquette="Motif" valeur={d.motif ?? ''} options={MOTIFS} onChoisir={(c) => maj({ motif: c })} />
          {d.motif === 'autre' ? precise('Motif') : null}
          <MenuDeroulantChoix sur={sur} sansVide etiquette="Entraînement possible" valeur={d.entrainement ?? ''} options={ENTRAINEMENT_INDISPO} onChoisir={(c) => maj({ entrainement: c })} />
          <ChampTexte etiquette="Lieu (facultatif)" sur={sur} value={d.lieu ?? ''} onChangeText={(t) => maj({ lieu: t })} maxLength={TEXTE_MAX_COURT} placeholder="Lisbonne, chez moi…" />
          {periode}
          {noteLibre}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  corps: { flexDirection: 'row', gap: espace.e4, alignItems: 'flex-start' },
});
