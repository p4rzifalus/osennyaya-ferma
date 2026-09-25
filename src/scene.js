// Сцена: камера, свет, земля, огород, домик, корзинка, подсветки клеток.
import * as THREE from 'three';
import { COLORS, GARDEN_SIZE, CELL_SIZE, BASKET_CELL, MIN_CELL_PX } from './config.js';
import { cellToWorld } from './grid.js';
import { createIsland } from './island.js';

const isTouch = window.matchMedia('(pointer: coarse)').matches;
const TOOLBAR_SPACE = 160; // сколько точек снизу занимают панель инструментов и ряд семян

const mat = (color) => new THREE.MeshLambertMaterial({ color });

// Кубик с тенями, поставленный на пол (y — высота низа)
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);

  // Изометрическая камера: смотрит по диагонали сверху, без перспективы
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);

  // Свет: мягкий общий + солнце с тенями
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-4, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 30 });
  scene.add(sun);

  // Размеры: огород + дорожка вокруг в одну клетку
  const half = (GARDEN_SIZE / 2 + 1) * CELL_SIZE;   // край дорожки
  const houseZ = -half - 1.5 * CELL_SIZE;            // домик за дорожкой

  // Остров: ровная середина под огородом, дорожкой и домиком, вокруг — неровные края
  const islandMinZ = houseZ - 1.5 * CELL_SIZE;
  const core = { minX: -half - 0.3, maxX: half + 0.3, minZ: islandMinZ, maxZ: half + 0.3 };
  const island = createIsland(scene, core);

  const houseX = 0.5;
  scene.add(createHouse(houseX, houseZ));
  const basketPos = cellToWorld(BASKET_CELL.x, BASKET_CELL.z);
  const basket = createBasket(basketPos.x, basketPos.z);
  scene.add(basket);

  // Где крот может ходить и во что упирается
  const world = {
    bounds: { min: -half + 0.25, max: half - 0.25 },
    obstacles: [{ x: basketPos.x, z: basketPos.z, r: 0.45 }],
  };

  // Камера: вся сцена целиком, если помещается. На узком экране — ближе
  // (клетка не меньше пальца), и тогда сцену можно двигать драгом.
  const sceneBox = new THREE.Box3(
    new THREE.Vector3(core.minX - 1, -0.6, core.minZ - 1),
    new THREE.Vector3(core.maxX + 1, 3.3, core.maxZ + 1),
  );
  camera.updateMatrixWorld();
  // Границы сцены в координатах экрана камеры (камера не вращается, считаем один раз)
  const sceneRect = new THREE.Box3();
  for (const x of [sceneBox.min.x, sceneBox.max.x])
    for (const y of [sceneBox.min.y, sceneBox.max.y])
      for (const z of [sceneBox.min.z, sceneBox.max.z])
        sceneRect.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  sceneRect.expandByScalar(0.4); // поля
  const CELL_WIDTH_IN_VIEW = CELL_SIZE * Math.SQRT2; // ширина ромбика клетки

  const view = { scale: 1, center: sceneRect.getCenter(new THREE.Vector3()) }; // scale — точек экрана на единицу сцены

  // Держим видимую область в пределах сцены
  function clampCenter() {
    const halfW = window.innerWidth / 2 / view.scale;
    const halfH = freeHeight() / 2 / view.scale;
    const clampAxis = (value, min, max, half) => (max - min <= half * 2 ? (min + max) / 2 : Math.min(max - half, Math.max(min + half, value)));
    view.center.x = clampAxis(view.center.x, sceneRect.min.x, sceneRect.max.x, halfW);
    view.center.y = clampAxis(view.center.y, sceneRect.min.y, sceneRect.max.y, halfH);
  }

  // Высота экрана над панелью инструментов
  const freeHeight = () => Math.max(window.innerHeight - TOOLBAR_SPACE, window.innerHeight * 0.5);

  function applyView() {
    clampCenter();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const halfW = w / 2 / view.scale;
    const top = view.center.y + freeHeight() / 2 / view.scale;
    Object.assign(camera, {
      left: view.center.x - halfW, right: view.center.x + halfW,
      top, bottom: top - h / view.scale,
    });
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = window.innerWidth;
    renderer.setSize(w, window.innerHeight);
    const size = sceneRect.getSize(new THREE.Vector3());
    const fitScale = Math.min(w / size.x, freeHeight() / size.y);
    // Приближаем только на сенсорных экранах: мышью и в мелкую клетку попасть легко
    view.scale = isTouch ? Math.max(fitScale, MIN_CELL_PX / CELL_WIDTH_IN_VIEW) : fitScale;
    applyView();
  }
  resize();
  window.addEventListener('resize', resize);

  const cameraControl = {
    // Сдвинуть сцену вслед за пальцем (в точках экрана)
    panBy(dxPx, dyPx) {
      view.center.x -= dxPx / view.scale;
      view.center.y += dyPx / view.scale;
      applyView();
    },
    // Поставить точку сцены в центр экрана
    centerOn(worldPos) {
      const p = worldPos.clone().applyMatrix4(camera.matrixWorldInverse);
      view.center.set(p.x, p.y, 0);
      applyView();
    },
  };

  // Места для мелких деталей: дым из трубы, флюгер на коньке крыши, края острова
  const landmarks = {
    chimneyTop: new THREE.Vector3(houseX + 0.8, 2.55, houseZ - 0.3),
    roofPeak: new THREE.Vector3(houseX, 2.6, houseZ + 1.0),
    island: core,
    house: { minX: houseX - 1.8, maxX: houseX + 2.4, minZ: houseZ - 1.3, maxZ: houseZ + 1.4 },
  };

  return { renderer, scene, camera, cameraControl, world, basket, landmarks, island };
}

