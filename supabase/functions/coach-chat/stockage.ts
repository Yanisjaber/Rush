// ============================================================
// L'accès réel à la base pour le chat Coach (docs/ia/CADRAGE_IA.md) : l'implémentation de `StockageCoach`.
//
// Deux clients Supabase, deux rôles :
//   - `sbUser`  : porte le JWT de l'utilisateur. La RLS s'applique. On s'en sert pour TOUT ce qui se lit, et pour écrire
//                 dans le calendrier (activity_planned) : le coach n'a jamais plus de droits que l'utilisateur.
//   - `sbAdmin` : clé service role. Seulement pour ce que l'utilisateur ne peut pas faire lui-même : écrire la conversation,
//                 la mémoire, les compteurs, changer l'état d'une carte. L'identifiant de l'utilisateur vient TOUJOURS du JWT
//                 vérifié (index.ts), jamais de la requête.
//
// Un échec de lecture des signaux de santé fait échouer la requête (on ne laisse pas le garde-fou passer « par défaut »).
// ============================================================
// deno-lint-ignore-file no-explicit-any
import type { Carte, EtatCarte, MessageStocke } from '../_shared/coach-contexte.ts';
import { FONCTIONS_HISTORIQUE } from '../_shared/coach-actions.ts';
import { ErreurCoach } from '../_shared/coach-chat.ts';
import type { LigneSeancePrevue, SignauxSante, StockageCoach } from '../_shared/coach-chat.ts';
import { fusionnerProfil } from '../_shared/profil-coureur.ts';
import { ajouterJours } from '../_shared/dates-iso.ts';
import type { Usage } from '../_shared/modele.ts';

function echec(contexte: string, error: any): never {
  // Le code d'erreur de la base seulement : jamais de données de l'utilisateur dans les journaux
  console.error(`coach-chat: ${contexte} échoué`, error?.code || '');
  throw new ErreurCoach('base_indisponible', 500, "Je n'arrive pas à lire tes données pour le moment.");
}

