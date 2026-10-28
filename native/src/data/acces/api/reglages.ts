import { sb } from '../supabase';
import type { LigneProfil } from '../../reglages/profil.ts';
import type { Profil } from '../../types';
import { resultat, type Reponse, type Resultat } from './commun';

const COLONNES_PROFIL = 'ftp,hr_max,lthr,weight,extras';

export async function chargerProfil(userId: string): Promise<Resultat<Profil | null>> {
  const r = await sb.from('user_profiles').select(COLONNES_PROFIL).eq('user_id', userId).maybeSingle();
  return resultat(r, 'Impossible de charger ton profil.');
}

/** Sports choisis par l'utilisateur (user_preferences.sports) : null s'il ne les a jamais choisis ou si la colonne n'existe pas. */
export async function chargerSportsChoisis(userId: string): Promise<Resultat<unknown>> {
  const r = await sb.from('user_preferences').select('sports').eq('user_id', userId).maybeSingle();
  // L'accueil ignore cette erreur (la barre se déduit des séances) ; l'écran Mes sports, lui, s'en sert pour ne pas écraser la vraie liste
  if (r.error) return { data: null, erreur: 'Impossible de charger tes sports.' };
  return { data: (r.data as { sports?: unknown } | null)?.sports ?? null, erreur: '' };
}

// ---------------------------------------------------------------------------
// Paramètres : profil et sports choisis
// ---------------------------------------------------------------------------

const COLONNES_PROFIL_COMPLET = 'weight,ftp,hr_max,lthr,extras';

/** Le profil complet (colonnes + extras), ou null si aucune ligne n'existe encore. */
export async function chargerProfilComplet(userId: string): Promise<Resultat<LigneProfil>> {
  const r = await sb.from('user_profiles').select(COLONNES_PROFIL_COMPLET).eq('user_id', userId).maybeSingle();
  return resultat<LigneProfil>(r as Reponse, 'Impossible de charger ton profil.');
}

/**
 * Enregistre une section du profil. `colonnes` : colonnes à mettre à jour ; `extras` : objet COMPLET (les clés des autres
 * sections sont déjà conservées par versPayload). Ne touche que la ligne de l'utilisateur connecté.
 */
export async function enregistrerProfil(userId: string, colonnes: Record<string, unknown>, extras: Record<string, unknown>): Promise<Resultat<LigneProfil>> {
  const r = await sb
    .from('user_profiles')
    .update({ ...colonnes, extras, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select(COLONNES_PROFIL_COMPLET)
    .maybeSingle();
  if (!r.error && !r.data) return { data: null, erreur: 'Profil introuvable : reconnecte-toi puis réessaie.' };
  return resultat<LigneProfil>(r as Reponse, "Impossible d'enregistrer ton profil.");
}

/** Enregistre les sports choisis (déjà nettoyés). N'écrit ni le thème, ni les disciplines du site, ni autre chose. */
export async function enregistrerSportsChoisis(userId: string, sports: string[]): Promise<{ erreur: string }> {
  const r = await sb.from('user_preferences').upsert({ user_id: userId, sports }, { onConflict: 'user_id' });
  if (r.error) {
    const e = r.error as { code?: string; message?: string };
    console.error('[app/api] sports', r.status, e.code || '', String(e.message || '').slice(0, 120));
    // Pour comprendre une panne : le code SQL s'il y en a un, le statut HTTP et le début du message technique (jamais de données)
    const code = /^[A-Za-z0-9]{3,8}$/.test(e.code ?? '') ? ` (code ${e.code})` : '';
    const technique = String(e.message || '').replace(/[^\w .:/-]/g, '').slice(0, 60);
    return { erreur: `Impossible d'enregistrer tes sports${code} [${r.status}${technique ? ` ${technique}` : ''}].` };
  }
  return { erreur: '' };
}

// ---------------------------------------------------------------------------
// Disposition de l'accueil de l'app mobile (user_preferences.layout_mobile). Le site a la sienne (`layout`) : les tailles ne sont pas les mêmes.
// ---------------------------------------------------------------------------

/** La disposition enregistrée (brute : à nettoyer avec normaliser). `data` vaut null si aucune ligne ; `erreur` non vide si la lecture échoue. */
export async function chargerLayout(userId: string): Promise<Resultat<unknown>> {
  const r = await sb.from('user_preferences').select('layout_mobile').eq('user_id', userId).maybeSingle();
  if (r.error) {
    console.error('[app/api] layout', r.error.code || '');
    return { data: null, erreur: 'Impossible de charger ta disposition.' };
  }
  return { data: (r.data as { layout_mobile?: unknown } | null)?.layout_mobile ?? null, erreur: '' };
}

/** Enregistre la disposition (déjà normalisée). N'écrit que la colonne `layout_mobile` de la ligne de l'utilisateur (jamais `layout`, celle du site). */
export async function enregistrerLayout(userId: string, layout: unknown): Promise<{ erreur: string }> {
  const r = await sb.from('user_preferences').upsert({ user_id: userId, layout_mobile: layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (r.error) {
    console.error('[app/api] layout', r.error.code || '');
    return { erreur: "Impossible d'enregistrer ta disposition." };
  }
  return { erreur: '' };
}