function createHouse(x, z) {
  const house = new THREE.Group();
  const w = 3 * CELL_SIZE, d = 2 * CELL_SIZE, h = 1.5;
  house.add(box(w, h, d, COLORS.houseWalls));

  // Крыша-треугольник, фронтон смотрит на огород
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.2, 0);
  shape.lineTo(w / 2 + 0.2, 0);
  shape.lineTo(0, 1.1);
  shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.3, bevelEnabled: false });
  roofGeo.translate(0, h, -(d + 0.3) / 2);
  const roof = new THREE.Mesh(roofGeo, mat(COLORS.houseRoof));
  roof.castShadow = true;
  house.add(roof);

  const front = d / 2;

  // Брёвна-стойки по углам и балка под крышей
  for (const [cx, cz] of [[-w / 2, front], [w / 2, front], [w / 2, -front], [-w / 2, -front]]) {
    house.add(box(0.12, h, 0.12, COLORS.houseTrim, cx, 0, cz));
  }
  house.add(box(w + 0.1, 0.1, 0.1, COLORS.houseTrim, 0, h - 0.1, front + 0.02));
  house.add(box(0.1, 0.1, d + 0.1, COLORS.houseTrim, w / 2 + 0.02, h - 0.1, 0));

  // Дверь: наличник, ручка, ступенька и козырёк
  house.add(box(0.74, 1.04, 0.05, COLORS.houseTrim, -0.5, 0, front));
  house.add(box(0.6, 0.95, 0.06, COLORS.houseDoor, -0.5, 0, front + 0.01));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(COLORS.houseAccent));
  knob.position.set(-0.32, 0.48, front + 0.06);
  house.add(knob);
  house.add(box(0.9, 0.08, 0.32, COLORS.houseStep, -0.5, 0, front + 0.16));
  const awning = box(0.95, 0.06, 0.38, COLORS.houseRoof, -0.5, 1.08, front + 0.17);
  awning.rotation.x = 0.3;
  house.add(awning);

  // Фонарик у двери — светится
  house.add(box(0.04, 0.2, 0.12, COLORS.houseTrim, -0.98, 0.95, front + 0.06));
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.12), new THREE.MeshBasicMaterial({ color: COLORS.lamp }));
  lamp.position.set(-0.98, 0.95, front + 0.16);
  house.add(lamp);

  // Окно спереди: рама, переплёт крестом, ставни, ящик с цветами
  const windowWithFrame = (px, py, pz, alongX) => {
    const [fw, fd] = alongX ? [0.62, 0.05] : [0.05, 0.62];
    house.add(box(fw, 0.57, fd, COLORS.houseTrim, px, py - 0.06, pz));
    const [gw, gd] = alongX ? [0.5, 0.06] : [0.06, 0.5];
    house.add(box(gw, 0.45, gd, COLORS.houseWindow, px + (alongX ? 0 : 0.01), py, pz + (alongX ? 0.01 : 0)));
    const [bw, bd] = alongX ? [0.04, 0.07] : [0.07, 0.04];
    house.add(box(bw, 0.45, bd, COLORS.houseTrim, px + (alongX ? 0 : 0.02), py, pz + (alongX ? 0.02 : 0)));
    const [hw, hd] = alongX ? [0.5, 0.07] : [0.07, 0.5];
    house.add(box(hw, 0.04, hd, COLORS.houseTrim, px + (alongX ? 0 : 0.02), py + 0.2, pz + (alongX ? 0.02 : 0)));
  };
  windowWithFrame(0.7, 0.55, front, true);
  house.add(box(0.18, 0.5, 0.05, COLORS.houseShutters, 0.3, 0.52, front + 0.02));
  house.add(box(0.18, 0.5, 0.05, COLORS.houseShutters, 1.1, 0.52, front + 0.02));
  house.add(box(0.62, 0.12, 0.16, COLORS.houseTrim, 0.7, 0.4, front + 0.08));
  for (const [fx, color] of [[0.5, COLORS.flower], [0.7, COLORS.flowerCenter], [0.9, COLORS.flower]]) {
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(color));
    bloom.position.set(fx, 0.57, front + 0.09);
    house.add(bloom);
  }

  // Окно сбоку
  windowWithFrame(w / 2, 0.6, 0.1, false);

  // Круглое окошко на фронтоне
  const attic = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12), new THREE.MeshBasicMaterial({ color: COLORS.lamp }));
  attic.rotation.x = Math.PI / 2;
  attic.position.set(0, h + 0.42, (d + 0.3) / 2);
  house.add(attic);
  const atticRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), mat(COLORS.houseTrim));
  atticRim.position.set(0, h + 0.42, (d + 0.3) / 2 + 0.03);
  house.add(atticRim);

  // Конёк крыши и труба с шапкой
  house.add(box(0.14, 0.12, d + 0.4, COLORS.houseTrim, 0, h + 1.04, 0));
  house.add(box(0.3, 0.7, 0.3, COLORS.houseRoof, 0.8, h + 0.35, -0.3));
  house.add(box(0.4, 0.08, 0.4, COLORS.houseTrim, 0.8, h + 1.03, -0.3));

  // Сбоку: бочка и поленница
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.5, 12), mat(COLORS.barrel));
  barrel.position.set(w / 2 + 0.35, 0.25, 0.65);
  barrel.castShadow = true;
  house.add(barrel);
  for (const hy of [0.1, 0.4]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.02, 4, 16), mat(COLORS.houseTrim));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(w / 2 + 0.35, hy, 0.65);
    house.add(hoop);
  }
  for (const [ly, lz] of [[0.09, -0.3], [0.09, -0.12], [0.09, 0.06], [0.25, -0.21], [0.25, -0.03], [0.41, -0.12]]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 8), mat(COLORS.logs));
    log.rotation.z = Math.PI / 2;
    log.position.set(w / 2 + 0.35, ly, lz - 0.2);
    log.castShadow = true;
    house.add(log);
  }

  house.position.set(x, 0, z);
  return house;
}

