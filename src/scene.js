// Сцена: камера, свет, земля, огород, домик, корзинка, подсветки клеток.
import * as THREE from 'three';
import { COLORS, GARDEN_SIZE, CELL_SIZE, BASKET_CELL } from './config.js';
import { cellToWorld } from './grid.js';

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

  // Островок земли
  const islandMinZ = houseZ - 1.5 * CELL_SIZE;
  const island = box(half * 2 + 0.6, 0.4, half + 0.3 - islandMinZ, COLORS.ground, 0, -0.4, (half + 0.3 + islandMinZ) / 2);
  island.castShadow = false;
  scene.add(island);

  // Клетки огорода
  for (let x = 0; x < GARDEN_SIZE; x++) {
    for (let z = 0; z < GARDEN_SIZE; z++) {
      const p = cellToWorld(x, z);
      const tile = box(CELL_SIZE * 0.92, 0.04, CELL_SIZE * 0.92, COLORS.soil, p.x, 0, p.z);
      tile.castShadow = false;
      scene.add(tile);
    }
  }

  scene.add(createHouse(0.5, houseZ));
  const basketPos = cellToWorld(BASKET_CELL.x, BASKET_CELL.z);
  scene.add(createBasket(basketPos.x, basketPos.z));

  // Где крот может ходить и во что упирается
  const world = {
    bounds: { min: -half + 0.25, max: half - 0.25 },
    obstacles: [{ x: basketPos.x, z: basketPos.z, r: 0.45 }],
  };

  // Камера подстраивается, чтобы вся сцена помещалась в окно
  const sceneBox = new THREE.Box3(
    new THREE.Vector3(-half - 0.3, -0.4, islandMinZ),
    new THREE.Vector3(half + 0.3, 3, half + 0.3),
  );
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.updateMatrixWorld();
    const view = new THREE.Box3();
    for (const x of [sceneBox.min.x, sceneBox.max.x])
      for (const y of [sceneBox.min.y, sceneBox.max.y])
        for (const z of [sceneBox.min.z, sceneBox.max.z])
          view.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
    const center = view.getCenter(new THREE.Vector3());
    const size = view.getSize(new THREE.Vector3()).multiplyScalar(0.5 * 1.08); // + поля
    const aspect = w / h;
    if (size.x / size.y > aspect) size.y = size.x / aspect;
    else size.x = size.y * aspect;
    Object.assign(camera, {
      left: center.x - size.x, right: center.x + size.x,
      top: center.y + size.y, bottom: center.y - size.y,
    });
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, world };
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

  house.add(box(0.6, 0.95, 0.06, COLORS.houseDoor, -0.5, 0, d / 2));          // дверь
  house.add(box(0.5, 0.45, 0.06, COLORS.houseWindow, 0.7, 0.55, d / 2));      // окно
  house.add(box(0.3, 0.7, 0.3, COLORS.houseRoof, 0.8, h + 0.35, -0.3));        // труба

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
