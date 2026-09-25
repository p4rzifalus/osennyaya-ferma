// Сохранение игры в браузере (localStorage). Без сервера.
const KEY = 'ogorod-save';
const VERSION = 2; // меняется, когда меняется формат сохранения

export function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data) return null;
    return upgrade(data);
  } catch {
    return null; // сохранения нет или браузер не даёт читать — начинаем с нуля
  }
}

// Старые сохранения переводим в новый формат, шаг за шагом
function upgrade(data) {
  if (data.version === 1) {
    // Было: морковки в корзинке. Стало: монеты и счёт урожая.
    const count = data.basketCount || 0;
    data = { ...data, version: 2, coins: count * 2, harvested: { carrot: count } };
    delete data.basketCount;
  }
  return data.version === VERSION ? data : null;
}

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, savedAt: Date.now(), ...state }));
  } catch { /* браузер не даёт сохранять — играем без сохранения */ }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* нечего чистить */ }
}
