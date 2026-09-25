// Постобработка: сцена рисуется в невидимую картинку, потом один шаг выводит её на экран
// в выбранном режиме — «выкл» (только палитра), «пиксели» или «ASCII».
import * as THREE from 'three';
import { PALETTE } from './config.js';

export const MODES = ['off', 'pixels', 'ascii'];
const GLYPHS = '.:-=+*#@';

// '#ff9933' → числа 0..1 (без переводов цвета, как есть)
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const luma = (v) => v.x * 0.299 + v.y * 0.587 + v.z * 0.114;

// Картинка со всеми символами в ряд: белые на чёрном
function createGlyphAtlas() {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = s * GLYPHS.length;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${s * 0.85}px Menlo, Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...GLYPHS].forEach((ch, i) => ctx.fillText(ch, (i + 0.5) * s, s * 0.55));
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tGlyphs;
  uniform int uMode;            // 0 выкл, 1 пиксели, 2 ASCII
  uniform vec2 uSceneSize;      // размер невидимой картинки
  uniform vec2 uResolution;     // размер экрана в точках
  uniform float uCellPx;        // размер символа в точках экрана
  uniform float uContrast;
  uniform float uBrightness;
  uniform float uDither;
  uniform vec3 uPalette[6];
  uniform float uPaletteLum[6];
  varying vec2 vUv;

  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  float adjust(float l) { return (l - 0.5) * uContrast + 0.5 + uBrightness; }

  // Узор «шахматного» смешивания 4×4: даёт полутона, не выходя из палитры
  float bayer4(vec2 p) {
    ivec2 q = ivec2(mod(p, 4.0));
    const float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    return (m[q.x + q.y * 4] + 0.5) / 16.0 - 0.5;
  }

  // Ближайший тон палитры по яркости (d — сдвиг порога для смешивания)
  int toneIndex(float l, float d) {
    int idx = 0;
    for (int i = 0; i < 5; i++) {
      float lo = uPaletteLum[i];
      float hi = uPaletteLum[i + 1];
      if (l > (lo + hi) * 0.5 + d * (hi - lo)) idx = i + 1;
    }
    return idx;
  }

  void main() {
    if (uMode == 2) {
      // ASCII: экран поделён на клеточки, в каждой — символ по яркости
      vec2 cell = floor(gl_FragCoord.xy / uCellPx);
      vec2 center = (cell + 0.5) * uCellPx / uResolution;
      float l = adjust(luma(toSRGB(texture2D(tScene, center).rgb)));
      int tone = toneIndex(l, 0.0);
      // Символ закрывает лишь часть клеточки и кажется темнее — берём тон на ступень светлее
      if (tone > 0) tone = min(tone + 1, 5);
      float t = clamp((l - uPaletteLum[0]) / (uPaletteLum[5] - uPaletteLum[0]), 0.0, 0.999);
      float glyph = floor(pow(t, 0.6) * 8.0); // тёмным местам — символы поплотнее
      vec2 inCell = fract(gl_FragCoord.xy / uCellPx);
      float mask = texture2D(tGlyphs, vec2((glyph + inCell.x) / 8.0, inCell.y)).r;
      gl_FragColor = vec4(mix(uPalette[0], uPalette[tone], mask), 1.0);
      return;
    }
    vec3 c = toSRGB(texture2D(tScene, vUv).rgb);
    vec2 ditherPos = uMode == 1 ? floor(vUv * uSceneSize) : gl_FragCoord.xy;
    int tone = toneIndex(adjust(luma(c)), bayer4(ditherPos) * uDither);
    gl_FragColor = vec4(uPalette[tone], 1.0);
  }
`;

// settings — общий объект настроек (его же меняет панель ползунков)
export function createPostFX(renderer, settings) {
  const palette = PALETTE.map(hexToRgb);
  const opts = { type: THREE.HalfFloatType };
  const sharpTarget = new THREE.WebGLRenderTarget(1, 1, { ...opts, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const smoothTarget = new THREE.WebGLRenderTarget(1, 1, { ...opts, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

  const uniforms = {
    tScene: { value: null },
    tGlyphs: { value: createGlyphAtlas() },
    uMode: { value: 0 },
    uSceneSize: { value: new THREE.Vector2() },
    uResolution: { value: new THREE.Vector2() },
    uCellPx: { value: 10 },
    uContrast: { value: 1 },
    uBrightness: { value: 0 },
    uDither: { value: 0 },
    uPalette: { value: palette },
    uPaletteLum: { value: palette.map(luma) },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false }),
  );
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const screen = new THREE.Vector2();

  return {
    render(scene, camera) {
      renderer.getDrawingBufferSize(screen);
      const dpr = renderer.getPixelRatio();
      const mode = Math.max(0, MODES.indexOf(settings.mode));

      // Насколько мелко рисуем сцену в каждом режиме
      let target = sharpTarget;
      let w = screen.x;
      let h = screen.y;
      if (mode === 1) {
        const px = settings.pixelSize * dpr;
        w = Math.ceil(screen.x / px);
        h = Math.ceil(screen.y / px);
      } else if (mode === 2) {
        // по 2×2 точки на символ, при чтении они усредняются
        const cell = settings.charSize * dpr;
        target = smoothTarget;
        w = Math.ceil(screen.x / cell) * 2;
        h = Math.ceil(screen.y / cell) * 2;
      }
      if (target.width !== w || target.height !== h) target.setSize(w, h);

      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      uniforms.tScene.value = target.texture;
      uniforms.uMode.value = mode;
      uniforms.uSceneSize.value.set(w, h);
      uniforms.uResolution.value.copy(screen);
      uniforms.uCellPx.value = settings.charSize * dpr;
      uniforms.uContrast.value = settings.contrast;
      uniforms.uBrightness.value = settings.brightness;
      uniforms.uDither.value = settings.dither;
      renderer.render(quadScene, quadCamera);
    },
  };
}
