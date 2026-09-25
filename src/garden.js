// Грядки: что посажено в каждой клетке, полито ли, какая стадия роста, и как это выглядит.
import * as THREE from 'three';
import { COLORS, GARDEN_SIZE, CELL_SIZE, PLANTS } from './config.js';
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

        this.cells.push({ x, z, plant: null, wateredAt: null, tile, anchor, shownStage: null, wet: false });
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
    const stageMs = PLANTS[cell.plant].stageSeconds * 1000;
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

  // Каждый кадр: обновить вид клеток, у которых сменилась стадия
  update(now = Date.now()) {
    for (const cell of this.cells) {
      const stage = this.stage(cell, now);
      if (stage !== cell.shownStage) {
        cell.anchor.clear();
        if (stage !== EMPTY) cell.anchor.add(buildPlant(cell.plant, stage));
        cell.shownStage = stage;
      }
      // Земля тёмная, пока растение растёт после полива
      const wet = !!cell.wateredAt && stage < RIPE;
      if (wet !== cell.wet) {
        cell.tile.material.color.set(wet ? COLORS.soilWet : COLORS.soil);
        cell.wet = wet;
      }
    }
  }
}
