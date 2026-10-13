/* src/features/streams/ride-sequences.js — détection des blocs d'une sortie à partir du
   stream de puissance. Déplacé tel quel depuis streams-section.js (aucun changement de
   comportement). Expose window.detectRideSequences, utilisé par les graphiques de la séance. */

export function bootRideSequences() {

// Detecte les sequences d'une sortie a partir du stream de puissance et renvoie des
// blocs AU MEME FORMAT que les seances structurees (int = %FTP), reutilisables par
// renderWorkoutProfileHTML / renderWorkoutDetailHTML. Heuristique (approximatif).
window.detectRideSequences = function (watts, ftp) {
  try {
    ftp = +ftp || 250;
    if (!watts || !watts.length) return [];
    var raw = []; for (var i = 0; i < watts.length; i++) { var v = watts[i]; raw.push((v == null || isNaN(v)) ? 0 : +v); }
    var n = raw.length; if (n < 180) return [];
    // Lissage ~15 s pour stabiliser la "base" (sinon la puissance bruitee sur-segmente)
    function sm(arr, win) { var m = arr.length, o = new Array(m), s = 0, c = 0; for (var x = 0; x <= win && x < m; x++) { s += arr[x]; c++; } for (var x2 = 0; x2 < m; x2++) { if (x2 > 0 && x2 + win < m) { s += arr[x2 + win]; c++; } if (x2 - win - 1 >= 0) { s -= arr[x2 - win - 1]; c--; } o[x2] = c > 0 ? s / c : 0; } return o; }
    var sw = sm(raw, 2);   // +/-2 s = ~5 s : leger, garde les efforts distincts (pas de moyenne coast+sprint)
    var zoneOf = function (w) { var p = w / ftp * 100; if (p < 55) return 0; if (p < 76) return 1; if (p < 91) return 2; if (p < 106) return 3; if (p < 121) return 4; if (p < 151) return 5; return 6; };
    // Binning 5 s, zone par bin (7 zones)
    var BIN = 5, bins = [];
    for (var s2 = 0; s2 < n; s2 += BIN) { var sum = 0, c2 = 0; for (var k = s2; k < Math.min(n, s2 + BIN); k++) { sum += sw[k]; c2++; } var w = c2 ? sum / c2 : 0; bins.push({ w: w, dur: c2, z: zoneOf(w) }); }
    // Segments = bins consecutifs de MEME zone (jamais de moyenne entre zones differentes)
    var remerge = function (arr) {
      var o = [];
      arr.forEach(function (g) { var L = o[o.length - 1]; if (L && L.z === g.z) { L.dur += g.dur; L._sw += g._sw; } else o.push({ z: g.z, dur: g.dur, _sw: g._sw }); });
      o.forEach(function (s) { s.w = s._sw / Math.max(1, s.dur); s.z = zoneOf(s.w); });
      return o;
    };
    var segs = remerge(bins.map(function (b) { return { z: b.z, dur: b.dur, _sw: b.w * b.dur }; }));
    // Absorption des segments < 10 s (bruit) dans le voisin de PUISSANCE la plus proche
    var guard = 0;
    while (segs.length > 1 && guard++ < 5000) {
      var bi = -1, bd = 1e9;
      for (var q = 0; q < segs.length; q++) { var mn = (segs[q].w / ftp * 100) >= 170 ? 10 : 45; if (segs[q].dur < mn && segs[q].dur < bd) { bd = segs[q].dur; bi = q; } }
      if (bi === -1) break;
      var p0 = segs[bi - 1], n0 = segs[bi + 1];
      var into = (!p0) ? n0 : (!n0 ? p0 : (Math.abs(p0.w - segs[bi].w) <= Math.abs(n0.w - segs[bi].w) ? p0 : n0));
      if (!into) break;
      into.dur += segs[bi].dur; into._sw += segs[bi]._sw; segs.splice(bi, 1); segs = remerge(segs);
    }
    if (!segs.length) return [];
    // Chaque segment = un bloc, a sa vraie duree (pas de regroupement en series).
    var pctFtp = function (w) { return Math.round(w / ftp * 100); };
    var blocks = segs.map(function (g) {
      return { type: 'steady', name: null, _z: g.z, _durS: g.dur, metric: 'power', unit: 'percent', work: { min: Math.round(g.dur / 60 * 100) / 100, int: pctFtp(g.w), metric: 'power' } };
    });
    // Zone d'un bloc a partir de son %FTP (memes seuils que la couleur des barres)
    var zp = function (p) { return zoneOf(ftp * p / 100); };
    // 1) Retire les micro-blocs (< 25 s) AVANT de fusionner
    blocks = blocks.filter(function (bl) { var d = bl._durS || ((+bl.work.min || 0) * 60), mn = (+bl.work.int || 0) >= 170 ? 10 : 45; return d >= mn; });
    // 2) Fusionne les blocs adjacents de MEME zone (duree additive, watts moyennes)
    var mg = [];
    blocks.forEach(function (bl) {
      var L = mg[mg.length - 1];
      if (L && zp(L.work.int) === zp(bl.work.int)) {
        var d1 = +L.work.min || 0, d2 = +bl.work.min || 0, dt = d1 + d2;
        L.work.int = dt ? Math.round((L.work.int * d1 + bl.work.int * d2) / dt) : L.work.int;
        L.work.min = Math.round(dt * 100) / 100;
        L._durS = (L._durS || d1 * 60) + (bl._durS || d2 * 60);
      } else { mg.push(bl); }
    });
    blocks = mg;
    // 3) Nommage deduit
    var ZN = ['Récupération', 'Endurance', 'Tempo', 'Seuil', 'VO2max', 'Anaérobie', 'Sprint'];
    blocks.forEach(function (bl, bi2) {
      var z = zp(bl.work.int), durS = bl._durS || ((+bl.work.min || 0) * 60);
      if (bi2 === 0 && z <= 2) { bl.name = 'Échauffement'; return; }
      if (bi2 === blocks.length - 1 && z <= 2) { bl.name = 'Retour au calme'; return; }
      if (z >= 4 && durS <= 50) { bl.name = 'Sprint'; return; }
      bl.name = ZN[z] || 'Bloc';
    });
    return blocks;
  } catch (e) { console.warn('[detect sequences]', e && e.message); return []; }
};
}
