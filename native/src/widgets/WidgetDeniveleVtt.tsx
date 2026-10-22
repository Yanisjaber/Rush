import type { WidgetProps } from '@/data/types';
import { DeniveleParSemaine } from './WidgetDeniveleTrail';

// Le dénivelé positif grimpé chaque semaine en VTT (même mise en forme que celui du trail).
export function WidgetDeniveleVtt(props: WidgetProps) {
  return <DeniveleParSemaine {...props} sport="vtt" />;
}
