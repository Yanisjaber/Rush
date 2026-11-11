import { SUPABASE_URL } from '@/config';
import { sb } from '../supabase';
import type { ModeleZones } from '../../reglages/profil';

// « Faire calculer mes zones par le coach » : appelle la fonction coach-zones (voir supabase/functions/coach-zones). Elle ne modifie rien :
// elle renvoie une proposition de limites (début de chaque zone à partir de la 2e, en % de la référence) et une explication.
export interface PropositionZones {
  proposition: Partial<Record<ModeleZones, number[]>>;
  explication: string;
}

export async function demanderZonesAuCoach(): Promise<{ ok: true; resultat: PropositionZones } | { ok: false; message: string }> {
  const { data: s } = await sb.auth.getSession();
  const jeton = s.session?.access_token;
  if (!jeton) return { ok: false, message: 'Reconnecte-toi pour demander au coach.' };
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/coach-zones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    const corps = (await res.json().catch(() => null)) as { ok?: boolean; proposition?: unknown; explication?: unknown; message?: unknown } | null;
    if (!res.ok || !corps?.ok) return { ok: false, message: typeof corps?.message === 'string' ? corps.message : 'Le coach est indisponible pour le moment.' };
    const proposition: PropositionZones['proposition'] = {};
    for (const m of ['puissance', 'cardio', 'allure'] as const) {
      const v = (corps.proposition as Record<string, unknown> | undefined)?.[m];
      if (Array.isArray(v) && v.every((x) => typeof x === 'number')) proposition[m] = v as number[];
    }
    if (!Object.keys(proposition).length || typeof corps.explication !== 'string') return { ok: false, message: "La réponse du coach n'est pas lisible." };
    return { ok: true, resultat: { proposition, explication: corps.explication } };
  } catch {
    return { ok: false, message: 'Le coach est indisponible pour le moment.' };
  }
}