export function creerStockage(sbUser: any, sbAdmin: any): StockageCoach {
  return {
    // Le Coach est ouvert à tout compte connecté (la liste blanche coach_acces n'est plus lue, depuis le 13 nov. 2026).
    // Restent les barrières : accord de partage des données, plafond de messages du jour, coupe-circuit de dépense du mois.
    async aAcces(_userId) {
      return true;
    },

    async lireReglages(userId) {
      const { data, error } = await sbUser.from('coach_reglages').select('accord_donnees, sante_categories').eq('user_id', userId).maybeSingle();
      if (error) echec('lecture des réglages', error);
      if (!data) return null;
      return { accord: data.accord_donnees === true, categories: Array.isArray(data.sante_categories) ? data.sante_categories : [] };
    },

    async compter(userId, jour, usage: Usage, microUsd) {
      const { error } = await sbAdmin.rpc('coach_compter', {
        p_user: userId,
        p_jour: jour,
        p_tokens_entree: usage.entree + usage.cacheLecture + usage.cacheEcriture,
        p_tokens_sortie: usage.sortie,
        p_micro_usd: microUsd,
      });
      if (error) echec('comptage', error);
    },

    async lireResume(userId, jour, categories) {
      // rpc_coach_resume ne lit que auth.uid() (le JWT) : userId n'est pas un paramètre
      const { data, error } = await sbUser.rpc('rpc_coach_resume', { p_date: jour, p_sante: categories });
      if (error) echec('lecture du résumé', error);
      // Toute la vie de coureur (années, arrêts, records) : le moteur de plan en a besoin pour ne pas prendre un coureur qui reprend pour un débutant.
      // Un échec ici n'empêche pas le coach de répondre : on continue sans.
      try {
        const { data: vie } = await sbUser.rpc('rpc_coach_vie_course', { p_date: jour, p_sante: categories });
        if (vie && data && typeof data === 'object') (data as Record<string, unknown>).vie_course = vie;
      } catch { /* sans l'historique long */ }
      // Pareil pour le vélo et la natation : toute leur vie, pas les 28 derniers jours
      for (const sport of ['velo', 'natation'] as const) {
        try {
          const { data: vie } = await sbUser.rpc('rpc_coach_vie_sport', { p_sport: sport, p_date: jour });
          if (vie && typeof vie === 'object' && (vie as Record<string, unknown>).sport === sport && data && typeof data === 'object') (data as Record<string, unknown>)[`vie_${sport}`] = vie;
        } catch { /* sans l'historique long */ }
      }
      return data;
    },

    async lireHistorique(_userId, fonction, args) {
      // Mêmes droits que le résumé (jeton de l'utilisateur, RLS) ; la fonction ne lit que auth.uid()
      if (!FONCTIONS_HISTORIQUE.includes(fonction)) throw new Error('fonction non autorisée');
      const { data, error } = await sbUser.rpc(fonction, args);
      if (error) echec("lecture de l'historique", error);
      return data;
    },

    async lireSignauxSante(userId, jour): Promise<SignauxSante> {
      const depuis = ajouterJours(jour, -35);
      const [sante, garmin] = await Promise.all([
        sbUser.from('health_metrics').select('date, metric, value').eq('user_id', userId).gte('date', depuis).lte('date', jour)
          .in('metric', ['evt_malade', 'evt_blesse', 'ressenti_fatigue']).limit(500),
        sbUser.from('garmin_sleep').select('date, resting_heart_rate, hrv_avg').eq('user_id', userId).gte('date', depuis).lte('date', jour).limit(100),
      ]);
      if (sante.error) echec('lecture de la santé', sante.error);
      if (garmin.error) echec('lecture des mesures de nuit', garmin.error);

      const parJour = new Map<string, { malade: boolean; blesse: boolean }>();
      const fatigue: SignauxSante['fatigue'] = [];
      for (const l of sante.data ?? []) {
        const v = Number(l.value);
        if (l.metric === 'ressenti_fatigue') {
          if (Number.isFinite(v)) fatigue.push({ date: l.date, valeur: v });
          continue;
        }
        const j = parJour.get(l.date) ?? { malade: false, blesse: false };
        if (l.metric === 'evt_malade' && v > 0) j.malade = true;
        if (l.metric === 'evt_blesse' && v > 0) j.blesse = true;
        parJour.set(l.date, j);
      }
      const evenements = [...parJour.entries()].map(([date, j]) => ({ date, malade: j.malade, blesse: j.blesse }));
      const fcRepos = (garmin.data ?? []).filter((l: any) => l.resting_heart_rate != null).map((l: any) => ({ date: l.date, bpm: Number(l.resting_heart_rate) }));
      const hrv = (garmin.data ?? []).filter((l: any) => l.hrv_avg != null).map((l: any) => ({ date: l.date, valeur: Number(l.hrv_avg) }));
      return { evenements, fcRepos, hrv, fatigue };
    },

    async lireMemoire(userId) {
      const { data, error } = await sbUser.from('coach_memoire').select('resume, jusqua').eq('user_id', userId).maybeSingle();
      if (error) echec('lecture de la mémoire', error);
      return data ? { resume: String(data.resume), jusqua: String(data.jusqua) } : null;
    },

    async lireMessagesDepuis(userId, jusqua) {
      let q = sbUser.from('chat_messages').select('id, role, contenu, cartes, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
      if (jusqua) q = q.gt('created_at', jusqua);
      const { data, error } = await q;
      if (error) echec('lecture de la conversation', error);
      return ((data ?? []) as MessageStocke[]).reverse();
    },

    async ecrireMessage(userId, m) {
      const { data, error } = await sbAdmin.from('chat_messages').insert({ user_id: userId, role: m.role, contenu: m.contenu, cartes: m.cartes }).select('id, created_at').single();
      if (error) echec('écriture du message', error);
      return { id: data.id, created_at: data.created_at };
    },

    async ecrireMemoire(userId, resume, jusqua) {
      const { error } = await sbAdmin.from('coach_memoire').upsert({ user_id: userId, resume, jusqua, updated_at: new Date().toISOString() });
      if (error) echec('écriture de la mémoire', error);
    },

    async changerEtatCarte(userId, carteId, de: EtatCarte | null, vers: EtatCarte | null, motif, seanceId) {
      const { data, error } = await sbAdmin.rpc('coach_carte_etat', {
        p_user: userId,
        p_carte: carteId,
        p_de: de,
        p_vers: vers,
        p_motif: motif ?? null,
        p_planned: seanceId ?? null,
      });
      if (error) echec('état de la carte', error);
      if (!data) return null;
      return { messageId: String(data.message_id), carte: data.carte as Carte };
    },

    async insererSeance(_userId, ligne: LigneSeancePrevue) {
      // Avec les droits de l'utilisateur : la RLS vérifie que user_id est bien le sien
      const { data, error } = await sbUser.from('activity_planned').insert(ligne).select('id').single();
      if (error) throw new Error(error.code || 'insertion');
      return String(data.id);
    },

    async appliquerPlan(_userId, operations) {
      // Avec les droits de l'utilisateur : la fonction SQL ne touche que ses lignes (RLS), en une seule transaction
      const { data, error } = await sbUser.rpc('coach_appliquer_plan', { p_ops: operations });
      if (error) throw new Error(error.message || error.code || 'plan');
      return Array.isArray(data) ? data : [];
    },

    async annulerPlan(_userId, inverse) {
      const { data, error } = await sbUser.rpc('coach_annuler_plan', { p_inverse: inverse });
      if (error) throw new Error(error.message || error.code || 'annulation');
      return { annulees: Number(data?.annulees ?? 0), ignorees: Number(data?.ignorees ?? 0) };
    },

    async memoriserInverse(userId, carteId, inverse) {
      const { error } = await sbAdmin.rpc('coach_carte_inverse', { p_user: userId, p_carte: carteId, p_inverse: inverse });
      if (error) echec("mémorisation de l'annulation", error);
    },

    async ecrireProfil(userId, colonnes) {
      // Avec les droits de l'utilisateur (RLS : sa seule ligne). On relit la ligne actuelle pour fusionner (jours, préférences), puis on écrit.
      const { data: actuel, error: e1 } = await sbUser.from('coach_profil').select('disponibilites, preferences').eq('user_id', userId).maybeSingle();
      if (e1) echec('lecture du profil', e1);
      const fusion = fusionnerProfil(actuel, colonnes);
      const { error } = await sbUser.from('coach_profil').upsert({ ...fusion, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) echec("écriture du profil", error);
    },

    async supprimerSeanceIA(_userId, seanceId) {
      // Seulement une séance créée par l'IA, et seulement la sienne (RLS)
      const { data, error } = await sbUser.from('activity_planned').delete().eq('id', seanceId).eq('created_by_ia', true).select('id');
      if (error) echec('suppression de la séance', error);
      return (data ?? []).length > 0;
    },
  };
}
