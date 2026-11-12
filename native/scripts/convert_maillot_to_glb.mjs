// Convertit le maillot exporté de 3ds Max (JSON three.js « formatVersion 3 », unités en cm, z vers le haut)
// en .glb (mètres, y vers le haut) : géométrie seule, les textures sont chargées à part par l'app.
//   node scripts/convert_maillot_to_glb.mjs <maillot.js> <maillot.glb>
import { readFileSync, writeFileSync } from 'node:fs';

const [entree, sortie] = process.argv.slice(2);
if (!entree || !sortie) {
  console.error('Usage : node scripts/convert_maillot_to_glb.mjs <maillot.js> <maillot.glb>');
  process.exit(1);
}

const src = JSON.parse(readFileSync(entree, 'utf8'));
const v = src.vertices;
const uvs = src.uvs[0];
const faces = src.faces;

// Faces : uniquement des triangles « type 10 » = matériau + UV par sommet : [10, a, b, c, matériau, ua, ub, uc]
const triangles = [];
for (let i = 0; i < faces.length; i += 8) {
  if (faces[i] !== 10) throw new Error(`Type de face inattendu (${faces[i]}) : le convertisseur ne gère que le type 10.`);
  triangles.push([[faces[i + 1], faces[i + 5]], [faces[i + 2], faces[i + 6]], [faces[i + 3], faces[i + 7]]]);
}

// Un sommet glTF = un couple (position, UV) : on les déduplique.
const index = new Map();
const positions = [];
const uvSortie = [];
const posDeSommet = [];
const indices = [];
for (const tri of triangles) {
  for (const [p, t] of tri) {
    const cle = `${p}/${t}`;
    let n = index.get(cle);
    if (n === undefined) {
      n = posDeSommet.length;
      index.set(cle, n);
      posDeSommet.push(p);
      // 3ds Max (x, y, z : z en haut, cm) -> three.js (x, z, -y : y en haut, m)
      positions.push(v[p * 3] * 0.01, v[p * 3 + 2] * 0.01, -v[p * 3 + 1] * 0.01);
      // v inversé : convention glTF (origine en haut à gauche)
      uvSortie.push(uvs[t * 2], 1 - uvs[t * 2 + 1]);
    }
    indices.push(n);
  }
}
if (posDeSommet.length > 65535) throw new Error('Trop de sommets pour des indices 16 bits.');

// Normales lissées par position d'origine (les coutures d'UV ne créent pas d'arête visible).
const normalesParPos = new Float32Array((v.length / 3) * 3);
const point = (n) => [positions[n * 3], positions[n * 3 + 1], positions[n * 3 + 2]];
for (let t = 0; t < indices.length; t += 3) {
  const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
  const pa = point(a), pb = point(b), pc = point(c);
  const e1 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
  const e2 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  for (const s of [a, b, c]) {
    const p = posDeSommet[s];
    normalesParPos[p * 3] += nx;
    normalesParPos[p * 3 + 1] += ny;
    normalesParPos[p * 3 + 2] += nz;
  }
}
const normales = new Float32Array(posDeSommet.length * 3);
posDeSommet.forEach((p, s) => {
  const x = normalesParPos[p * 3], y = normalesParPos[p * 3 + 1], z = normalesParPos[p * 3 + 2];
  const l = Math.hypot(x, y, z) || 1;
  normales[s * 3] = x / l; normales[s * 3 + 1] = y / l; normales[s * 3 + 2] = z / l;
});

const pos = new Float32Array(positions);
const uv = new Float32Array(uvSortie);
const idx = new Uint16Array(indices);
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }

// Binaire : positions | normales | uv | indices (chaque bloc aligné sur 4 octets)
const blocs = [pos, normales, uv, idx].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
const pad4 = (n) => (4 - (n % 4)) % 4;
let offset = 0;
const vues = blocs.map((b) => { const vue = { byteOffset: offset, byteLength: b.length }; offset += b.length + pad4(b.length); return vue; });
const bin = Buffer.concat(blocs.flatMap((b) => [b, Buffer.alloc(pad4(b.length))]));

const json = {
  asset: { version: '2.0', generator: 'convert_maillot_to_glb.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'Maillot' }],
  meshes: [{ name: 'Maillot', primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0, mode: 4 }] }],
  materials: [{ name: 'Maillot', pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 0.8 }, doubleSided: true }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max },
    { bufferView: 1, componentType: 5126, count: normales.length / 3, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: uv.length / 2, type: 'VEC2' },
    { bufferView: 3, componentType: 5123, count: idx.length, type: 'SCALAR' },
  ],
  bufferViews: vues.map((vue, i) => ({ buffer: 0, ...vue, target: i === 3 ? 34963 : 34962 })),
  buffers: [{ byteLength: bin.length }],
};
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length), 0x20)]);
const entete = Buffer.alloc(12);
entete.write('glTF', 0, 'ascii');
entete.writeUInt32LE(2, 4);
entete.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
const enteteJson = Buffer.alloc(8); enteteJson.writeUInt32LE(jsonBuf.length, 0); enteteJson.write('JSON', 4, 'ascii');
const enteteBin = Buffer.alloc(8); enteteBin.writeUInt32LE(bin.length, 0); enteteBin.write('BIN\0', 4, 'latin1');
writeFileSync(sortie, Buffer.concat([entete, enteteJson, jsonBuf, enteteBin, bin]));
console.log(`OK : ${pos.length / 3} sommets, ${idx.length / 3} triangles, boîte`, min.map((x) => +x.toFixed(3)), max.map((x) => +x.toFixed(3)));
