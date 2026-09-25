// Точка входа: собираем сцену, крота, грядки, управление и запускаем игровой цикл.
import { MOLE_START, BASKET_CELL } from './config.js';
import { cellToWorld, worldToCell, isInGarden, findPathToNeighbor } from './grid.js';
import { createScene, createHoverFrame, createFrontMarker } from './scene.js';
import { Mole } from './mole.js';
import { Garden, EMPTY, RIPE } from './garden.js';
import { createInput } from './input.js';
import { createUI, TOOLS } from './ui.js';
import { createPostFX } from './postfx.js';
import { createStyleControls } from './gui.js';
import { loadGame, saveGame, clearSave } from './save.js';

const { renderer, scene, camera, cameraControl, world, basket } = createScene(document.body);

const postfx = createPostFX(renderer, createStyleControls({ onRestart: restart }));
const garden = new Garden(scene);

const mole = new Mole();
mole.position.copy(cellToWorld(MOLE_START.x, MOLE_START.z));
mole.heading = mole.targetHeading = Math.PI; // смотрит на огород
scene.add(mole.object);

const hoverFrame = createHoverFrame();
const frontMarker = createFrontMarker();
scene.add(hoverFrame, frontMarker);

// Состояние игры
let tool = 'seeds';
let basketCount = 0;
let restarting = false; // во время «начать заново» не сохраняем

const ui = createUI({ onSelectTool: selectTool });

// Загрузка сохранения. Растения «досчитываются» сами: стадия считается от момента полива.
const saved = loadGame();
if (saved) {
  garden.load(saved.cells || []);
  basketCount = saved.basketCount || 0;
  if (TOOLS.some((t) => t.id === saved.tool)) tool = saved.tool;
  if (saved.held) mole.setHeld(saved.held);
  if (saved.mole) {
    mole.position.set(saved.mole.x, 0, saved.mole.z);
    mole.heading = mole.targetHeading = saved.mole.heading;
    mole.collide(world); // на случай, если огород поменялся
  }
}
cameraControl.centerOn(mole.position); // на телефоне сцена ближе — начинаем с крота
ui.setBasket(basketCount);
basket.userData.fill.visible = basketCount > 0;
selectTool(tool);

function selectTool(id) {
  tool = id;
  ui.setTool(id);
  save();
}

// Сохранение
function save() {
  if (restarting) return;
  saveGame({
    cells: garden.toSave(),
    basketCount,
    held: mole.held,
    tool,
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

const isBasket = (c) => c.x === BASKET_CELL.x && c.z === BASKET_CELL.z;

// Выбранный инструмент срабатывает на клетке (или на корзинке)
function useTool(c) {
  applyTool(c);
  save();
}

function applyTool(c) {
  if (isBasket(c)) return putInBasket();
  if (!isInGarden(c)) return;
  const stage = garden.stage(c);

  if (tool === 'seeds') {
    if (stage !== EMPTY) return ui.hint('Здесь уже посажено');
    garden.plant(c, 'carrot');
  } else if (tool === 'water') {
    if (stage === EMPTY) return ui.hint('Сначала посади семена');
    if (garden.isWatered(c)) return ui.hint('Уже полито — растёт');
    garden.water(c);
  } else if (tool === 'hands') {
    if (stage === EMPTY) return ui.hint('Здесь пусто');
    if (stage !== RIPE) return ui.hint(garden.isWatered(c) ? 'Ещё растёт' : 'Сначала полей');
    if (mole.held) return ui.hint('Лапы заняты — отнеси урожай в корзинку');
    mole.setHeld(garden.harvest(c));
  }
}

function putInBasket() {
  if (!mole.held) return ui.hint('Лапы пусты — сначала собери урожай');
  mole.setHeld(null);
  basketCount++;
  ui.setBasket(basketCount);
  basket.userData.fill.visible = true;
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
    if (TOOLS[n - 1]) selectTool(TOOLS[n - 1].id);
  },
}, [{ object: basket, cell: BASKET_CELL }]);

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

  placeOn(hoverFrame, input.hoverCell);
  placeOn(frontMarker, frontCell());

  postfx.render(scene, camera);
});

// Только для разработки: доступ к игре из консоли браузера
if (import.meta.env.DEV) window.game = { mole, camera, scene, garden };
