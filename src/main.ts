import GUI from 'lil-gui';
import { LiquidGlassCanvas, DEFAULTS } from './liquid-glass';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Initialize liquid glass renderer
const lg = new LiquidGlassCanvas(canvas);

// Check if drawElementImage is supported
const extCtx = ctx as CanvasRenderingContext2D & {
  drawElementImage?: unknown;
  drawElement?: unknown;
};
const hasDrawElementImage = !!(extCtx.drawElementImage || extCtx.drawElement);

// Extended canvas type with html-in-canvas methods
type ExtendedCanvas = HTMLCanvasElement & {
  onpaint?: () => void;
  requestPaint?: () => void;
};

// The onpaint handler is called when paint records are ready
(canvas as ExtendedCanvas).onpaint = () => {
  const w = canvas.width;
  const h = canvas.height;

  if (w > 0 && h > 0) {
    if (hasDrawElementImage) {
      lg.render();
    } else {
      ctx.reset();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('drawElementImage() not supported', w / 2, h / 2 - 10);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('Enable chrome://flags/#enable-experimental-web-platform-features', w / 2, h / 2 + 20);
    }
  }
};

// Continuous loop to request repaints (needed for CSS change detection)
function loop() {
  (canvas as ExtendedCanvas).requestPaint?.();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Handle canvas resize - use device pixel dimensions for sharp rendering
let currentWidth = 0;
let currentHeight = 0;

new ResizeObserver(([entry]) => {
  // Use devicePixelContentBoxSize for sharp rendering on high-DPI screens
  let newWidth: number, newHeight: number;

  if (entry.devicePixelContentBoxSize) {
    newWidth = entry.devicePixelContentBoxSize[0].inlineSize;
    newHeight = entry.devicePixelContentBoxSize[0].blockSize;
  } else {
    // Fallback for browsers that don't support devicePixelContentBoxSize
    const dpr = window.devicePixelRatio || 1;
    newWidth = Math.round(entry.contentRect.width * dpr);
    newHeight = Math.round(entry.contentRect.height * dpr);
  }

  // Only resize if dimensions actually changed
  if (newWidth !== currentWidth || newHeight !== currentHeight) {
    currentWidth = newWidth;
    currentHeight = newHeight;
    canvas.width = newWidth;
    canvas.height = newHeight;
  }
}).observe(canvas, { box: 'device-pixel-content-box' });

// GUI Controls for liquid glass effect
const settings = {
  blurAmount: DEFAULTS.blurAmount,
  refraction: DEFAULTS.refraction,
  chromAberration: DEFAULTS.chromAberration,
  edgeHighlight: DEFAULTS.edgeHighlight,
  specular: DEFAULTS.specular,
  fresnel: DEFAULTS.fresnel,
  distortion: DEFAULTS.distortion,
  cornerRadius: DEFAULTS.cornerRadius,
  zRadius: DEFAULTS.zRadius,
  opacity: DEFAULTS.opacity,
  saturation: DEFAULTS.saturation,
  brightness: DEFAULTS.brightness,
  shadowOpacity: DEFAULTS.shadowOpacity,
  shadowSpread: DEFAULTS.shadowSpread,
  bevelMode: DEFAULTS.bevelMode,
};

// Update CSS custom properties on all .liquid-glass elements
function updateGlassStyles() {
  const glassElements = document.querySelectorAll('.liquid-glass') as NodeListOf<HTMLElement>;
  glassElements.forEach((el) => {
    el.style.setProperty('--lg-blur', String(settings.blurAmount));
    el.style.setProperty('--lg-refraction', String(settings.refraction));
    el.style.setProperty('--lg-chrom-aberration', String(settings.chromAberration));
    el.style.setProperty('--lg-edge-highlight', String(settings.edgeHighlight));
    el.style.setProperty('--lg-specular', String(settings.specular));
    el.style.setProperty('--lg-fresnel', String(settings.fresnel));
    el.style.setProperty('--lg-distortion', String(settings.distortion));
    el.style.setProperty('--lg-corner-radius', String(settings.cornerRadius));
    el.style.setProperty('--lg-z-radius', String(settings.zRadius));
    el.style.setProperty('--lg-opacity', String(settings.opacity));
    el.style.setProperty('--lg-saturation', String(settings.saturation));
    el.style.setProperty('--lg-brightness', String(settings.brightness));
    el.style.setProperty('--lg-shadow-opacity', String(settings.shadowOpacity));
    el.style.setProperty('--lg-shadow-spread', String(settings.shadowSpread));
    el.style.setProperty('--lg-bevel-mode', String(settings.bevelMode));
  });
}

const gui = new GUI({ title: 'Liquid Glass Controls' });

gui.add(settings, 'blurAmount', 0, 1, 0.01).name('Blur Amount').onChange(updateGlassStyles);
gui.add(settings, 'refraction', 0, 2, 0.01).name('Refraction').onChange(updateGlassStyles);
gui.add(settings, 'chromAberration', 0, 0.2, 0.01).name('Chrom. Aberration').onChange(updateGlassStyles);
gui.add(settings, 'edgeHighlight', 0, 0.5, 0.01).name('Edge Highlight').onChange(updateGlassStyles);
gui.add(settings, 'specular', 0, 1, 0.01).name('Specular').onChange(updateGlassStyles);
gui.add(settings, 'fresnel', 0, 3, 0.1).name('Fresnel').onChange(updateGlassStyles);
gui.add(settings, 'distortion', 0, 1, 0.01).name('Distortion').onChange(updateGlassStyles);
gui.add(settings, 'cornerRadius', 0, 100, 1).name('Corner Radius').onChange(updateGlassStyles);
gui.add(settings, 'zRadius', 0, 100, 1).name('Z-Radius').onChange(updateGlassStyles);
gui.add(settings, 'opacity', 0, 1, 0.01).name('Opacity').onChange(updateGlassStyles);
gui.add(settings, 'saturation', -1, 1, 0.01).name('Saturation').onChange(updateGlassStyles);
gui.add(settings, 'brightness', -1, 1, 0.01).name('Brightness').onChange(updateGlassStyles);
gui.add(settings, 'shadowOpacity', 0, 1, 0.01).name('Shadow Opacity').onChange(updateGlassStyles);
gui.add(settings, 'shadowSpread', 0, 50, 1).name('Shadow Spread').onChange(updateGlassStyles);
gui.add(settings, 'bevelMode', 0, 2, 1).name('Bevel Mode').onChange(updateGlassStyles);

// Initialize with current settings
updateGlassStyles();
