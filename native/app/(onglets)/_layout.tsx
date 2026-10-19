import { NativeTabs } from 'expo-router/native-tabs';
import { police } from '@/theme/typo';
import { usePalette } from '@/theme/usePalette';

// Barre du bas native (iOS 26 : Liquid Glass ; Android : barre Material). Cinq onglets comme sur le web :
// Accueil, Calendrier, Bilan, Santé, Paramètres. Le Plan s'ouvrira depuis le Calendrier.
// Teinte active : la couleur du texte (elle passera à la couleur du sport actif quand le filtre par sport existera).
export default function OngletsLayout() {
  const p = usePalette();
  return (
    <NativeTabs tintColor={p.texte} labelStyle={{ fontFamily: police.texte600 }}>
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
      <NativeTabs.Trigger name="parametres">
        <NativeTabs.Trigger.Label>Paramètres</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
