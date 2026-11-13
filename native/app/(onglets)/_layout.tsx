import { NativeTabs } from 'expo-router/native-tabs';
import { police } from '@/theme/typo';
import { useMenu } from '@/stores/menu';
import { couleurSport } from '@/theme/sports';
import { usePalette } from '@/theme/usePalette';

// Barre du bas native (iOS 26 : Liquid Glass ; Android : barre Material). Cinq onglets :
// Accueil, Calendrier, Bilan, Santé, Coach. Les Paramètres ne sont plus un onglet : la roue dentée en haut à droite les ouvre en plein écran.
// Le Plan s'ouvrira depuis le Calendrier.
// Teinte active : la couleur du sport choisi dans la barre du haut, sinon la couleur du texte (charte §7).
export default function OngletsLayout() {
  const p = usePalette();
  const { filtre } = useMenu();
  const teinte = filtre === 'tout' ? p.texte : couleurSport(p, filtre);
  return (
    <NativeTabs tintColor={teinte} labelStyle={{ fontFamily: police.texte600 }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendrier">
        <NativeTabs.Trigger.Label>Calendrier</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="bilan">
        <NativeTabs.Trigger.Label>Bilan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sante">
        <NativeTabs.Trigger.Label>Santé</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} md="favorite" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="coach">
        <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left', selected: 'bubble.left.fill' }} md="chat" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
