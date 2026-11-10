import { appliquerTout } from '../../calendrier/retouches';
import { sb } from '../supabase';
import type { Seance } from '../../types';

// Retouches de séances (table activity_edits) : chargées une fois, puis réappliquées à toutes les séances lues.
// Si elles ne se chargent pas, on affiche les séances telles quelles plutôt que de bloquer la page.
let cacheRetouches: { userId: string | null; table: Record<string, unknown> | null } = { userId: null, table: null };
// Lecture en cours : deux appels simultanés (séances + dernières séances) attendent la même lecture au lieu d'en lancer chacun une.
let lectureEnCours: { userId: string; promesse: Promise<Record<string, unknown> | null> } | null = null;
export function invaliderRetouches(): void {
  cacheRetouches = { userId: null, table: null };
  lectureEnCours = null;
}
function tableRetouches(userId: string): Promise<Record<string, unknown> | null> {
  if (cacheRetouches.userId === userId && cacheRetouches.table) return Promise.resolve(cacheRetouches.table);
  if (lectureEnCours && lectureEnCours.userId === userId) return lectureEnCours.promesse;
  const promesse = lireRetouches(userId).finally(() => {
    if (lectureEnCours?.promesse === promesse) lectureEnCours = null;
  });
  lectureEnCours = { userId, promesse };
  return promesse;
}
async function lireRetouches(userId: string): Promise<Record<string, unknown> | null> {
  const table: Record<string, unknown> = Object.create(null); // sans prototype : une clé comme « constructor » n'est jamais prise pour une retouche
  // Par pages de 1000 (l'API n'en renvoie pas plus) : sans limite à 5000 retouches
  for (let page = 0; ; page++) {
    const r = await sb.from('activity_edits').select('activity_id,data').eq('user_id', userId).order('activity_id', { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (r.error) return null;
    const lignes = (r.data as { activity_id: unknown; data: unknown }[]) || [];
    for (const l of lignes) if (l && typeof l.data === 'object' && l.data) table[String(l.activity_id)] = l.data;
    if (lignes.length < 1000 || page >= 99) break;
  }
  cacheRetouches = { userId, table };
  return table;
}
export async function avecRetouches(userId: string, lignes: Seance[]): Promise<Seance[]> {
  const table = await tableRetouches(userId);
  return table ? appliquerTout(lignes, table) : lignes;
}
