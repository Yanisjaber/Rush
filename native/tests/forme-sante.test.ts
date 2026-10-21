import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accordAvecRessenti, CONFIANCE_MINI, enAlerte, estPilier, piliersDispo, type CleComposante, indiceCharge, indiceContreReference, indiceDepuisEcart, indiceRessenti, indiceTemperature, indicateurs, lecture, niveauDe, phi, POIDS_FORME, precisionDe, serieEtatDeForme } from '../src/data/forme-sante.ts';
import type { Metrique, Nuit } from '../src/data/types.ts';

const proche = (a: number, b: number, eps = 0.002) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

function nuit(i: number, plus: Partial<Nuit> = {}): Nuit {
  const d = new Date(2026, 0, 1 + i);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    date, bedtime: null, wake_time: null, total_sec: 7.5 * 3600, deep_sec: 5400, light_sec: 15000, rem_sec: 6000, awake_sec: 600, awake_count: 2, restless_count: null,
    avg_stress: 30, avg_heart_rate: 55, resting_heart_rate: 50, body_battery_change: null, hrv_avg: 60, hrv_status: null, resp_avg: null, resp_min: null, resp_max: null,
    spo2_avg: null, score: null, score_qualifier: null, segments: null, ...plus,
  };
}
const nuits = (n: number, f: (i: number) => Partial<Nuit> = () => ({})) => Array.from({ length: n }, (_, i) => nuit(i, f(i)));
const metrique = (date: string, tsb: number): Metrique => ({ iso_date: date, tss: 0, ctl: 50, atl: 50 - tsb, tsb, duration_min: 0, activity_count: 0 });

test('phi : la loi normale (valeurs de référence)', () => {
  proche(phi(0), 0.5, 1e-6);
  proche(phi(1.96), 0.975, 1e-3);
  proche(phi(-1), 0.1587, 1e-3);
  proche(phi(1) + phi(-1), 1, 1e-6);
});

test('indiceDepuisEcart : 50 comme d\'habitude, plus haut = mieux, borné à ±2,5 écarts-types', () => {
  assert.equal(indiceDepuisEcart(0), 50);
  assert.equal(indiceDepuisEcart(1), 84);
  assert.equal(indiceDepuisEcart(-1), 16);
  assert.equal(indiceDepuisEcart(10), indiceDepuisEcart(2.5));
  assert.equal(indiceDepuisEcart(-10), indiceDepuisEcart(-2.5));
});

test('indiceContreReference : pas de référence suffisante = null ; le sens et le plancher d\'écart-type', () => {
  assert.equal(indiceContreReference(60, [60, 61, 59], 1, 1), null); // moins de 10 valeurs
  const ref = Array.from({ length: 20 }, () => 60); // référence constante : écart-type nul, c'est le plancher qui s'applique
  assert.equal(indiceContreReference(60, ref, 1, 2), 50);
  assert.equal(indiceContreReference(62, ref, 1, 2), 84); // +1 écart-type (plancher 2)
  assert.equal(indiceContreReference(62, ref, -1, 2), 16); // même écart, mais « plus haut = moins bien » (FC, stress)
});

test('indiceCharge : la fraîcheur de Banister ramenée entre 0 et 100', () => {
  assert.equal(indiceCharge(0), 50);
  assert.equal(indiceCharge(20), 80);
  assert.equal(indiceCharge(-20), 20);
  assert.equal(indiceCharge(-100), 0);
  assert.equal(indiceCharge(100), 100);
});

test('les poids des piliers font 1 ; stress, respiration et température sont des alertes (poids 0)', () => {
  proche(Object.values(POIDS_FORME).reduce((a, b) => a + b, 0), 1, 1e-9);
  assert.deepEqual((Object.keys(POIDS_FORME) as CleComposante[]).filter(estPilier).sort(), ['charge', 'fc', 'hrv', 'ressenti', 'sommeil']);
  for (const cle of ['stress', 'resp', 'temperature'] as const) assert.equal(POIDS_FORME[cle], 0);
});

test('enAlerte : seulement pour stress, respiration et température, sous leur seuil', () => {
  assert.equal(enAlerte('stress', 20), true);
  assert.equal(enAlerte('stress', 21), false);
  assert.equal(enAlerte('resp', 5), true);
  assert.equal(enAlerte('temperature', 50), true); // 0,75 °C d'écart
  assert.equal(enAlerte('temperature', 51), false);
  assert.equal(enAlerte('hrv', 0), false); // un pilier n'est jamais une alerte
  assert.equal(enAlerte('stress', null), false);
});

