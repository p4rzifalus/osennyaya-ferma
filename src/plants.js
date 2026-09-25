// Внешний вид растений по стадиям: 0 семечко, 1 росток, 2 куст, 3 спелое.
import * as THREE from 'three';
import { COLORS } from './config.js';

function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Бугорок земли
function mound() {
  const m = mesh(new THREE.SphereGeometry(0.2, 12, 8), COLORS.mound, 0, 0.03, 0);
  m.scale.set(1, 0.35, 1);
  return m;
}

// Ботва — один плотный конус: простой силуэт, хорошо читается в пикселях
function tuft(radius, height, y = 0) {
  return mesh(new THREE.ConeGeometry(radius, height, 6), COLORS.leaves, 0, y + height / 2, 0);
}

const BUILDERS = {
  carrot(stage) {
    const g = new THREE.Group();
    g.add(mound());
    if (stage === 0) g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), COLORS.seed, 0, 0.1, 0));
    if (stage === 1) g.add(tuft(0.05, 0.14, 0.04));
    if (stage === 2) g.add(tuft(0.1, 0.26, 0.04));
    if (stage === 3) {
      g.add(mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.16, 10), COLORS.carrot, 0, 0.1, 0)); // макушка морковки
      g.add(tuft(0.08, 0.3, 0.18));
    }
    return g;
  },
};

// Растение на грядке
export function buildPlant(type, stage) {
  return BUILDERS[type](stage);
}

// Урожай в лапах крота (лежит поперёк)
export function buildHeld(type) {
  const g = new THREE.Group();
  if (type === 'carrot') {
    const root = mesh(new THREE.ConeGeometry(0.08, 0.36, 10), COLORS.carrot);
    root.rotation.x = Math.PI; // остриём вниз
    g.add(root);
    g.add(tuft(0.06, 0.16, 0.16));
  }
  g.rotation.z = -Math.PI / 2;
  return g;
}
