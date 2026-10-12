import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, sectionParId, champsDe, valeursDepuis, validerSection, versPayload, calculerZones, estimerFtp, estimerLthr, wattsParKg, calculerAge, avatarSur, texteAllure } from '../src/lib/data/profil.js';

const identite = sectionParId('identite');
const physio = sectionParId('physiologie');
const records = sectionParId('records');

test('chaque champ a une clé unique par section et un type connu', () => {
  const types = new Set(['texte', 'nombre', 'date', 'choix', 'case', 'temps', 'paragraphe']);
  const toutes = new Set();
  for (const s of SECTIONS) for (const c of champsDe(s)) {
    assert.ok(types.has(c.type), c.cle);
    assert.ok(!toutes.has(c.cle), `doublon ${c.cle}`);
    toutes.add(c.cle);
  }
});

test('valeursDepuis : colonnes, extras, champs absents vides, extras hérités ignorés', () => {
  const v = valeursDepuis({ display_name: 'Yanis', weight: 71.5, extras: { city: 'Toulouse', sex: 'M' } }, identite);
  assert.equal(v.display_name, 'Yanis');
  assert.equal(v.weight, '71.5');
  assert.equal(v.city, 'Toulouse');
  assert.equal(v.height, '');
  assert.deepEqual(valeursDepuis(null, identite).display_name, '');
  assert.equal(valeursDepuis({ extras: JSON.parse('{"__proto__":{"city":"x"}}') }, identite).city, '');
});

test('validerSection : nom obligatoire, bornes des nombres, date future refusée, choix inconnu refusé', () => {
  const r = validerSection(identite, { display_name: '', weight: '999', height: 'abc', birth_date: '2999-01-01', sex: 'Z' }, '2026-10-12');
  for (const c of ['display_name', 'weight', 'height', 'birth_date', 'sex']) assert.ok(r.erreurs[c], c);
  const ok = validerSection(identite, { display_name: ' Yanis ', weight: '71,5', height: '180', birth_date: '2005-03-02', sex: 'M', bio: '' }, '2026-10-12');
  assert.deepEqual(ok.erreurs, {});
  assert.equal(ok.propres.display_name, 'Yanis');
  assert.equal(ok.propres.weight, 71.5);
  assert.equal(ok.propres.bio, null);
});

test('validerSection : temps au bon format, cases, champs vides = null', () => {
  const bad = validerSection(physio, { pace_5k: '4h30', css: '1:75', ftp: '250' });
  assert.ok(bad.erreurs.pace_5k && bad.erreurs.css);
  const ok = validerSection(physio, { pace_5k: '4:30', css: '1:30', ftp: '250', hr_max: '196' });
  assert.deepEqual(ok.erreurs, {});
  assert.equal(ok.propres.ftp, 250);
  assert.equal(ok.propres.lthr, null);
  assert.equal(validerSection(sectionParId('sports'), { sec_gym: true }).propres.sec_gym, true);
  assert.equal(validerSection(sectionParId('sports'), {}).propres.sec_ski, false);
});

test('versPayload : colonnes séparées des extras, extras des autres sections conservés', () => {
  const { propres } = validerSection(physio, { ftp: '260', hr_max: '196', lthr: '180', rhr: '48' });
  const { colonnes, extras } = versPayload(physio, propres, { city: 'Toulouse', pr_p_5s: 900 });
  assert.deepEqual(Object.keys(colonnes).sort(), ['ftp', 'hr_max', 'lthr']);
  assert.equal(colonnes.ftp, 260);
  assert.equal(extras.rhr, 48);
  assert.equal(extras.city, 'Toulouse'); // autre section : intact
  assert.equal(extras.pr_p_5s, 900);
  assert.ok(!('ftp' in extras));
  const { colonnes: c2 } = versPayload(records, validerSection(records, { pr_p_5s: '1000' }).propres, {});
  assert.deepEqual(c2, {});
});

test('zones : puissance (FTP 250), allure avec min/km, référence absente = null', () => {
  const p = calculerZones('puissance', 250);
  assert.equal(p.length, 7);
  assert.equal(p[3].de, 228); // 91 % de 250 = 227,5
  assert.equal(p[3].a, 263);
  const a = calculerZones('allure', 15);
  assert.equal(a[3].alluresDe, '4:13/km'); // 95 % de 15 km/h = 14,25 km/h = 4:12,6 /km
  assert.equal(calculerZones('cardio', 0), null);
  assert.equal(calculerZones('inconnu', 200), null);
  assert.equal(texteAllure(12), '5:00/km');
});

test('estimations : FTP depuis la courbe, LTHR, W/kg, âge', () => {
  assert.equal(estimerFtp([{ duration_s: 1200, watts_alltime: 300 }, { duration_s: 3600, watts_alltime: 270 }]), 285);
  assert.equal(estimerFtp([{ duration_s: 3600, watts_alltime: 270 }]), 270);
  assert.equal(estimerFtp([]), null);
  assert.equal(estimerLthr(196), 180);
  assert.equal(estimerLthr(null), null);
  assert.equal(wattsParKg(250, '70'), 3.57);
  assert.equal(wattsParKg(0, 70), null);
  assert.equal(calculerAge('2005-10-13', new Date('2026-10-12T12:00:00')), 20);
  assert.equal(calculerAge('2005-10-12', new Date('2026-10-12T12:00:00')), 21);
  assert.equal(calculerAge('n’importe quoi'), null);
});

test('avatarSur : accepte data:image et https, refuse le reste', () => {
  assert.equal(avatarSur('data:image/png;base64,AAAA'), true);
  assert.equal(avatarSur('https://exemple.fr/a.png'), true);
  assert.equal(avatarSur('javascript:alert(1)'), false);
  assert.equal(avatarSur('data:image/svg+xml;base64,AAAA'), false);
  assert.equal(avatarSur('http://exemple.fr/a.png'), false);
});
