import type { WidgetProps } from '@/data/types';
import { MeilleuresSortiesDenivele } from './WidgetMeilleuresTrail';

// Tes meilleures sorties de ski de fond des 12 dernières semaines (même mise en forme que celles du trail).
export function WidgetMeilleuresSki(props: WidgetProps) {
  return <MeilleuresSortiesDenivele {...props} sport="ski" />;
}
