import { LiquidGlassCanvas } from './liquid-glass';

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
  const cssW = canvas.width;
  const cssH = canvas.height;

  if (cssW > 0 && cssH > 0) {
    if (hasDrawElementImage) {
      lg.render();
    } else {
      ctx.reset();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('drawElementImage() not supported', cssW / 2, cssH / 2 - 10);
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText('Enable chrome://flags/#enable-experimental-web-platform-features', cssW / 2, cssH / 2 + 20);
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
    // requestPaint will trigger onpaint which does the actual rendering
    (canvas as ExtendedCanvas).requestPaint?.();
  }
}).observe(canvas, { box: 'device-pixel-content-box' });
