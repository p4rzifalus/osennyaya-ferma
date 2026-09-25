// Все игровые числа — здесь. Меняй смело: после сохранения файла игра обновится сама.

// Палитра, от тёмного к светлому
export const PALETTE = ['#1a0a00', '#4a1c00', '#8c3a00', '#d9661a', '#ff9933', '#ffd9a0'];

// Какой цвет палитры у чего
export const COLORS = {
  background: PALETTE[0],
  ground: PALETTE[2],      // земля вокруг огорода
  soil: PALETTE[1],        // клетки огорода
  soilWet: PALETTE[0],     // политая земля
  soilRipe: PALETTE[2],    // клетка со спелым урожаем
  ripeMarker: PALETTE[5],  // стрелка над спелым урожаем
  mound: PALETTE[2],       // бугорок над семечком
  seed: PALETTE[4],
  leaves: PALETTE[3],
  carrot: PALETTE[4],
  radish: PALETTE[5],
  pumpkin: PALETTE[4],
  stem: PALETTE[2],
  sunflowerPetals: PALETTE[5],
  sunflowerCenter: PALETTE[1],
  mushroomStem: PALETTE[4],
  mushroomCap: PALETTE[5],  // светится: на него не действуют свет и тени
  houseWalls: PALETTE[3],
  houseRoof: PALETTE[1],
  houseDoor: PALETTE[0],
  houseWindow: PALETTE[5],
  basket: PALETTE[4],
  basketInside: PALETTE[1],
  basketFill: PALETTE[4],
  moleBody: PALETTE[2],
  moleSnout: PALETTE[3],
  moleOveralls: PALETTE[1],
  moleNose: PALETTE[4],
  moleEyes: PALETTE[0],
  molePaws: PALETTE[3],
  moleHat: PALETTE[5],
  moleHatBand: PALETTE[3],
  stone: PALETTE[3],
  stoneDark: PALETTE[1],
  grass: PALETTE[3],
  flower: PALETTE[5],
  flowerCenter: PALETTE[4],
  vane: PALETTE[4],
  smoke: PALETTE[3],
  fluff: PALETTE[5],
  water: PALETTE[5],
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

// Растения, в порядке открытия.
//   stageSeconds — сколько секунд длится каждая стадия после полива
//                  (семечко → росток → куст → спелое, то есть рост целиком = 3 × stageSeconds)
//   seedPrice    — цена семечка в магазине (0 — бесплатно и бесконечно)
//   sellPrice    — сколько монет даёт корзинка за урожай
//   unlock       — когда открывается: собрать count штук растения plant
//   forms        — как сказать «собери 1 / 3 / 5 …» (для подсказок)
export const PLANTS = {
  carrot:    { name: 'Морковь',         stageSeconds: 20,  seedPrice: 0,   sellPrice: 2,   unlock: null,                           forms: ['морковку', 'морковки', 'морковок'] },
  radish:    { name: 'Редис',           stageSeconds: 30,  seedPrice: 5,   sellPrice: 8,   unlock: { plant: 'carrot', count: 5 },    forms: ['редиску', 'редиски', 'редисок'] },
  pumpkin:   { name: 'Тыква',           stageSeconds: 60,  seedPrice: 15,  sellPrice: 30,  unlock: { plant: 'radish', count: 5 },    forms: ['тыкву', 'тыквы', 'тыкв'] },
  sunflower: { name: 'Подсолнух',       stageSeconds: 120, seedPrice: 40,  sellPrice: 80,  unlock: { plant: 'pumpkin', count: 3 },   forms: ['подсолнух', 'подсолнуха', 'подсолнухов'] },
  mushroom:  { name: 'Светящийся гриб', stageSeconds: 300, seedPrice: 100, sellPrice: 250, unlock: { plant: 'sunflower', count: 3 }, forms: ['гриб', 'гриба', 'грибов'] },
};

// Скорость роста всех растений: 1 — обычная, 10 — в десять раз быстрее (удобно для проверки)
export const GROWTH_SPEED = 1;

// Мелкие детали сцены
export const DECOR = {
  stones: 12,
  grassTufts: 18,
  flowers: 5,
  fluffs: 10,   // пушинки в воздухе
  wind: 0.8,    // сила ветра: 0 — штиль, 1 — ветрено
  smokePuffs: 4,       // сколько клубов дыма одновременно
  smokeOpacity: 0.45,  // плотность дыма: 0 — невидимый, 1 — сплошной
};

// Камера: минимальная ширина ромбика клетки на экране, в точках (высота — примерно 0,6 от неё). Если огород целиком
// в экран не помещается (телефон), камера приближается и сцену можно двигать пальцем.
export const MIN_CELL_PX = 72;

// Крот
export const MOLE_SPEED = 3;        // клеток в секунду
export const MOLE_TURN_SPEED = 12;  // как быстро поворачивается
export const MOLE_SCALE = 1;        // размер крота
// Как далеко перед носом крота выбирается клетка для действия (в клетках).
// Меньше — ближе к кроту; меньше 0,5 не ставь: будет выбираться клетка под самим кротом.
export const MOLE_REACH = 0.55;

// Стиль картинки (выбран на этапе 2)
export const STYLE = {
  mode: 'pixels',   // 'off' — чистая сцена, 'pixels' — пиксели, 'ascii' — символы
  pixelSize: 4,     // размер пикселя, в точках экрана
  charSize: 10,     // размер символа ASCII, в точках экрана
  contrast: 1.1,
  brightness: 0,    // сдвиг яркости: минус — темнее, плюс — светлее
  dither: 0.5,      // смешивание соседних тонов узором: 0 — резкие ступени
};

// На телефоне (сенсорный экран) эти значения заменяют значения выше
export const STYLE_PHONE = {
  pixelSize: 3,
};
