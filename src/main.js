// Точка входа: собираем сцену, крота, управление и запускаем игровой цикл.
import { MOLE_START } from './config.js';
import { cellToWorld, worldToCell, isInGarden, findPathToNeighbor } from './grid.js';
import { createScene, createHoverFrame, createFrontMarker } from './scene.js';
import { Mole } from './mole.js';
import { createInput } from './input.js';

const { renderer, scene, camera, world } = createScene(document.body);

const mole = new Mole();
mole.position.copy(cellToWorld(MOLE_START.x, MOLE_START.z));
mole.heading = mole.targetHeading = Math.PI; // смотрит на огород
scene.add(mole.object);

const hoverFrame = createHoverFrame();
const frontMarker = createFrontMarker();
scene.add(hoverFrame, frontMarker);

const input = createInput(renderer.domElement, camera, {
  // Клик по клетке: идём к ней и встаём рядом, лицом к ней
  onCellClick(cell) {
    const path = findPathToNeighbor(worldToCell(mole.position), cell);
    if (!path) return;
    const points = path.map((c) => cellToWorld(c.x, c.z));
    if (points.length > 1) points.shift(); // первая точка — клетка, где крот уже стоит
    mole.walkPath(points, cellToWorld(cell.x, cell.z));
  },
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

  placeOn(hoverFrame, input.hoverCell);
  const front = worldToCell(mole.frontPoint);
  placeOn(frontMarker, isInGarden(front) ? front : null);

  renderer.render(scene, camera);
});

// Только для разработки: доступ к игре из консоли браузера
if (import.meta.env.DEV) window.game = { mole, camera, scene };