test('serieEtatDeForme : une nuit comme les précédentes est « comme d\'habitude » (indice des piliers à 50)', () => {
  const serie = serieEtatDeForme(nuits(40), [metrique('2026-02-09', 0)]);
  const dernier = serie[serie.length - 1];
  const par = (cle: string) => dernier.composantes.find((c) => c.cle === cle)?.indice;
  assert.equal(par('hrv'), 50);
  assert.equal(par('fc'), 50);
  assert.equal(par('stress'), 50);
  assert.equal(par('charge'), 50);
  assert.ok((par('sommeil') ?? 0) > 60); // 7 h 30 bien dormies : le score absolu est bon
  assert.ok(dernier.indice != null && dernier.indice >= 50 && dernier.indice <= 70);
  assert.equal(dernier.confiance, 0.82); // HRV, sommeil, FC et charge : 82 % du poids total (le stress de nuit n'a pas de poids)
  assert.equal(dernier.precision, 'bonne');
  assert.deepEqual(dernier.manquants.map((m) => m.cle), ['ressenti']); // seuls les piliers manquent : la respiration et la température ne sont pas des piliers
  assert.deepEqual(dernier.alertes, []); // une nuit comme d'habitude ne déclenche rien
});

test('serieEtatDeForme : la référence ne contient jamais le futur, et les premières nuits n\'ont pas de HRV comparée', () => {
  const serie = serieEtatDeForme(nuits(40), []);
  assert.equal(serie[0].composantes.find((c) => c.cle === 'hrv')?.indice, null); // aucune nuit avant
  assert.equal(serie[8].composantes.find((c) => c.cle === 'hrv')?.indice, null); // 8 nuits avant : sous le minimum de 10
  assert.notEqual(serie[12].composantes.find((c) => c.cle === 'hrv')?.indice, null);
});

test('serieEtatDeForme : une HRV plus haute et une FC plus basse font monter l\'indice, l\'inverse le fait descendre', () => {
  const base = serieEtatDeForme(nuits(40), []);
  const mieux = serieEtatDeForme(nuits(40, (i) => (i >= 37 ? { hrv_avg: 80, resting_heart_rate: 46 } : {})), []);
  const moins = serieEtatDeForme(nuits(40, (i) => (i >= 37 ? { hrv_avg: 42, resting_heart_rate: 56 } : {})), []);
  const fin = (s: ReturnType<typeof serieEtatDeForme>) => s[s.length - 1].indice as number;
  assert.ok(fin(mieux) > fin(base), `${fin(mieux)} > ${fin(base)}`);
  assert.ok(fin(moins) < fin(base), `${fin(moins)} < ${fin(base)}`);
});

test('serieEtatDeForme : trop de données manquantes = pas d\'indice ; les poids disponibles sont renormalisés', () => {
  // Rien d'autre que le sommeil (poids 0,24 < 0,55) : pas d'indice
  const seul = serieEtatDeForme(nuits(40, () => ({ hrv_avg: null, resting_heart_rate: null, avg_stress: null })), []);
  assert.equal(seul[39].indice, null);
  assert.ok(seul[39].confiance < CONFIANCE_MINI);
  // Sans la charge (poids 0,10), le reste est renormalisé : l'indice existe quand même
  const sansCharge = serieEtatDeForme(nuits(40), []);
  assert.equal(sansCharge[39].confiance, 0.72); // HRV, sommeil, FC
  assert.equal(sansCharge[39].precision, 'basique');
  assert.notEqual(sansCharge[39].indice, null);
  assert.deepEqual(serieEtatDeForme(null, null), []);
});

test('niveauDe, lecture et indicateurs : seuils 65 et 40, point faible sous 45', () => {
  assert.equal(niveauDe(65), 'bon');
  assert.equal(niveauDe(64), 'moyen');
  assert.equal(niveauDe(40), 'moyen');
  assert.equal(niveauDe(39), 'faible');
  assert.equal(niveauDe(null), null);
  const point = serieEtatDeForme(nuits(40, (i) => (i >= 37 ? { hrv_avg: 40, resting_heart_rate: 58 } : {})), [metrique('2026-02-09', 0)])[39];
  const l = lecture(point);
  assert.ok(l && l.niveau !== 'bon');
  assert.ok(l?.pointFaible && l.pointFaible.indice != null && l.pointFaible.indice < 45);
  assert.equal(lecture({ date: '2026-01-01', indice: null, confiance: 0, composantes: [] }), null);
  const ind = indicateurs(point);
  assert.deepEqual(ind.map((i) => i.cle), ['sommeil', 'recuperation', 'forme']);
  assert.equal(ind[2].indice, 50);
});

