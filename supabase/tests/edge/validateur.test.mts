// Test du validateur de séances et du menu du coach IA (aucun réseau, aucune base).
// Lancer : node --experimental-strip-types --test supabase/tests/edge/validateur.test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliserReglages, PLAFONDS, REGLAGES_DEFAUT, seuilJourDur, validerSeance } from '../../functions/_shared/validateur.ts';
import type { ContexteValidation, Proposition } from '../../functions/_shared/validateur.ts';
import { clesDuMenu, MENU, PLAFOND_MINUTES, tssEstime, typeSeance } from '../../functions/_shared/menu-seances.ts';
import type { DecisionGardeFou } from '../../functions/_shared/garde-fou.ts';
import { ajouterJours, dateValide, ecartJours } from '../../functions/_shared/dates-iso.ts';

const AUJ = '2026-11-06';
const LIBRE: DecisionGardeFou = { niveau: 'normal', raisons: [], message: null, autoriserModele: true, autoriserCartes: true, intensiteMax: 'normale' };

/** Contexte de départ : CTL 40 (donc un jour est « dur » à partir de 64 points), base de 400 points par semaine, aucun jour chargé. */
function ctx(sur: Partial<ContexteValidation> = {}): ContexteValidation {
  return {
    aujourdhui: AUJ,
    ctl: 40,
    referenceHebdoTss: 400,
    joursPasses: [],
    prevues: [],
    indisponibilites: [],
    joursDeRepos: [],
    competitions: [],
    plusLongueMinutes: { velo: 180, course: 90, natation: 45 },
    gardeFou: LIBRE,
    reglages: { ...REGLAGES_DEFAUT },
    ...sur,
  };
}
const velo = (date: string, type: string, minutes: number): Proposition => ({ date, sport: 'velo', type, minutes });
const codes = (r: { erreurs: { code: string }[] }) => r.erreurs.map((e) => e.code);
const jour = (n: number, tss: number) => ({ date: ajouterJours(AUJ, n), tss });

// ---------- menu ----------
test('menu : chaque type a une zone, une durée cohérente et une charge positive ; les clés sont uniques par sport', () => {
  for (const [sport, types] of Object.entries(MENU)) {
    const cles = types.map((t) => t.cle);
    assert.equal(new Set(cles).size, cles.length, `clés en double en ${sport}`);
    for (const t of types) {
      assert.ok(t.minMinutes > 0 && t.minMinutes < t.maxMinutes, `${sport}/${t.cle}`);
      assert.ok(t.maxMinutes <= PLAFOND_MINUTES[sport as keyof typeof PLAFOND_MINUTES], `${sport}/${t.cle} dépasse le plafond du sport`);
      assert.ok(t.tssParHeure > 0);
      assert.equal(t.dure, t.zone >= 4, `${sport}/${t.cle} : « dure » = zone 4 ou plus`);
    }
  }
});
test('menu : une clé inconnue ou un sport hors liste ne renvoie rien (aucune injection par prototype)', () => {
  assert.equal(typeSeance('velo', 'endurance')?.nom, 'Endurance');
  for (const [s, k] of [['velo', 'inconnu'], ['muscu', 'endurance'], ['velo', '__proto__'], ['__proto__', 'endurance'], ['velo', 12], [null, null]] as const) {
    assert.equal(typeSeance(s, k), null);
  }
  assert.deepEqual(clesDuMenu('natation'), ['technique', 'endurance', 'seuil', 'vitesse']);
});
test('charge estimée : 1 h 30 d\'endurance à vélo = 75 points', () => {
  assert.equal(tssEstime(typeSeance('velo', 'endurance')!, 90), 75);
});

// ---------- dates ----------
test('dates : jours ajoutés, écart et validité', () => {
  assert.equal(ajouterJours('2026-12-30', 3), '2027-01-02');
  assert.equal(ajouterJours('2026-03-01', -1), '2026-02-28');
  assert.equal(ecartJours('2026-11-06', '2026-11-20'), 14);
  assert.equal(dateValide('2026-02-30'), false);
  assert.equal(dateValide('2026-2-3'), false);
  assert.equal(dateValide('2026-11-06'), true);
  assert.equal(dateValide(20261106), false);
});

