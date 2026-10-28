import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { valeurValide, type DefMesure } from '@/data/sante/sante-catalogue';
import { espace, rayon } from '@/theme/couleurs';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Un champ numérique pour une mesure du catalogue (poids, calories…). La valeur est vérifiée avec ses bornes avant d'être enregistrée :
// une faute de frappe (un poids de 700 kg) est refusée avec un message, jamais corrigée en silence. Vider le champ efface la mesure.
interface Props {
  def: DefMesure;
  valeur: number | undefined;
  onChange: (valeur: number | null) => void;
  /** Écrit la phrase d'aide sous le champ (par défaut oui) ; sinon elle reste lue par VoiceOver. */
  aideVisible?: boolean;
}

const enTexte = (v: number | undefined) => (v == null ? '' : String(v).replace('.', ','));

export function ChampMesure({ def, valeur, onChange, aideVisible = true }: Props) {
  const p = usePalette();
  const [texte, setTexte] = useState(enTexte(valeur));
  const [erreur, setErreur] = useState('');
  // Quand la valeur change de l'extérieur (autre jour, autre source), le champ la reprend
  useEffect(() => {
    setTexte(enTexte(valeur));
    setErreur('');
  }, [valeur]);

  function valider() {
    if (texte.trim() === '') {
      setErreur('');
      if (valeur != null) onChange(null);
      return;
    }
    const v = valeurValide(def.cle, texte);
    if (v == null) {
      setErreur(`Entre une valeur entre ${def.min} et ${def.max}${def.unite ? ` ${def.unite}` : ''}.`);
      return;
    }
    setErreur('');
    setTexte(enTexte(v));
    if (v !== valeur) onChange(v);
  }

  return (
    <View style={{ marginTop: espace.e3 }}>
      <Text style={[typo.micro, { color: p.texteDoux }]}>{def.unite ? `${def.nom} (${def.unite})` : def.nom}</Text>
      <TextInput
        value={texte}
        onChangeText={setTexte}
        onBlur={valider}
        onSubmitEditing={valider}
        returnKeyType="done"
        keyboardType="decimal-pad"
        autoCorrect={false}
        maxLength={8}
        accessibilityLabel={def.unite ? `${def.nom} en ${def.unite}` : def.nom}
        accessibilityHint={def.aide}
        placeholder="—"
        placeholderTextColor={p.texteMuet}
        style={[styles.champ, typo.corps, { color: p.texte, backgroundColor: p.surface2, borderColor: erreur ? p.danger : p.contourChamp }]}
      />
      {erreur ? (
        <Text accessibilityRole="alert" style={[typo.petit, { color: p.danger, marginTop: 4 }]}>
          {erreur}
        </Text>
      ) : def.aide && aideVisible ? (
        <Text style={[typo.petit, { color: p.texteMuet, marginTop: 4 }]}>{def.aide}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  champ: { minHeight: 48, borderWidth: 1.5, borderRadius: rayon.base, paddingHorizontal: 14, marginTop: 4 },
});