test('indiceRessenti : les cinq réponses du matin, de 0 à 100, au moins deux réponses', () => {
  assert.equal(indiceRessenti(undefined), null);
  assert.equal(indiceRessenti({ ressenti_fatigue: 1 }), null); // une seule réponse ne suffit pas
  // Tout au mieux : fatigue 1, courbatures 1, humeur 5, motivation 5, stress 1
  assert.equal(indiceRessenti({ ressenti_fatigue: 1, ressenti_courbatures: 1, ressenti_humeur: 5, ressenti_motivation: 5, ressenti_stress: 1 }), 100);
  // Tout au pire
  assert.equal(indiceRessenti({ ressenti_fatigue: 5, ressenti_courbatures: 5, ressenti_humeur: 1, ressenti_motivation: 1, ressenti_stress: 5 }), 0);
  // Tout au milieu : 50, et deux réponses suffisent
  assert.equal(indiceRessenti({ ressenti_fatigue: 3, ressenti_humeur: 3 }), 50);
});

test('indiceTemperature : 100 sans écart, 0 à 1,5 °C d\'écart (dans les deux sens)', () => {
  assert.equal(indiceTemperature(0), 100);
  assert.equal(indiceTemperature(0.75), 50);
  assert.equal(indiceTemperature(1.5), 0);
  assert.equal(indiceTemperature(-1.5), 0);
  assert.equal(indiceTemperature(4), 0);
});

test('precisionDe : 55 % basique, 75 % bonne, 90 % élevée, en dessous rien', () => {
  assert.equal(precisionDe(0.5), null);
  assert.equal(precisionDe(CONFIANCE_MINI), 'basique');
  assert.equal(precisionDe(0.75), 'bonne');
  assert.equal(precisionDe(0.9), 'elevee');
});

test('serieEtatDeForme avec des mesures : le ressenti et les appareils s\'ajoutent, la précision monte', () => {
  const date = nuit(39).date;
  const base = serieEtatDeForme(nuits(40), [metrique(date, 0)])[39];
  const avec = serieEtatDeForme(nuits(40), [metrique(date, 0)], {
    [date]: { ressenti_fatigue: 1, ressenti_courbatures: 1, ressenti_humeur: 5, ressenti_motivation: 5, ressenti_stress: 1, temp_cutanee_ecart: 0 },
  })[39];
  assert.equal(avec.composantes.find((c) => c.cle === 'ressenti')?.indice, 100);
  assert.equal(avec.composantes.find((c) => c.cle === 'temperature')?.indice, 100);
  assert.equal(avec.confiance, 1); // 0,82 + ressenti 0,18 : la température n'ajoute rien (alerte)
  assert.equal(avec.precision, 'elevee');
  assert.ok((avec.indice as number) > (base.indice as number)); // un ressenti excellent tire l'indice vers le haut
  assert.deepEqual(avec.manquants, []);
});

test('une alerte (température très hors de ta normale) se signale sans changer le chiffre', () => {
  const date = nuit(39).date;
  const calme = serieEtatDeForme(nuits(40), [metrique(date, 0)], { [date]: { temp_cutanee_ecart: 0 } })[39];
  const fievre = serieEtatDeForme(nuits(40), [metrique(date, 0)], { [date]: { temp_cutanee_ecart: 1.2 } })[39];
  assert.deepEqual(calme.alertes, []);
  assert.deepEqual(fievre.alertes.map((a) => a.cle), ['temperature']);
  assert.equal(fievre.indice, calme.indice); // l'alerte ne bouge pas l'état de forme
  assert.equal(fievre.confiance, calme.confiance);
});

test('piliersDispo : compte les piliers qui ont une donnée, sur cinq (les alertes ne comptent pas)', () => {
  const date = nuit(39).date;
  const p = serieEtatDeForme(nuits(40), [metrique(date, 0)], { [date]: { temp_cutanee_ecart: 0 } })[39];
  assert.deepEqual(piliersDispo(p), { pris: 4, total: 5 }); // HRV, sommeil, FC, charge
  assert.deepEqual(piliersDispo(null), { pris: 0, total: 5 });
});

