import { useLocalSearchParams } from 'expo-router';
import { dateValide } from '@/data/calendrier/ajouts';
import { dateIsoLocale } from '@/data/outils/format';

// La date pour laquelle on ajoute quelque chose : celle du jour d'où l'on vient (paramètre « date » de l'écran), sinon aujourd'hui.
export function useDateAjout(): string {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const d = String(date ?? '');
  return dateValide(d) ? d : dateIsoLocale(new Date()); // une vraie date du calendrier (« 2026-13-45 » n'en est pas une)
}
