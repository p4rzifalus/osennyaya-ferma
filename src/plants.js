// Внешний вид растений по стадиям: 0 семечко, 1 росток, 2 куст, 3 спелое.
// Силуэты простые и крупные, чтобы хорошо читались в пикселях.
import * as THREE from 'three';
import { COLORS } from './config.js';

function mesh(geo, color, x = 0, y = 0, z = 0, glow = false) {
  const material = glow
    ? new THREE.MeshBasicMaterial({ color }) // «светится»: свет и тени на него не действуют
    : new THREE.MeshLambertMaterial({ color });
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const sphere = (r) => new THREE.SphereGeometry(r, 14, 10);
const cylinder = (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 10);

// Бугорок земли
function mound() {
  const m = mesh(sphere(0.2), COLORS.mound, 0, 0.03, 0);
  m.scale.set(1, 0.35, 1);
  return m;
}

// Ботва — один плотный конус
function tuft(radius, height, y = 0) {
  return mesh(new THREE.ConeGeometry(radius, height, 6), COLORS.leaves, 0, y + height / 2, 0);
}

// Широкий плоский лист (у тыквы)
function flatLeaf(radius, y = 0) {
  return mesh(new THREE.ConeGeometry(radius, 0.1, 7), COLORS.leaves, 0, y + 0.05, 0);
}

// Голова подсолнуха: светлый диск с тёмной серединой, повёрнут к зрителю
function sunflowerHead(radius) {
  const head = new THREE.Group();
  const disc = new THREE.Group();
  disc.add(mesh(cylinder(radius, radius, 0.05), COLORS.sunflowerPetals));
  disc.add(mesh(cylinder(radius * 0.45, radius * 0.45, 0.07), COLORS.sunflowerCenter, 0, 0.01, 0));
  disc.rotation.x = Math.PI / 2 - 0.5; // смотрит вперёд и чуть вверх
  head.add(disc);
  head.rotation.y = Math.PI / 4; // к камере
  return head;
}

// Шляпка гриба — полусфера
function mushroomCap(radius, y) {
  const cap = mesh(new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), COLORS.mushroomCap, 0, y, 0, true);
  cap.scale.y = 0.8;
  return cap;
}

const BUILDERS = {
  carrot(stage, g) {
    if (stage === 1) g.add(tuft(0.05, 0.14, 0.04));
    if (stage === 2) g.add(tuft(0.1, 0.26, 0.04));
    if (stage === 3) {
      g.add(mesh(cylinder(0.14, 0.1, 0.16), COLORS.carrot, 0, 0.1, 0)); // макушка морковки
      g.add(tuft(0.08, 0.3, 0.18));
    }
  },

  radish(stage, g) {
    if (stage === 1) g.add(tuft(0.05, 0.12, 0.04));
    if (stage === 2) g.add(tuft(0.08, 0.2, 0.04));
    if (stage === 3) {
      g.add(mesh(sphere(0.15), COLORS.radish, 0, 0.12, 0)); // круглый корнеплод наполовину в земле
      g.add(tuft(0.06, 0.18, 0.24));
    }
  },

  pumpkin(stage, g) {
    if (stage === 1) g.add(tuft(0.06, 0.12, 0.04));
    if (stage === 2) g.add(flatLeaf(0.3, 0.02));
    if (stage === 3) {
      g.add(flatLeaf(0.38, 0));
      const body = mesh(sphere(0.3), COLORS.pumpkin, 0, 0.22, 0);
      body.scale.y = 0.7;
      g.add(body);
      g.add(mesh(cylinder(0.03, 0.04, 0.12), COLORS.stem, 0, 0.47, 0)); // хвостик
    }
  },

  sunflower(stage, g) {
    if (stage === 1) g.add(tuft(0.05, 0.18, 0.04));
    if (stage === 2) {
      g.add(mesh(cylinder(0.03, 0.035, 0.45), COLORS.leaves, 0, 0.26, 0));
      g.add(mesh(sphere(0.07), COLORS.leaves, 0, 0.5, 0)); // бутон
    }
    if (stage === 3) {
      g.add(mesh(cylinder(0.035, 0.04, 0.8), COLORS.leaves, 0, 0.43, 0));
      const head = sunflowerHead(0.24);
      head.position.y = 0.85;
      g.add(head);
    }
  },

  mushroom(stage, g) {
    if (stage === 1) g.add(mushroomCap(0.06, 0.05));
    if (stage === 2) {
      g.add(mesh(cylinder(0.04, 0.05, 0.12), COLORS.mushroomStem, 0, 0.1, 0));
      g.add(mushroomCap(0.12, 0.15));
    }
    if (stage === 3) {
      g.add(mesh(cylinder(0.07, 0.09, 0.24), COLORS.mushroomStem, 0, 0.16, 0));
      g.add(mushroomCap(0.26, 0.27));
    }
  },
};

// Растение на грядке
export function buildPlant(type, stage) {
  const g = new THREE.Group();
  g.add(mound());
  if (stage === 0) g.add(mesh(sphere(0.04), COLORS.seed, 0, 0.1, 0));
  else BUILDERS[type](stage, g);
  return g;
}

// Урожай в лапах крота
export function buildHeld(type) {
  const g = new THREE.Group();
  if (type === 'carrot') {
    const root = mesh(new THREE.ConeGeometry(0.08, 0.36, 10), COLORS.carrot);
    root.rotation.x = Math.PI; // остриём вниз
    g.add(root, tuft(0.06, 0.16, 0.16));
    g.rotation.z = -Math.PI / 2; // лежит поперёк лап
  }
  if (type === 'radish') {
    g.add(mesh(sphere(0.12), COLORS.radish), tuft(0.05, 0.14, 0.1));
  }
  if (type === 'pumpkin') {
    const body = mesh(sphere(0.22), COLORS.pumpkin, 0, 0.04, 0.04);
    body.scale.y = 0.75;
    g.add(body, mesh(cylinder(0.025, 0.03, 0.1), COLORS.stem, 0, 0.22, 0.04));
  }
  if (type === 'sunflower') {
    g.add(mesh(cylinder(0.025, 0.025, 0.3), COLORS.leaves, 0, -0.05, 0));
    const head = sunflowerHead(0.17);
    head.position.y = 0.12;
    head.rotation.y = 0; // смотрит туда же, куда крот
    g.add(head);
  }
  if (type === 'mushroom') {
    g.add(mesh(cylinder(0.05, 0.06, 0.16), COLORS.mushroomStem, 0, -0.02, 0), mushroomCap(0.17, 0.05));
  }
  return g;
}
