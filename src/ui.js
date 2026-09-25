// Интерфейс поверх сцены: панель инструментов, счётчик корзинки, подсказки.

// Простые значки линиями, цвет берут у кнопки
const ICONS = {
  seeds: '<path d="M12 3c4 4 5.5 8 5.5 11a5.5 5.5 0 0 1-11 0C6.5 11 8 7 12 3z"/><path d="M12 10v8"/>',
  water: '<path d="M4 10h10v9H4z"/><path d="M14 12l6-5"/><path d="M7 10V7h4v3"/><path d="M20 13v2M18 15v2"/>',
  hands: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 11V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M17 12V9a1.5 1.5 0 0 1 3 0v5c0 4-3 7-7 7-3 0-5-1.5-6.5-4L4 13.5a1.5 1.5 0 0 1 2.6-1.5L8 14"/>',
};

export const TOOLS = [
  { id: 'seeds', name: 'Семена' },
  { id: 'water', name: 'Лейка' },
  { id: 'hands', name: 'Руки' },
];

export function createUI({ onSelectTool }) {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const buttons = {};
  TOOLS.forEach((tool, i) => {
    const b = document.createElement('button');
    b.innerHTML = `
      <span class="key">${i + 1}</span>
      <svg viewBox="0 0 24 24">${ICONS[tool.id]}</svg>
      <span class="name">${tool.name}</span>`;
    b.addEventListener('click', () => onSelectTool(tool.id));
    toolbar.appendChild(b);
    buttons[tool.id] = b;
  });
  document.body.appendChild(toolbar);

  const counter = document.createElement('div');
  counter.className = 'hud';
  document.body.appendChild(counter);

  const hintBox = document.createElement('div');
  hintBox.className = 'hint';
  document.body.appendChild(hintBox);
  let hintTimer;

  return {
    setTool(id) {
      for (const [toolId, b] of Object.entries(buttons)) b.classList.toggle('selected', toolId === id);
    },
    setBasket(count) {
      counter.textContent = `В корзинке: ${count}`;
    },
    hint(text) {
      hintBox.textContent = text;
      hintBox.classList.add('visible');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hintBox.classList.remove('visible'), 1600);
    },
  };
}
