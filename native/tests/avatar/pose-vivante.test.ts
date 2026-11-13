import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PERIODES, poseVivante } from '../../src/data/avatar/pose-vivante.ts';

const instants = Array.from({ length: 400 }, (_, i) => i * 0.137);

test('le souffle reste entre 0 et 1 et part de poumons vides', () => {
  assert.equal(poseVivante(0).souffle, 0);
  for (const t of instants) {
    const { souffle } = poseVivante(t);
    assert.ok(souffle >= 0 && souffle <= 1);
  }
  assert.ok(Math.abs(poseVivante(PERIODES.souffle / 2).souffle - 1) < 1e-9);
});

test('les mouvements restent petits (moins de 7° par os, bassin à moins de 1,5 cm)', () => {
  for (const t of instants) {
    const pose = poseVivante(t);
    assert.ok(Math.abs(pose.bassinX) <= 0.015);
    for (const axes of Object.values(pose.rotations)) {
      for (const angle of Object.values(axes)) assert.ok(Math.abs(angle) < 0.12, `angle ${angle} à t=${t}`);
    }
  }
});

test('les cuisses compensent le bassin : les pieds restent à peu près sous les hanches', () => {
  for (const t of instants) {
    const { bassinX, rotations } = poseVivante(t);
    const roulis = rotations.Hips.z ?? 0;
    const jambe = rotations.LeftUpLeg.z ?? 0;
    // Angle total de la cuisse dans le repère du modèle : roulis hérité + sa propre rotation.
    const total = roulis + jambe;
    // Le pied (0,89 m sous la hanche) revient en arrière d'autant que le bassin a avancé.
    const piedX = bassinX + Math.sin(total) * 0.89;
    assert.ok(Math.abs(piedX) < 0.001, `pied décalé de ${piedX} m à t=${t}`);
  }
});

test('le dos compense la bascule du bassin : les épaules restent horizontales', () => {
  for (const t of instants) {
    const { rotations } = poseVivante(t);
    const somme = (rotations.Hips.z ?? 0) + (rotations.Spine02.z ?? 0) + (rotations.Spine01.z ?? 0);
    assert.ok(Math.abs(somme) < 1e-12);
  }
});

test('les bras compensent la montée des épaules et bougent l\'un après l\'autre', () => {
  const pose = poseVivante(1.3);
  assert.equal((pose.rotations.LeftShoulder.z ?? 0) + (pose.rotations.LeftArm.z ?? 0), 0);
  assert.equal((pose.rotations.RightShoulder.z ?? 0) + (pose.rotations.RightArm.z ?? 0), 0);
  assert.notEqual(pose.rotations.LeftArm.x, pose.rotations.RightArm.x);
});
