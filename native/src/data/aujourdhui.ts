// La séance du jour, quel que soit le sport : ce qui est prévu aujourd'hui, et ce qui est déjà fait. Calculs purs (tests/aujourdhui.test.ts).
import { familleAffichage } from './familles.ts';
import { dateIsoLocale, formatDuree, formatKm } from './format.ts';
import type { Prevue, Seance } from './types.ts';

export interface SeancesDuJour {
  /** Les séances prévues aujourd'hui, la compétition d'abord. */
  prevues: Prevue[];
  /** Les séances déjà faites aujourd'hui. */
  faites: Seance[];
}

export function seancesDuJour(planifiees: Prevue[] | null | undefined, seances: Seance[] | null | undefined, aujourdhui: Date = new Date()): SeancesDuJour {
  const iso = dateIsoLocale(aujourdhui);
  const prevues = (planifiees ?? []).filter((p) => String(p.date).slice(0, 10) === iso).sort((a, b) => Number(b.category === 'competition') - Number(a.category === 'competition'));
  const faites = (seances ?? []).filter((s) => String(s.start_date_local).slice(0, 10) === iso);
  return { prevues, faites };
}

/** Une séance faite du même sport que la prévue (la séance d'aujourd'hui est « faite »). Null si pas encore faite. */
export function faitePour(prevue: Prevue, faites: Seance[]): Seance | null {
  const famille = familleAffichage(prevue.sport);
  return faites.find((s) => familleAffichage(s.sport) === famille) ?? null;
}

/** Une séance du jour, prévue ou faite, prête à afficher. */
export interface ElementDuJour {
  cle: string;
  /** Le sport brut (pour la famille, la couleur et le nom court). */
  sport: string;
  /** Le nom donné à la séance (null : on affichera le nom du sport). */
  nom: string | null;
  /** Durée prévue en minutes, si on la connaît. */
  prevueMinutes: number | null;
  /** Distance prévue en km, si on la connaît. */
  km: number | null;
  /** Programme de force relié à la séance prévue (pour compter ses exercices). */
  programmeId: string | null;
  /** Était-elle prévue (au calendrier) ? Faux pour une séance faite sans être prévue. */
  prevue: boolean;
  /** La séance est-elle faite ? */
  fait: boolean;
  /** Durée réelle en secondes quand elle est faite. */
  faiteSecondes: number | null;
}

/**
 * Toutes les séances du jour sur une seule liste : les séances prévues (« faites » quand une séance du même sport est enregistrée),
 * puis les séances faites qui n'étaient pas prévues. Ce qui reste à faire passe avant ce qui est fait ; à égalité, l'ordre d'origine
 * (compétition d'abord).
 */
export function elementsDuJour(jour: SeancesDuJour): ElementDuJour[] {
  const utilisees = new Set<string>();
  const prevus: ElementDuJour[] = jour.prevues.map((p) => {
    // Une séance faite ne rend « faite » qu'une seule séance prévue (deux séances prévues le même sport = deux séances à faire)
    const f = jour.faites.find((s) => !utilisees.has(s.id) && familleAffichage(s.sport) === familleAffichage(p.sport)) ?? null;
    if (f) utilisees.add(f.id);
    return { cle: `p${p.id}`, sport: p.sport, nom: p.name, prevueMinutes: p.duration, km: p.km, programmeId: p.programme_id ?? null, prevue: true, fait: !!f, faiteSecondes: f ? f.moving_time : null };
  });
  const hors: ElementDuJour[] = jour.faites.filter((s) => !utilisees.has(s.id)).map((s) => ({ cle: `s${s.id}`, sport: s.sport, nom: s.name, prevueMinutes: null, km: null, programmeId: null, prevue: false, fait: true, faiteSecondes: s.moving_time }));
  const tous = [...prevus, ...hors];
  return [...tous.filter((e) => !e.fait), ...tous.filter((e) => e.fait)];
}

/**
 * Les infos d'une séance prévue sur une ligne : « 2h30 · 70 km », « 1h00 · 5 exos ». Ce qu'on ne connaît pas est simplement absent.
 * `exercices` : le nombre d'exercices du programme relié (muscu).
 */
export function infosDuJour(e: Pick<ElementDuJour, 'prevueMinutes' | 'km'>, exercices: number | null = null): string {
  const morceaux: string[] = [];
  if (e.prevueMinutes) morceaux.push(formatDuree(e.prevueMinutes * 60));
  if (e.km) morceaux.push(`${Number.isInteger(e.km) ? e.km : formatKm(e.km)} km`);
  if (exercices) morceaux.push(`${exercices} exo${exercices > 1 ? 's' : ''}`);
  return morceaux.join(' · ');
}

/**
 * Les séances à montrer dans la bande fine : jusqu'à 2, toutes ; au-delà, seulement la plus longue (la première à égalité),
 * `autres` donne le nombre de séances cachées et `autresMinutes` la somme de leurs durées (0 si on ne les connaît pas) : « + 2 séances · 1h25 ».
 */
export function lignesDeLaBande<T extends { prevueMinutes: number | null }>(aFaire: T[]): { lignes: T[]; autres: number; autresMinutes: number } {
  if (aFaire.length <= 2) return { lignes: aFaire, autres: 0, autresMinutes: 0 };
  const plusLongue = aFaire.reduce((a, b) => ((b.prevueMinutes ?? 0) > (a.prevueMinutes ?? 0) ? b : a));
  const cachees = aFaire.filter((e) => e !== plusLongue);
  return { lignes: [plusLongue], autres: cachees.length, autresMinutes: cachees.reduce((t, e) => t + (e.prevueMinutes ?? 0), 0) };
}
