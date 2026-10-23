import { useLocalSearchParams } from 'expo-router';
import { dateIsoLocale } from '@/data/format';

// La date pour laquelle on ajoute quelque chose : celle du jour d'où l'on vient (paramètre « date » de l'écran), sinon aujourd'hui.
export function useDateAjout(): string {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const d = String(date ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateIsoLocale(new Date());
}
