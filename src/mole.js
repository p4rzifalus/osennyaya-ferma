// Крот-огородник: собран из простых фигур, ходит сам или по маршруту.
import * as THREE from 'three';
import { buildHeld } from './plants.js';
import { COLORS, CELL_SIZE, MOLE_SPEED, MOLE_TURN_SPEED, MOLE_SCALE, MOLE_REACH } from './config.js';

const RADIUS = 0.3 * MOLE_SCALE; // «толщина» крота для столкновений

function part(geo, color, x, y, z, scale) {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  return m;
}

// Собираем крота. Стоит на двух лапах, смотрит вдоль +z.
function buildMole() {
  const body = new THREE.Group();
  const sphere = (r) => new THREE.SphereGeometry(r, 16, 12);
  const cyl = (r1, r2, h) => new THREE.CylinderGeometry(r1, r2, h, 12);

  // Туловище-груша и штаны на лямках
  body.add(part(sphere(0.24), COLORS.moleBody, 0, 0.44, 0, [1, 1.25, 0.9]));
  body.add(part(cyl(0.235, 0.25, 0.2), COLORS.moleOveralls, 0, 0.3, 0));
  for (const side of [-1, 1]) {
    const strap = part(new THREE.BoxGeometry(0.05, 0.3, 0.03), COLORS.moleOveralls, side * 0.1, 0.5, 0.185);
    strap.rotation.x = -0.3;
    body.add(strap);
  }

  // Голова: мордочка, нос, глазки
  body.add(part(sphere(0.19), COLORS.moleBody, 0, 0.8, 0));
  body.add(part(sphere(0.09), COLORS.moleSnout, 0, 0.76, 0.18, [1, 0.85, 1.4]));
  body.add(part(sphere(0.045), COLORS.moleNose, 0, 0.78, 0.31));
  for (const side of [-1, 1]) body.add(part(sphere(0.025), COLORS.moleEyes, side * 0.08, 0.86, 0.15));

  // Ноги и руки крепятся на «шарнирах», чтобы ими можно было махать при ходьбе
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.1, 0.2, 0);
    leg.add(part(cyl(0.065, 0.06, 0.16), COLORS.moleBody, 0, -0.08, 0));
    leg.add(part(sphere(0.07), COLORS.molePaws, 0, -0.17, 0.04, [1, 0.5, 1.4])); // ступня
    body.add(leg);
    legs.push(leg);

    const arm = new THREE.Group();
    arm.position.set(side * 0.24, 0.56, 0);
    arm.rotation.z = side * 0.25; // руки чуть разведены
    arm.add(part(cyl(0.05, 0.045, 0.2), COLORS.moleBody, 0, -0.1, 0));
    arm.add(part(sphere(0.08), COLORS.molePaws, 0, -0.23, 0.02, [1.1, 0.8, 0.5])); // широкая ладонь-лопатка
    body.add(arm);
    arms.push(arm);
  }

  // Соломенная шляпа, чуть сдвинута на затылок
  const hat = new THREE.Group();
  hat.add(part(cyl(0.3, 0.3, 0.03), COLORS.moleHat, 0, 0, 0));           // поля
  hat.add(part(cyl(0.14, 0.17, 0.16), COLORS.moleHat, 0, 0.1, 0));       // тулья
  hat.add(part(cyl(0.175, 0.175, 0.05), COLORS.moleHatBand, 0, 0.04, 0)); // лента
  hat.position.set(0, 0.95, -0.04);
  hat.rotation.x = -0.2;
  body.add(hat);

  const root = new THREE.Group();
  root.add(body);
  body.scale.setScalar(MOLE_SCALE);
  return { root, body, legs, arms };
}

// Поворот на кратчайший угол
function turnTowards(current, target, maxStep) {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return current + Math.max(-maxStep, Math.min(maxStep, diff));
}

