// Грядки: что посажено в каждой клетке, полито ли, какая стадия роста, и как это выглядит.
import * as THREE from 'three';
import { COLORS, GARDEN_SIZE, CELL_SIZE, PLANTS, GROWTH_SPEED } from './config.js';
import { cellToWorld } from './grid.js';
import { buildPlant } from './plants.js';

export const EMPTY = -1;
export const RIPE = 3;

export class Garden {
  constructor(scene) {
    this.cells = [];
    for (let x = 0; x < GARDEN_SIZE; x++) {
      for (let z = 0; z < GARDEN_SIZE; z++) {
        const p = cellToWorld(x, z);
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(CELL_SIZE * 0.92, 0.04, CELL_SIZE * 0.92),
          new THREE.MeshLambertMaterial({ color: COLORS.soil }),
        );
        tile.position.set(p.x, 0.02, p.z);
        tile.receiveShadow = true;
        scene.add(tile);

        const anchor = new THREE.Group(); // сюда ставим растение
        anchor.position.set(p.x, 0.04, p.z);
        scene.add(anchor);

        this.cells.push({ x, z, plant: null, wateredAt: null, tile, anchor, shownStage: null, soilColor: null });
      }
    }
  }

  cell(c) {
    return this.cells[c.x * GARDEN_SIZE + c.z];
  }

  // Стадия растёт сама из «сколько прошло с полива» — никаких таймеров
  stage(c, now = Date.now()) {
    const cell = this.cell(c);
    if (!cell.plant) return EMPTY;
    if (!cell.wateredAt) return 0;
    const stageMs = (PLANTS[cell.plant].stageSeconds * 1000) / GROWTH_SPEED;
    return Math.min(RIPE, Math.floor((now - cell.wateredAt) / stageMs));
  }

  isWatered(c) {
    return !!this.cell(c).wateredAt;
  }

  plant(c, type) {
    Object.assign(this.cell(c), { plant: type, wateredAt: null });
  }

  water(c) {
    this.cell(c).wateredAt = Date.now();
  }

  // Собрать: клетка снова пустая, возвращаем, что собрали
  harvest(c) {
    const cell = this.cell(c);
    const type = cell.plant;
    Object.assign(cell, { plant: null, wateredAt: null });
    return type;
  }

  // Для сохранения: только клетки, где что-то есть
  toSave() {
    return this.cells
      .filter((cell) => cell.plant)
      .map(({ x, z, plant, wateredAt }) => ({ x, z, plant, wateredAt }));
  }

  load(saved) {
    for (const { x, z, plant, wateredAt } of saved) {
      if (x >= 0 && x < GARDEN_SIZE && z >= 0 && z < GARDEN_SIZE && PLANTS[plant]) {
        Object.assign(this.cell({ x, z }), { plant, wateredAt });
      }
    }
  }

  // Каждый кадр: обновить вид клеток, у которых сменилась стадия
  update(now = Date.now()) {
    for (const cell of this.cells) {
      const stage = this.stage(cell, now);
      if (stage !== cell.shownStage) {
        cell.anchor.clear();
        if (stage !== EMPTY) cell.anchor.add(buildPlant(cell.plant, stage));
        cell.shownStage = stage;
      }

      // Земля: тёмная, пока растёт после полива; светлая, когда урожай готов
      let soilColor = COLORS.soil;
      if (stage === RIPE) soilColor = COLORS.soilRipe;
      else if (cell.wateredAt) soilColor = COLORS.soilWet;
      if (soilColor !== cell.soilColor) {
        cell.tile.material.color.set(soilColor);
        cell.soilColor = soilColor;
      }
    }
  }
}