test('freins : malade plafonne à 35, blessé à 50, le plus bas gagne ; l\'alcool et le voyage sont du contexte', () => {
  const date = nuit(39).date;
  const sain = serieEtatDeForme(nuits(40), [metrique(date, 0)])[39];
  assert.ok((sain.indice as number) > 35);
  const malade = serieEtatDeForme(nuits(40), [metrique(date, 0)], { [date]: { evt_malade: 1 } })[39];
  assert.equal(malade.indice, 35);
  assert.equal(malade.freins.length, 1);
  const blesse = serieEtatDeForme(nuits(40), [metrique(date, 0)], { [date]: { evt_blesse: 1 } })[39];
  assert.equal(blesse.indice, Math.min(sain.indice as number, 50));
  const deux = serieEtatDeForme(nuits(40), [metrique(date, 0)], { [date]: { evt_malade: 1, evt_blesse: 1 } })[39];
  assert.equal(deux.indice, 35);
  assert.equal(deux.freins.length, 2);
  const contexte = serieEtatDeForme(nuits(40), [metrique(date, 0)], { [date]: { alcool_verres: 3, evt_voyage: 1 } })[39];
  assert.equal(contexte.indice, sain.indice); // aucun effet numérique
  assert.equal(contexte.contexte.length, 2);
  assert.deepEqual(sain.freins, []);
});

test('un jour avec seulement une saisie (sans nuit) existe dans la série, sans indice si les données ne suffisent pas', () => {
  const serie = serieEtatDeForme([], [], { '2026-03-01': { ressenti_fatigue: 2, ressenti_humeur: 4 } });
  assert.equal(serie.length, 1);
  assert.equal(serie[0].indice, null);
  assert.equal(serie[0].precision, null);
  assert.equal(serie[0].composantes.find((c) => c.cle === 'ressenti')?.indice, 75);
  // malade sans assez de données : pas d'indice à plafonner, mais le frein est signalé
  assert.equal(serieEtatDeForme([], [], { '2026-03-01': { evt_malade: 1 } })[0].freins.length, 1);
});

test('lecture : un mot court par niveau pour les écrans sans phrase', () => {
  const point = (indice: number) => ({ date: '2026-01-01', indice, confiance: 1, precision: 'elevee' as const, composantes: [], freins: [], contexte: [], manquants: [], alertes: [] });
  assert.equal(lecture(point(80))?.mot, 'Récupéré');
  assert.equal(lecture(point(50))?.mot, 'Moyen');
  assert.equal(lecture(point(20))?.mot, 'À ménager');
});

test('accordAvecRessenti : trop peu de jours = pas de verdict ; un ressenti qui suit l\'état de forme = accord fort, un ressenti sans rapport = faible', () => {
  const n = nuits(60, (i) => ({ hrv_avg: 60 + ((i * 7) % 20) - 10, resting_heart_rate: 50 + ((i * 5) % 8) - 4 }));
  // Peu de jours de ressenti : pas de verdict
  const peu = accordAvecRessenti(n, [], { [nuit(50).date]: { ressenti_fatigue: 2, ressenti_humeur: 4 } });
  assert.equal(peu.r, null);
  assert.equal(peu.accord, null);
  assert.equal(peu.jours, 1);

  // Un ressenti construit pour suivre l'état de forme calculé SANS ressenti : accord fort
  const objectif = serieEtatDeForme(n, [], {});
  const suit: Record<string, Record<string, number>> = {};
  for (const pt of objectif) {
    if (pt.indice == null) continue;
    // indice 0-100 -> fatigue 5..1 et humeur 1..5 : la meilleure forme donne le meilleur ressenti
    const note = Math.min(5, Math.max(1, Math.round(1 + (pt.indice / 100) * 4)));
    suit[pt.date] = { ressenti_fatigue: 6 - note, ressenti_humeur: note };
  }
  const fort = accordAvecRessenti(n, [], suit);
  assert.ok(fort.jours >= 14);
  assert.ok(fort.r != null && fort.r >= 0.5, String(fort.r));
  assert.equal(fort.accord, 'fort');

  // Un ressenti qui va à l'envers de l'état de forme : accord faible (corrélation négative)
  const contre: Record<string, Record<string, number>> = {};
  for (const [d, m] of Object.entries(suit)) contre[d] = { ressenti_fatigue: m.ressenti_humeur, ressenti_humeur: 6 - m.ressenti_humeur };
  const faible = accordAvecRessenti(n, [], contre);
  assert.ok(faible.r != null && faible.r < 0);
  assert.equal(faible.accord, 'faible');

  // Un ressenti constant : pas de corrélation possible
  const constant = Object.fromEntries(Object.keys(suit).map((d) => [d, { ressenti_fatigue: 3, ressenti_humeur: 3 }]));
  assert.equal(accordAvecRessenti(n, [], constant).r, null);
  assert.deepEqual(accordAvecRessenti(null, null, null), { jours: 0, r: null, accord: null });
});
