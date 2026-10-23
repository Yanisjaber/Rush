import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ChoixCouleur, PastillesChoix } from '@/components/ChampsFeuille';
import { EcranAjout } from '@/components/EcranAjout';
import { SelecteurDate } from '@/components/SelecteurDate';
import { formulaireNoteVide, PALETTE_NOTE, TEXTE_MAX_NOTE, TYPES_NOTE, validerNote } from '@/data/ajouts';
import { useAjouts } from '@/hooks/useAjouts';
import { useDateAjout } from '@/hooks/useDateAjout';
import { rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Ajouter une note (une ligne de day_notes) : un type (note, maladie, blessure), un texte, une période et une couleur.
export default function EcranAjoutNote() {
  const p = usePalette();
  const router = useRouter();
  const { creerNote } = useAjouts();
  const [f, setF] = useState(formulaireNoteVide(useDateAjout()));
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const change = (suite: typeof f) => {
    setF(suite);
    setErreur('');
  };

  async function enregistrer() {
    const r = validerNote(f);
    if (!r.ok) return setErreur(r.erreur);
    setEnCours(true);
    const e = await creerNote(r.ligne);
    setEnCours(false);
    if (e) return setErreur(e);
    router.back();
  }

  return (
    <EcranAjout titre="Nouvelle note" bouton="Ajouter la note" enCours={enCours} erreur={erreur} onValider={() => void enregistrer()}>
      <PastillesChoix
        valeurs={TYPES_NOTE.map((t) => ({ cle: t.cle, nom: t.nom }))}
        actuel={f.type}
        onChoisir={(v) => change({ ...f, type: v, couleur: TYPES_NOTE.find((t) => t.cle === v)?.couleur ?? f.couleur })}
        etiquette="Type de note"
      />
      <View style={{ gap: 6 }}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>{f.type === 'texte' ? 'Ta note' : 'Précision (facultatif)'}</Text>
        <TextInput
          value={f.texte}
          onChangeText={(t) => change({ ...f, texte: t })}
          maxLength={TEXTE_MAX_NOTE}
          multiline
          placeholder="Un mot sur ta journée…"
          placeholderTextColor={p.texteMuet}
          accessibilityLabel="Texte de la note"
          style={[typo.corps, styles.champ, { color: p.texte, backgroundColor: p.surface2, borderColor: p.contourChamp }]}
        />
      </View>
      <SelecteurDate etiquette="Du" date={f.de} onChange={(iso) => change({ ...f, de: iso, a: f.a < iso ? iso : f.a })} />
      <SelecteurDate etiquette="Au" date={f.a} onChange={(iso) => change({ ...f, a: iso, de: iso < f.de ? iso : f.de })} />
      <View style={{ gap: 6 }}>
        <Text style={[typo.micro, { color: p.texteDoux }]}>Couleur</Text>
        <ChoixCouleur couleurs={PALETTE_NOTE.map((hex) => ({ hex, nom: hex }))} actuelle={f.couleur} onChoisir={(hex) => change({ ...f, couleur: hex })} />
      </View>
    </EcranAjout>
  );
}

const styles = StyleSheet.create({
  champ: { minHeight: 96, textAlignVertical: 'top', borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14, paddingTop: 12 },
});
