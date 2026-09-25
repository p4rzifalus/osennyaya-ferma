// Управление: клавиатура (ходьба, действие, инструменты) и мышь/тап (клик по клетке).
import * as THREE from 'three';
import { worldToCell, isInGarden } from './grid.js';

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas, camera, handlers = {}) {
  const pressed = new Set();

  // «Вверх» на клавиатуре = вверх по экрану. Переводим направления экрана в направления на земле.
  const screenUp = new THREE.Vector3();
  camera.getWorldDirection(screenUp);
  screenUp.setY(0).normalize();
  const screenRight = new THREE.Vector3().crossVectors(screenUp, new THREE.Vector3(0, 1, 0));

  window.addEventListener('keydown', (e) => {
    if (MOVE_KEYS[e.code]) {
      pressed.add(MOVE_KEYS[e.code]);
      e.preventDefault();
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) handlers.onAction?.();
    } else if (/^Digit[1-4]$/.test(e.code)) {
      handlers.onTool?.(Number(e.code.slice(5)));
    }
  });
  window.addEventListener('keyup', (e) => pressed.delete(MOVE_KEYS[e.code]));
  window.addEventListener('blur', () => pressed.clear());

  // Какая клетка огорода под указателем (или null)
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function cellAt(e) {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
    if (!hit) return null;
    const cell = worldToCell(hit);
    return isInGarden(cell) ? cell : null;
  }

  const input = {
    hoverCell: null,

    // Направление ходьбы с клавиатуры (нулевой вектор, если ничего не нажато)
    getMoveDir() {
      const dir = new THREE.Vector3();
      if (pressed.has('up')) dir.add(screenUp);
      if (pressed.has('down')) dir.sub(screenUp);
      if (pressed.has('right')) dir.add(screenRight);
      if (pressed.has('left')) dir.sub(screenRight);
      return dir;
    },
  };

  canvas.addEventListener('pointermove', (e) => { input.hoverCell = cellAt(e); });
  canvas.addEventListener('pointerleave', () => { input.hoverCell = null; });
  canvas.addEventListener('click', (e) => {
    const cell = cellAt(e);
    if (cell) handlers.onCellClick?.(cell);
  });

  return input;
}
