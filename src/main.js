// Точка входа: собираем сцену, крота, грядки, управление и запускаем игровой цикл.
import { MOLE_START, BASKET_CELL, PLANTS, STYLE, STYLE_PHONE } from './config.js';
import { cellToWorld, worldToCell, isInGarden, findPathToNeighbor } from './grid.js';
import { createScene, createHoverFrame, createFrontMarker } from './scene.js';
import { Mole } from './mole.js';
import { Garden, EMPTY, RIPE } from './garden.js';
import { createInput } from './input.js';
import { createUI, TOOLS } from './ui.js';
import { createPostFX } from './postfx.js';
import { createDecor } from './decor.js';
import { loadGame, saveGame, clearSave } from './save.js';

const { renderer, scene, camera, cameraControl, world, basket, landmarks } = createScene(document.body);

// Стиль картинки: на телефоне (сенсорный экран) — свои значения поверх общих
const isPhone = window.matchMedia('(pointer: coarse)').matches;
const postfx = createPostFX(renderer, isPhone ? { ...STYLE, ...STYLE_PHONE } : STYLE);

const garden = new Garden(scene);
const decor = createDecor(scene, landmarks);

const mole = new Mole();
mole.position.copy(cellToWorld(MOLE_START.x, MOLE_START.z));
mole.heading = mole.targetHeading = Math.PI; // смотрит на огород
scene.add(mole.object);

const hoverFrame = createHoverFrame();
const frontMarker = createFrontMarker();
scene.add(hoverFrame, frontMarker);

// ---------- Состояние игры ----------
let tool = 'seeds';
let selectedSeed = 'carrot';
let coins = 0;
let seeds = {};      // запас семян: { radish: 3, ... } (морковь бесплатная, её не считаем)
let harvested = {};  // сколько чего отнесено в корзинку: { carrot: 7, ... }
let shopOpen = false;
let restarting = false; // во время «начать заново» не сохраняем

const PLANT_TYPES = Object.keys(PLANTS);
const isFree = (type) => PLANTS[type].seedPrice === 0;
const seedCount = (type) => (isFree(type) ? Infinity : seeds[type] || 0);

function isUnlocked(type) {
  const unlock = PLANTS[type].unlock;
  return !unlock || (harvested[unlock.plant] || 0) >= unlock.count;
}

// «5 морковок», «3 тыквы», «1 гриб»
function countOf(type, n) {
  const [one, few, many] = PLANTS[type].forms;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

const ui = createUI({
  onSelectTool: selectTool,
  onSelectSeed(type) {
    selectedSeed = type;
    refresh();
  },
  onBuy: buySeeds,
  onShopToggle(open = !shopOpen) {
    shopOpen = open;
    refresh();
  },
});

// Загрузка сохранения. Растения «досчитываются» сами: стадия считается от момента полива.
const saved = loadGame();
if (saved) {
  garden.load(saved.cells || []);
  coins = saved.coins || 0;
  seeds = saved.seeds || {};
  harvested = saved.harvested || {};
  if (TOOLS.some((t) => t.id === saved.tool)) tool = saved.tool;
  if (PLANTS[saved.selectedSeed]) selectedSeed = saved.selectedSeed;
  if (PLANTS[saved.held]) mole.setHeld(saved.held);
  if (saved.mole) {
    mole.position.set(saved.mole.x, 0, saved.mole.z);
    mole.heading = mole.targetHeading = saved.mole.heading;
    mole.collide(world); // на случай, если огород поменялся
  }
}
cameraControl.centerOn(mole.position); // на телефоне сцена ближе — начинаем с крота
refresh();

function selectTool(id) {
  tool = id;
  refresh();
}

// Обновить интерфейс и сохранить — после любого изменения
function refresh() {
  if (seedCount(selectedSeed) <= 0 || !isUnlocked(selectedSeed)) selectedSeed = 'carrot';
  basket.userData.fill.visible = Object.values(harvested).some((n) => n > 0);

  ui.render({
    tool,
    coins,
    shopOpen,
    selectedSeed,
    seedOptions: PLANT_TYPES
      .filter((type) => isUnlocked(type) && seedCount(type) > 0)
      .map((type) => ({ type, name: PLANTS[type].name, count: isFree(type) ? '∞' : seedCount(type) })),
    shop: PLANT_TYPES.map((type) => {
      const p = PLANTS[type];
      const unlock = p.unlock;
      return {
        type,
        name: p.name,
        unlocked: isUnlocked(type),
        seedPrice: p.seedPrice,
        sellPrice: p.sellPrice,
        growSeconds: p.stageSeconds * 3,
        owned: seedCount(type),
        condition: unlock && `собери ${countOf(unlock.plant, unlock.count)} (есть ${harvested[unlock.plant] || 0})`,
      };
    }),
  });
  save();
}

// ---------- Сохранение ----------
function save() {
  if (restarting) return;
  saveGame({
    cells: garden.toSave(),
    coins,
    seeds,
    harvested,
    held: mole.held,
    tool,
    selectedSeed,
    mole: { x: mole.position.x, z: mole.position.z, heading: mole.heading },
  });
}

function restart() {
  restarting = true;
  clearSave();
  location.reload();
}

// При закрытии/сворачивании вкладки и раз в 5 секунд — на всякий случай
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});
window.addEventListener('pagehide', save);
setInterval(save, 5000);

