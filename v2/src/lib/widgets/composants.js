// Correspondance entre l'identifiant d'un widget (voir registre.js) et son composant Svelte.
import WidgetObjectif from './WidgetObjectif.svelte';
import WidgetCharge from './WidgetCharge.svelte';
import WidgetForme from './WidgetForme.svelte';
import WidgetVolume from './WidgetVolume.svelte';
import WidgetSemaine from './WidgetSemaine.svelte';
import WidgetRegularite from './WidgetRegularite.svelte';
import WidgetDernieres from './WidgetDernieres.svelte';
import WidgetPredictions from './WidgetPredictions.svelte';
import WidgetEfficacite from './WidgetEfficacite.svelte';
import WidgetMeilleures from './WidgetMeilleures.svelte';
import WidgetPuissance from './WidgetPuissance.svelte';
import WidgetForce from './WidgetForce.svelte';

export const COMPOSANTS = {
  objectif: WidgetObjectif,
  charge: WidgetCharge,
  forme: WidgetForme,
  volume: WidgetVolume,
  semaine: WidgetSemaine,
  regularite: WidgetRegularite,
  dernieres: WidgetDernieres,
  predictions: WidgetPredictions,
  efficacite: WidgetEfficacite,
  meilleures: WidgetMeilleures,
  puissance: WidgetPuissance,
  force: WidgetForce,
};
