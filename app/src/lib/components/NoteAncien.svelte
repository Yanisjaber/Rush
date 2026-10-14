<script>
  import { formatDateCourte, texteIlYa } from '../utils/format.js';
  import { joursDepuisDate } from '../data/force.js';

  // Petite note d'un widget qui montre une période passée parce qu'il n'y a rien de plus récent.
  let { derniere, suite = '' } = $props();
  const jours = $derived(joursDepuisDate(derniere));
</script>

<p class="ancien">Ta dernière séance date du {formatDateCourte(derniere)} ({texteIlYa(jours)}). {suite}</p>

<style>
  .ancien {
    margin: -4px 0 14px;
    font-size: 13px;
    color: var(--texte-doux);
  }
</style>