// ---------- réglages ----------
test('réglages : valeurs absentes ou absurdes = défauts ; jamais au-dessus des plafonds absolus', () => {
  assert.deepEqual(normaliserReglages(null), REGLAGES_DEFAUT);
  assert.deepEqual(normaliserReglages('n\'importe quoi'), REGLAGES_DEFAUT);
  assert.deepEqual(normaliserReglages({ hausseHebdoMaxPct: Number.NaN, duresAffileeMax: 'beaucoup' }), REGLAGES_DEFAUT);
  const fort = normaliserReglages({ hausseHebdoMaxPct: 50, duresAffileeMax: 5, reposMinParSemaine: 9, facteurLongueMax: 10 });
  assert.equal(fort.hausseHebdoMaxPct, PLAFONDS.hausseHebdoMaxPct);
  assert.equal(fort.duresAffileeMax, PLAFONDS.duresAffileeMax);
  assert.equal(fort.reposMinParSemaine, 3);
  assert.equal(fort.facteurLongueMax, PLAFONDS.facteurLongueMax);
  const bas = normaliserReglages({ hausseHebdoMaxPct: -5, duresAffileeMax: 0, reposMinParSemaine: -1, facteurLongueMax: 0.2 });
  assert.deepEqual(bas, { hausseHebdoMaxPct: 0, duresAffileeMax: 1, reposMinParSemaine: 0, facteurLongueMax: 1 });
  assert.equal(normaliserReglages({ hausseHebdoMaxPct: '15' }).hausseHebdoMaxPct, 15);
  assert.equal(normaliserReglages({ duresAffileeMax: 1.6 }).duresAffileeMax, 2, 'un nombre de jours est entier');
});

// ---------- forme de la proposition ----------
test('une séance normale est acceptée, avec sa charge estimée', () => {
  const r = validerSeance(velo('2026-11-08', 'endurance', 90), ctx());
  assert.deepEqual(r, { ok: true, erreurs: [], avertissements: [], tssEstime: 75 });
});
test('proposition mal formée : refusée sans calcul (dates impossibles, sport ou type hors liste, durées absurdes)', () => {
  assert.deepEqual(codes(validerSeance({ date: '2026-02-30', sport: 'velo', type: 'endurance', minutes: 60 }, ctx())), ['date_invalide']);
  assert.deepEqual(codes(validerSeance({ date: '2026-11-08', sport: 'muscu', type: 'endurance', minutes: 60 }, ctx())), ['sport_inconnu']);
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'marathon', 60), ctx())), ['type_inconnu']);
  for (const minutes of [0, -30, Number.NaN, Infinity, '90' as unknown as number]) {
    const r = validerSeance(velo('2026-11-08', 'endurance', minutes), ctx());
    assert.deepEqual(codes(r), ['minutes_invalides']);
    assert.equal(r.tssEstime, null);
  }
  assert.equal(validerSeance(null as unknown as Proposition, ctx()).ok, false);
});

// ---------- durée ----------
test('durée : dans la plage du type, et pas démesurée par rapport à ce que fait l\'utilisateur', () => {
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'recuperation', 120), ctx())), ['duree_hors_menu']);
  // plus longue sortie à vélo = 60 min, facteur 2 : limite 120 min (jamais moins de 90)
  const c = ctx({ plusLongueMinutes: { velo: 60 } });
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 150), c)), ['seance_trop_longue']);
  assert.equal(validerSeance(velo('2026-11-08', 'endurance', 100), c).ok, true);
  // jamais de séance à vélo dans les 28 jours : au plus 60 minutes
  const neuf = ctx({ plusLongueMinutes: {} });
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 90), neuf)), ['seance_trop_longue']);
  assert.equal(validerSeance(velo('2026-11-08', 'endurance', 60), neuf).ok, true);
  // l'utilisateur qui a réglé « facteur 3 » peut aller plus loin, jamais au-delà du plafond du sport
  const large = ctx({ plusLongueMinutes: { velo: 200 }, reglages: normaliserReglages({ facteurLongueMax: 10 }) });
  assert.equal(validerSeance(velo('2026-11-08', 'sortie_longue', 360), large).ok, true);
  assert.equal(validerSeance(velo('2026-11-08', 'sortie_longue', 361), large).ok, false);
});

