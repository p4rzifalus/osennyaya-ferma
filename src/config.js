// Все игровые числа — здесь. Меняй смело: после сохранения файла игра обновится сама.

// Палитра, от тёмного к светлому
export const PALETTE = ['#1a0a00', '#4a1c00', '#8c3a00', '#d9661a', '#ff9933', '#ffd9a0'];

// Какой цвет палитры у чего
export const COLORS = {
  background: PALETTE[0],
  ground: PALETTE[2],      // земля вокруг огорода
  soil: PALETTE[1],        // клетки огорода
  houseWalls: PALETTE[3],
  houseRoof: PALETTE[1],
  houseDoor: PALETTE[0],
  houseWindow: PALETTE[5],
  basket: PALETTE[4],
  basketInside: PALETTE[1],
  moleBody: PALETTE[2],
  moleSnout: PALETTE[3],
  moleOveralls: PALETTE[1],
  moleNose: PALETTE[4],
  moleEyes: PALETTE[0],
  molePaws: PALETTE[3],
  moleHat: PALETTE[5],
  moleHatBand: PALETTE[3],
  hoverFrame: PALETTE[5],  // рамка клетки под курсором
  frontCell: PALETTE[4],   // клетка перед кротом
};

// Огород
export const GARDEN_SIZE = 8;   // клеток по стороне
export const CELL_SIZE = 1;     // размер клетки в «метрах» сцены

// Координаты ниже — в клетках. Огород: от 0 до 7.
// Вокруг огорода дорожка шириной в одну клетку: -1 и 8.
export const BASKET_CELL = { x: -1, z: 1 };   // корзинка стоит на дорожке
export const MOLE_START = { x: 4, z: 8 };     // где крот появляется

// Крот
export const MOLE_SPEED = 3;        // клеток в секунду
export const MOLE_TURN_SPEED = 12;  // как быстро поворачивается
export const MOLE_SCALE = 1;        // размер крота

// Стиль картинки. Клавиша P — режим, G — панель ползунков.
// Когда выберешь окончательные значения, впиши их сюда.
export const STYLE = {
  mode: 'pixels',   // 'off' — чистая сцена, 'pixels' — пиксели, 'ascii' — символы
  pixelSize: 4,     // размер пикселя, в точках экрана
  charSize: 10,     // размер символа ASCII, в точках экрана
  contrast: 1.1,
  brightness: 0,    // сдвиг яркости: минус — темнее, плюс — светлее
  dither: 0.5,      // смешивание соседних тонов узором: 0 — резкие ступени
};