// ---------- Действия ----------
const isBasket = (c) => c.x === BASKET_CELL.x && c.z === BASKET_CELL.z;

// Выбранный инструмент срабатывает на клетке (или на корзинке)
function useTool(c) {
  applyTool(c);
  refresh();
}

function applyTool(c) {
  if (isBasket(c)) return putInBasket();
  if (!isInGarden(c)) return;
  const stage = garden.stage(c);

  if (tool === 'seeds') {
    if (stage !== EMPTY) return ui.hint('Здесь уже посажено');
    garden.plant(c, selectedSeed);
    if (!isFree(selectedSeed)) seeds[selectedSeed]--;
  } else if (tool === 'water') {
    if (stage === EMPTY) return ui.hint('Сначала посади семена');
    if (garden.isWatered(c)) return ui.hint('Уже полито — растёт');
    garden.water(c);
    decor.splash(cellToWorld(c.x, c.z));
  } else if (tool === 'hands') {
    if (stage === EMPTY) return ui.hint('Здесь пусто');
    if (stage !== RIPE) return ui.hint(garden.isWatered(c) ? 'Ещё растёт' : 'Сначала полей');
    if (mole.held) return ui.hint('Лапы заняты — отнеси урожай в корзинку');
    mole.setHeld(garden.harvest(c));
  }
}

// Корзинка превращает урожай в монеты
function putInBasket() {
  const type = mole.held;
  if (!type) return ui.hint('Лапы пусты — сначала собери урожай');
  const lockedBefore = PLANT_TYPES.filter((t) => !isUnlocked(t));

  mole.setHeld(null);
  coins += PLANTS[type].sellPrice;
  harvested[type] = (harvested[type] || 0) + 1;

  const opened = lockedBefore.filter(isUnlocked);
  if (opened.length) ui.hint(`Новые семена в магазине: ${opened.map((t) => PLANTS[t].name).join(', ')}!`, 3500);
  else ui.hint(`+${PLANTS[type].sellPrice} мон.`);
}

function buySeeds(type, count) {
  const cost = PLANTS[type].seedPrice * count;
  if (!isUnlocked(type) || coins < cost) return;
  coins -= cost;
  seeds[type] = (seeds[type] || 0) + count;
  selectedSeed = type; // сразу готовы сажать купленное
  refresh();
}

// Клетка перед носом крота
function frontCell() {
  const c = worldToCell(mole.frontPoint);
  return isInGarden(c) || isBasket(c) ? c : null;
}

const input = createInput(renderer.domElement, camera, {
  // Клик по клетке: идём к ней, встаём рядом лицом к ней и действуем
  onCellClick(c) {
    const path = findPathToNeighbor(worldToCell(mole.position), c);
    if (!path) return;
    const points = path.map((p) => cellToWorld(p.x, p.z));
    if (points.length > 1) points.shift(); // первая точка — клетка, где крот уже стоит
    mole.walkPath(points, cellToWorld(c.x, c.z), () => useTool(c));
  },
  onAction() {
    const c = frontCell();
    if (c) useTool(c);
  },
  onPan(dx, dy) {
    cameraControl.panBy(dx, dy);
  },
  onTool(n) {
    if (n === 4) {
      shopOpen = !shopOpen;
      refresh();
    } else if (TOOLS[n - 1]) {
      selectTool(TOOLS[n - 1].id);
    }
  },
}, [{ object: basket, cell: BASKET_CELL }]);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && shopOpen) {
    shopOpen = false;
    refresh();
  }
});

// Показать подсветку на клетке (или спрятать)
function placeOn(object, cell) {
  object.visible = !!cell;
  if (cell) {
    const p = cellToWorld(cell.x, cell.z);
    object.position.x = p.x;
    object.position.z = p.z;
  }
}

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min((now - last) / 1000, 0.05); // не больше 1/20 с, чтобы не «прыгал» после паузы
  last = now;

  mole.update(dt, input.getMoveDir(), world);
  garden.update();
  decor.update(dt, now / 1000);

  placeOn(hoverFrame, input.hoverCell);
  placeOn(frontMarker, frontCell());

  postfx.render(scene, camera);
});

// Только для разработки: доступ к игре из консоли браузера (game.restart() — начать заново)
if (import.meta.env.DEV) {
  window.game = {
    mole, camera, scene, garden, restart,
    cheat(extraCoins = 1000) { coins += extraCoins; refresh(); },
  };
}
