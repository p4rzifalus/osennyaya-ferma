// Сохранение игры в браузере (localStorage). Без сервера.
const KEY = 'ogorod-save';
const VERSION = 1; // меняется, когда меняется формат сохранения

export function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (!data) return null;
    // Здесь будем дополнять старые сохранения, когда формат изменится
    if (data.version !== VERSION) return null;
    return data;
  } catch {
    return null; // сохранения нет или браузер не даёт читать — начинаем с нуля
  }
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
