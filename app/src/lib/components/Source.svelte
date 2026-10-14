<script>
  // Étiquette d'origine d'un chiffre : mesuré, calculé ou estimé. Elle dit à quel point on peut s'y fier.
  //  mesure     : lu tel quel dans tes séances (comptages, dates, charges notées)
  //  calcul     : formule connue appliquée à tes données (tonnage, 1RM d'Epley, moyennes, ratios)
  //  estimation : modèle avec des hypothèses (fatigue, répartition entre muscles, zones visées) : un ordre de grandeur, pas une mesure
  let { type = 'calcul' } = $props();
  const TEXTES = {
    mesure: { libelle: 'mesuré', aide: 'Lu tel quel dans tes séances (comptage, date, charge notée).' },
    calcul: { libelle: 'calculé', aide: 'Une formule connue appliquée à tes données (tonnage, 1RM estimé, moyenne, ratio).' },
    estimation: { libelle: 'estimé', aide: 'Un modèle avec des hypothèses : un ordre de grandeur, pas une mesure.' },
  };
  const t = $derived(TEXTES[type] || TEXTES.calcul);
</script>

<span class="source s-{type}" title={t.aide}>{t.libelle}</span>

<style>
  .source {
    display: inline-block;
    padding: 1px 7px;
    border: 1px solid var(--trait-fort);
    border-radius: var(--rayon-rond);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    line-height: 1.6;
    vertical-align: middle;
    white-space: nowrap;
    color: var(--texte-muet);
  }
  .s-estimation {
    border-style: dashed;
    color: var(--texte-doux);
  }
</style>