function createBasket(x, z) {
  const basket = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.4, 14), mat(COLORS.basket));
  body.position.y = 0.2;
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.34, 14), mat(COLORS.basketInside));
  inside.rotation.x = -Math.PI / 2;
  inside.position.y = 0.401;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI), mat(COLORS.basket));
  handle.position.y = 0.4;
  handle.rotation.y = Math.PI / 4;
  for (const m of [body, handle]) m.castShadow = true;
  basket.add(body, inside, handle);

  // Урожай в корзинке — показывается, когда там что-то есть
  const fill = new THREE.Group();
  for (const [fx, fz] of [[-0.1, 0.05], [0.1, -0.05], [0, 0.12]]) {
    const piece = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(COLORS.basketFill));
    piece.position.set(fx, 0.42, fz);
    fill.add(piece);
  }
  fill.visible = false;
  basket.add(fill);
  basket.userData.fill = fill;
  basket.position.set(x, 0, z);
  return basket;
}

// Рамка клетки под курсором
export function createHoverFrame() {
  const frame = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: COLORS.hoverFrame });
  const s = CELL_SIZE * 0.96, t = 0.06;
  for (const [w, d, x, z] of [[s, t, 0, (s - t) / 2], [s, t, 0, -(s - t) / 2], [t, s, (s - t) / 2, 0], [t, s, -(s - t) / 2, 0]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), m);
    bar.position.set(x, 0.06, z);
    frame.add(bar);
  }
  frame.visible = false;
  return frame;
}

// Заливка клетки перед кротом
export function createFrontMarker() {
  const marker = new THREE.Mesh(
    new THREE.PlaneGeometry(CELL_SIZE * 0.86, CELL_SIZE * 0.86),
    new THREE.MeshBasicMaterial({ color: COLORS.frontCell, transparent: true, opacity: 0.45 }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.045;
  marker.visible = false;
  return marker;
}
