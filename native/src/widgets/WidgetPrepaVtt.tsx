import type { WidgetProps } from '@/data/types';
import { PrepaDenivele } from './WidgetPrepaTrail';

// Où tu en es du dénivelé de ta prochaine course de VTT (même mise en forme que la prépa du trail).
export function WidgetPrepaVtt(props: WidgetProps) {
  return <PrepaDenivele {...props} sport="vtt" />;
}