// ---------- le jour ----------
test('jour : ni passé, ni à plus de 14 jours ; aujourd\'hui est permis', () => {
  assert.deepEqual(codes(validerSeance(velo('2026-11-05', 'endurance', 60), ctx())), ['date_passee']);
  assert.equal(validerSeance(velo(AUJ, 'endurance', 60), ctx()).ok, true);
  assert.equal(validerSeance(velo('2026-11-20', 'endurance', 60), ctx()).ok, true);
  assert.deepEqual(codes(validerSeance(velo('2026-11-21', 'endurance', 60), ctx())), ['date_trop_loin']);
});
test('jour : malade, blessé ou indisponible = refus (plafond absolu), quels que soient les réglages', () => {
  for (const type of ['maladie', 'blessure', 'indisponible'] as const) {
    const c = ctx({ indisponibilites: [{ type, du: '2026-11-07', au: '2026-11-09' }], reglages: normaliserReglages({ hausseHebdoMaxPct: 99, duresAffileeMax: 9, reposMinParSemaine: 0 }) });
    assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'recuperation', 40), c)), ['jour_indisponible'], type);
    assert.equal(validerSeance(velo('2026-11-10', 'recuperation', 40), c).ok, true, 'le lendemain de la période est libre');
  }
});
test('jour de repos posé par l\'utilisateur et jour de compétition : refus', () => {
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ joursDeRepos: ['2026-11-08'] }))), ['jour_de_repos']);
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ competitions: [{ date: '2026-11-08' }] }))), ['jour_de_competition']);
});

// ---------- garde-fou ----------
test('garde-fou : « repos » ou « pro » = aucune séance, avec son message ; « prudence » = zones 1-2 seulement', () => {
  const repos: DecisionGardeFou = { niveau: 'repos', raisons: ['malade'], message: 'Aujourd\'hui, c\'est repos.', autoriserModele: true, autoriserCartes: false, intensiteMax: 'repos' };
  const r = validerSeance(velo('2026-11-08', 'recuperation', 40), ctx({ gardeFou: repos }));
  assert.deepEqual(codes(r), ['garde_fou']);
  assert.equal(r.erreurs[0].message, 'Aujourd\'hui, c\'est repos.');
  const prudence: DecisionGardeFou = { niveau: 'prudence', raisons: ['blessure'], message: 'Doucement.', autoriserModele: true, autoriserCartes: true, intensiteMax: 'facile' };
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'seuil', 45), ctx({ gardeFou: prudence }))), ['intensite_trop_haute']);
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'tempo', 60), ctx({ gardeFou: prudence }))), ['intensite_trop_haute']);
  assert.equal(validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ gardeFou: prudence })).ok, true);
});

// ---------- jours durs ----------
test('jour dur : le seuil suit la forme de l\'athlète (au moins 60 points)', () => {
  assert.equal(seuilJourDur(null), 60);
  assert.equal(seuilJourDur(40), 64);
  assert.equal(seuilJourDur(100), 160);
});
test('jours durs d\'affilée : réglage par défaut = jamais deux de suite, et la veille comme le lendemain comptent', () => {
  const dur = ctx({ joursPasses: [jour(-1, 100)] }); // hier : 100 points ≥ 64, un jour dur
  assert.deepEqual(codes(validerSeance(velo(AUJ, 'seuil', 60), dur)), ['dures_affilee']);
  assert.equal(validerSeance(velo(AUJ, 'endurance', 60), dur).ok, true, 'une séance facile après un jour dur est permise');
  // le lendemain : une séance dure est déjà prévue le 9, on propose un seuil le 8
  const prevu = ctx({ prevues: [{ date: '2026-11-09', tss: 100 }] });
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'seuil', 60), prevu)), ['dures_affilee']);
  assert.equal(validerSeance(velo('2026-11-07', 'seuil', 60), prevu).ok, true, 'le 7 est séparé du 9 par un jour');
});
test('jours durs d\'affilée : l\'utilisateur peut en autoriser deux, jamais trois (plafond absolu)', () => {
  const reglages = normaliserReglages({ duresAffileeMax: 2 });
  assert.equal(validerSeance(velo(AUJ, 'seuil', 60), ctx({ joursPasses: [jour(-1, 100)], reglages })).ok, true);
  assert.deepEqual(codes(validerSeance(velo(AUJ, 'seuil', 60), ctx({ joursPasses: [jour(-1, 100), jour(-2, 100)], reglages }))), ['dures_affilee']);
  assert.deepEqual(codes(validerSeance(velo(AUJ, 'seuil', 60), ctx({ joursPasses: [jour(-1, 100), jour(-2, 100)], reglages: normaliserReglages({ duresAffileeMax: 9 }) }))), ['dures_affilee']);
});
test('la veille d\'une compétition : rien de dur', () => {
  const c = ctx({ competitions: [{ date: '2026-11-09' }] });
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'vo2max', 45), c)), ['veille_competition']);
  assert.equal(validerSeance(velo('2026-11-08', 'recuperation', 40), c).ok, true);
});

