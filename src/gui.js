// Настройка стиля: панель ползунков (G), переключение режима (P), кнопки для телефона.
// Временная штука — в финале уберём.
import GUI from 'lil-gui';
import { STYLE, STYLE_PHONE } from './config.js';
import { MODES } from './postfx.js';

// Телефон — сенсорный экран. У него свои стартовые значения и своё сохранение.
const IS_PHONE = window.matchMedia('(pointer: coarse)').matches;
const DEFAULTS = IS_PHONE ? { ...STYLE, ...STYLE_PHONE } : STYLE;
const STORAGE_KEY = IS_PHONE ? 'ogorod-style-phone' : 'ogorod-style';
const MODE_NAMES = { off: 'выкл', pixels: 'пиксели', ascii: 'ASCII' };

// Стартовые значения из config.js, поверх — то, что ты накрутил в прошлый раз
function loadSettings() {
  const settings = { ...DEFAULTS };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
  } catch { /* нет сохранённого — берём из config.js */ }
  return settings;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* браузер не даёт сохранять — не страшно */ }
}

// onRestart — стереть прогресс и начать игру заново
export function createStyleControls({ onRestart } = {}) {
  const settings = loadSettings();
  const save = () => saveSettings(settings);

  const gui = new GUI({ title: 'Стиль (G — скрыть)' });
  const modeOptions = Object.fromEntries(MODES.map((m) => [MODE_NAMES[m], m]));
  gui.add(settings, 'mode', modeOptions).name('режим (P)');
  gui.add(settings, 'pixelSize', 1, 16, 1).name('размер пикселя');
  gui.add(settings, 'charSize', 6, 32, 1).name('размер символа');
  gui.add(settings, 'contrast', 0.5, 2.5, 0.05).name('контраст');
  gui.add(settings, 'brightness', -0.3, 0.3, 0.01).name('яркость');
  gui.add(settings, 'dither', 0, 1, 0.05).name('смешивание тонов');
  gui.add({
    copy() {
      const text = JSON.stringify(settings, null, 2);
      navigator.clipboard?.writeText(text);
      console.log(text);
    },
  }, 'copy').name('скопировать значения');
  gui.add({
    reset() {
      Object.assign(settings, DEFAULTS);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      save();
    },
  }, 'reset').name('сбросить к config.js');
  if (onRestart) {
    gui.add({
      restart() {
        if (confirm('Стереть огород и начать заново?')) onRestart();
      },
    }, 'restart').name('начать игру заново');
  }
  gui.onChange(save);
  gui.hide();

  // Подпись режима, появляется на пару секунд
  const label = document.createElement('div');
  label.className = 'mode-label';
  document.body.appendChild(label);
  let labelTimer;
  function showLabel() {
    label.textContent = `Режим: ${MODE_NAMES[settings.mode]}`;
    label.classList.add('visible');
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => label.classList.remove('visible'), 1500);
  }

  function nextMode() {
    settings.mode = MODES[(MODES.indexOf(settings.mode) + 1) % MODES.length];
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    save();
    showLabel();
  }
  const togglePanel = () => (gui._hidden ? gui.show() : gui.hide());

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return; // печатаешь число в панели
    if (e.code === 'KeyP') nextMode();
    if (e.code === 'KeyG') togglePanel();
  });

  // Кнопки для телефона, где нет клавиатуры
  const buttons = document.createElement('div');
  buttons.className = 'dev-buttons';
  for (const [text, action] of [['P', nextMode], ['G', togglePanel]]) {
    const b = document.createElement('button');
    b.textContent = text;
    b.addEventListener('click', action);
    buttons.appendChild(b);
  }
  document.body.appendChild(buttons);

  return settings;
}
