import type { WidgetProps } from '@/data/types';
import { MeilleuresSortiesDenivele } from './WidgetMeilleuresTrail';

// Tes meilleures sorties de VTT des 12 dernières semaines (même mise en forme que celles du trail).
export function WidgetMeilleuresVtt(props: WidgetProps) {
  return <MeilleuresSortiesDenivele {...props} sport="vtt" />;
}
