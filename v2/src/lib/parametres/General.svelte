<script>
  import FormulaireSection from '../components/FormulaireSection.svelte';
  import Bloc from '../components/Bloc.svelte';
  import Bouton from '../components/Bouton.svelte';
  import { auth, deconnexion } from '../stores/auth.svelte.js';
  import { profil, estSale, enregistrerSection } from '../stores/profil.svelte.js';
  import { SECTIONS, champsDe, calculerAge, avatarSur } from '../data/profil.js';

  // Onglet Général : identité et compte.
  let { demo = false, userId } = $props();

  const section = SECTIONS.find((s) => s.id === 'identite');
  const email = $derived(demo ? 'Compte de démonstration' : auth.session?.user?.email || '');
  const age = $derived(calculerAge(profil.valeurs.identite?.birth_date));
  const aides = $derived(age != null ? { birth_date: { texte: `${age} ans` } } : {});
  const avatar = $derived(profil.ligne?.extras?.avatar_url);

  // Remplissage : champs renseignés / champs proposés (identité + physiologie)
  const remplissage = $derived.by(() => {
    let total = 0;
    let remplis = 0;
    for (const s of SECTIONS) {
      for (const c of champsDe(s)) {
        if (c.type === 'case') continue;
        total++;
        if (String(profil.valeurs[s.id]?.[c.cle] ?? '').trim() !== '') remplis++;
      }
    }
    return total ? Math.round((remplis / total) * 100) : 0;
  });
</script>

<div class="onglet">
  <FormulaireSection
    {section}
    bind:valeurs={profil.valeurs[section.id]}
    erreurs={profil.erreurs[section.id] || {}}
    sale={estSale(section.id)}
    envoi={!!profil.envoi[section.id]}
    message={profil.messages[section.id] || ''}
    erreurGlobale={profil.erreursGlobales[section.id] || ''}
    {aides}
    onenregistrer={() => enregistrerSection(section, userId, demo)}
  >
    {#snippet enTete()}
      <p class="remplissage"><span class="jauge" aria-hidden="true"><span style:width="{remplissage}%"></span></span>Profil rempli à {remplissage} %</p>
      {#if avatarSur(avatar)}<img class="avatar" src={avatar} alt="Ton avatar" width="72" height="72" />{/if}
    {/snippet}
  </FormulaireSection>

  <Bloc titre="Compte">
    <dl class="compte">
      <dt>Connecté en tant que</dt>
      <dd>{email}</dd>
    </dl>
    {#if demo}
      <Bouton variante="discret" href="./">Se connecter</Bouton>
    {:else}
      <div class="actions-compte">
        <Bouton variante="discret" href="#/mot-de-passe">Changer mon mot de passe</Bouton>
        <Bouton variante="discret" onclick={deconnexion}>Se déconnecter</Bouton>
      </div>
    {/if}
  </Bloc>
</div>

<style>
  .actions-compte {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .onglet {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .remplissage {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: -6px 0 16px;
    font-size: 14px;
    color: var(--texte-doux);
  }
  .jauge {
    width: 120px;
    height: 8px;
    border-radius: 4px;
    background: var(--trait);
    overflow: hidden;
  }
  .jauge span {
    display: block;
    height: 100%;
    background: var(--texte);
  }
  .avatar {
    display: block;
    margin-bottom: 14px;
    border-radius: 50%;
    object-fit: cover;
  }
  .compte {
    margin-bottom: 16px;
  }
  .compte dt {
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--texte-doux);
  }
  .compte dd {
    margin-top: 4px;
    font-size: 16px;
    word-break: break-all;
  }
</style>
