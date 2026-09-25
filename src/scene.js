// Сцена: камера, свет, земля, огород, домик, корзинка, подсветки клеток.
import * as THREE from 'three';
import { COLORS, GARDEN_SIZE, CELL_SIZE, BASKET_CELL, MIN_CELL_PX } from './config.js';
import { cellToWorld } from './grid.js';

const TOOLBAR_SPACE = 110; // сколько точек снизу занимает панель инструментов

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

  scene.add(createHouse(0.5, houseZ));
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
    new THREE.Vector3(-half - 0.3, -0.4, islandMinZ),
    new THREE.Vector3(half + 0.3, 3, half + 0.3),
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
    view.scale = Math.max(fitScale, MIN_CELL_PX / CELL_WIDTH_IN_VIEW);
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

  return { renderer, scene, camera, cameraControl, world, basket };
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