export class Mole {
  constructor() {
    const { root, body, legs, arms } = buildMole();
    this.object = root;
    this.body = body;
    this.legs = legs;
    this.arms = arms;
    this.heading = 0;        // куда смотрит сейчас (угол)
    this.targetHeading = 0;  // куда хочет повернуться
    this.walkTime = 0;
    this.path = [];          // точки маршрута после клика
    this.faceTo = null;      // куда повернуться в конце маршрута
    this.onArrive = null;
    this.held = null;        // что в лапах (например, 'carrot')
    this.heldObject = null;
  }

  // Взять урожай в лапы (или освободить лапы, если type = null)
  setHeld(type) {
    if (this.heldObject) this.body.remove(this.heldObject);
    this.held = type;
    this.heldObject = null;
    if (type) {
      this.heldObject = buildHeld(type);
      this.heldObject.position.set(0, 0.42, 0.34);
      this.body.add(this.heldObject);
    }
  }

  get position() {
    return this.object.position;
  }

  // Точка перед носом — по ней ищем «клетку перед кротом»
  get frontPoint() {
    const d = CELL_SIZE * MOLE_REACH;
    return this.position.clone().add(new THREE.Vector3(Math.sin(this.heading) * d, 0, Math.cos(this.heading) * d));
  }

  walkPath(points, faceTo, onArrive) {
    this.path = points;
    this.faceTo = faceTo;
    this.onArrive = onArrive || null;
  }

  // keyDir — направление с клавиатуры (или нулевой вектор)
  update(dt, keyDir, world) {
    const step = MOLE_SPEED * CELL_SIZE * dt;
    const move = new THREE.Vector3();

    if (keyDir.lengthSq() > 0) {
      this.path = []; // клавиши отменяют маршрут
      this.onArrive = null;
      move.copy(keyDir).normalize().multiplyScalar(step);
    } else if (this.path.length) {
      const toTarget = this.path[0].clone().sub(this.position).setY(0);
      if (toTarget.length() <= step) {
        move.copy(toTarget);
        this.path.shift();
        if (!this.path.length) this.arrive();
      } else {
        move.copy(toTarget).setLength(step);
      }
    }

    const moving = move.lengthSq() > 1e-8;
    if (moving) {
      this.position.add(move);
      this.collide(world);
      this.targetHeading = Math.atan2(move.x, move.z);
    }

    this.heading = turnTowards(this.heading, this.targetHeading, MOLE_TURN_SPEED * dt);
    this.object.rotation.y = this.heading;

    // Шаги: ноги по очереди, руки машут навстречу, тело чуть подпрыгивает
    if (moving) this.walkTime += dt;
    else this.walkTime = 0;
    const swing = moving ? Math.sin(this.walkTime * 12) : 0;
    this.legs[0].rotation.x = swing * 0.6;
    this.legs[1].rotation.x = -swing * 0.6;
    // С урожаем лапы вытянуты вперёд и держат его, без размахивания
    const armBase = this.held ? -1.25 : 0;
    const armSwing = this.held ? 0.08 : 0.5;
    this.arms[0].rotation.x = armBase - swing * armSwing;
    this.arms[1].rotation.x = armBase + swing * armSwing;
    this.body.position.y = Math.abs(swing) * 0.03;
    this.body.rotation.z = swing * 0.04;
  }

  arrive() {
    if (this.faceTo) {
      const d = this.faceTo.clone().sub(this.position);
      this.targetHeading = Math.atan2(d.x, d.z);
    }
    const cb = this.onArrive;
    this.onArrive = null;
    if (cb) cb();
  }

  // Не выходим за дорожку и не залезаем в корзинку
  collide(world) {
    const p = this.position;
    p.x = Math.max(world.bounds.min, Math.min(world.bounds.max, p.x));
    p.z = Math.max(world.bounds.min, Math.min(world.bounds.max, p.z));
    for (const o of world.obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const dist = Math.hypot(dx, dz);
      const minDist = o.r + RADIUS;
      if (dist < minDist && dist > 0) {
        p.x = o.x + (dx / dist) * minDist;
        p.z = o.z + (dz / dist) * minDist;
      }
    }
  }
}