// ---------- hausse de charge ----------
test('hausse hebdo : le réglage de l\'utilisateur, puis le plafond absolu qu\'il ne peut pas dépasser', () => {
  // base 300 : limite réglée à +10 % = 330 ; plafond absolu +20 % = 360. Les 6 jours d'avant la séance pèsent déjà 240.
  const passes = [jour(-3, 60), jour(-2, 60), jour(-1, 60), jour(0, 60)]; // 240 points, aucun jour « dur » (seuil 64)
  const base = { referenceHebdoTss: 300, joursPasses: passes };
  // 240 + 100 = 340 : trop pour +10 % (330), permis à +20 % (360)
  const trop = validerSeance(velo('2026-11-07', 'endurance', 120), ctx(base)); // 120 min × 50 = 100
  assert.deepEqual(codes(trop), ['hausse_hebdo']);
  assert.match(trop.erreurs[0].message, /ta limite/);
  const vingt = ctx({ ...base, reglages: normaliserReglages({ hausseHebdoMaxPct: 20 }) });
  assert.equal(validerSeance(velo('2026-11-07', 'endurance', 120), vingt).ok, true);
  // 240 + 138 (sortie longue de 150 min × 55 points/h) = 378 dépasse 360 : refus même à +20 %, et même si l'utilisateur demande +99 %
  const demesure = ctx({ ...base, reglages: normaliserReglages({ hausseHebdoMaxPct: 99 }) });
  assert.deepEqual(codes(validerSeance(velo('2026-11-07', 'sortie_longue', 150), demesure)), ['hausse_hebdo_plafond']);
});
test('hausse hebdo : une base de départ très basse ne bloque pas (plancher), mais une grosse séance seule est refusée', () => {
  const debut = ctx({ referenceHebdoTss: 0, plusLongueMinutes: {} });
  assert.equal(validerSeance(velo('2026-11-08', 'endurance', 60), debut).ok, true); // 50 points ≤ 60
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'vo2max', 45), debut)), ['hausse_hebdo_plafond']); // 90 points
});
test('la charge prévue compte, mais une séance « prévue » déjà passée ne compte pas deux fois', () => {
  const c = ctx({
    referenceHebdoTss: 100, // limite +10 % = 110
    joursPasses: [jour(-1, 60)],
    prevues: [{ date: AUJ, tss: 60 }, { date: '2026-11-07', tss: null }],
    plusLongueMinutes: { velo: 90 },
  });
  // 60 (hier, réel) + 50 (la prévue d'aujourd'hui est ignorée : le jour est passé ou en cours) → 60 + 50 = 110 : accepté pile
  assert.equal(validerSeance(velo('2026-11-08', 'endurance', 60), c).ok, true);
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 70), c)), ['hausse_hebdo']); // 60 + 58 = 118 > 110, mais sous le plafond absolu (120)
  assert.deepEqual(codes(validerSeance(velo('2026-11-08', 'endurance', 75), c)), ['hausse_hebdo_plafond']); // 60 + 63 = 123 > 120
});

// ---------- repos ----------
test('repos : au moins un jour sans séance sur 7 jours glissants (réglable, 0 = aucune contrainte)', () => {
  const sixJours = [jour(-5, 20), jour(-4, 20), jour(-3, 20), jour(-2, 20), jour(-1, 20), jour(0, 20)];
  const c = ctx({ joursPasses: sixJours });
  assert.deepEqual(codes(validerSeance(velo('2026-11-07', 'recuperation', 40), c)), ['repos_hebdo']);
  const libre = ctx({ joursPasses: sixJours, reglages: normaliserReglages({ reposMinParSemaine: 0 }) });
  assert.equal(validerSeance(velo('2026-11-07', 'recuperation', 40), libre).ok, true);
});

// ---------- avertissement et cumul ----------
test('une séance déjà prévue ce jour-là : avertissement, pas un refus', () => {
  const r = validerSeance(velo('2026-11-08', 'endurance', 60), ctx({ prevues: [{ date: '2026-11-08', tss: 40 }] }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.avertissements.map((a) => a.code), ['deja_une_seance']);
});
test('plusieurs problèmes : toutes les erreurs sont listées, avec un message lisible pour chacune', () => {
  const c = ctx({ indisponibilites: [{ type: 'blessure', du: '2026-11-08', au: '2026-11-08' }], plusLongueMinutes: { velo: 60 } });
  const r = validerSeance(velo('2026-11-08', 'endurance', 150), c);
  assert.deepEqual(codes(r).sort(), ['jour_indisponible', 'seance_trop_longue']);
  for (const e of r.erreurs) assert.ok(e.message.length > 10 && e.message.endsWith('.'));
  assert.equal(r.tssEstime, 125);
});
