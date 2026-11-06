import { View } from 'react-native';
import { EcranSection } from '@/components/ecrans/EcranSection';
import { FormulaireSection } from '@/components/feuilles/FormulaireSection';
import { PhotoProfil } from '@/components/feuilles/PhotoProfil';
import { espace } from '@/theme/couleurs';

export default function Profil() {
  return (
    <EcranSection>
      <View style={{ gap: espace.e4 }}>
        <PhotoProfil />
        <FormulaireSection id="identite" />
      </View>
    </EcranSection>
  );
}
