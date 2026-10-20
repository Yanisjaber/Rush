import { StyleSheet, Switch, Text, View } from 'react-native';
import { typo } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Une case oui / non (malade, blessé, voyage…) : un libellé, une aide, un interrupteur.
interface Props {
  nom: string;
  aide?: string;
  actif: boolean;
  onChange: (actif: boolean) => void;
}

export function InterrupteurMesure({ nom, aide, actif, onChange }: Props) {
  const p = usePalette();
  return (
    <View style={styles.ligne}>
      <View style={{ flex: 1 }}>
        <Text style={[typo.corpsFort, { color: p.texte }]}>{nom}</Text>
        {aide ? <Text style={[typo.petit, { color: p.texteDoux }]}>{aide}</Text> : null}
      </View>
      <Switch value={actif} onValueChange={onChange} accessibilityLabel={nom} trackColor={{ true: p.sportMuscu, false: p.surface2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
});
