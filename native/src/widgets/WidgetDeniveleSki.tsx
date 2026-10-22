import type { WidgetProps } from '@/data/types';
import { DeniveleParSemaine } from './WidgetDeniveleTrail';

// Le dénivelé positif grimpé chaque semaine en ski de fond, ski à roulettes et hors-piste (même mise en forme que celui du trail).
export function WidgetDeniveleSki(props: WidgetProps) {
  return <DeniveleParSemaine {...props} sport="ski" />;
}
