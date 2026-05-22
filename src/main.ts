import { LiquidGlassCanvas } from './liquid-glass';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Initialize liquid glass renderer
const lg = new LiquidGlassCanvas(canvas);

// Check if drawElementImage is supported
const hasDrawElementImage = !!(ctx as CanvasRenderingContext2D & {
  drawElementImage?: unknown;
  drawElement?: unknown;
}).drawElementImage ?? !!(ctx as CanvasRenderingContext2D & {
  drawElement?: unknown;
}).drawElement;

// Continuous render loop - needed to pick up CSS changes in real-time
function renderLoop() {
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

  (canvas as HTMLCanvasElement & { requestPaint?: () => void }).requestPaint?.();
  requestAnimationFrame(renderLoop);
}

requestAnimationFrame(renderLoop);

// Handle canvas resize
let currentWidth = 0;
let currentHeight = 0;

new ResizeObserver(([entry]) => {
  const newWidth = Math.round(entry.contentRect.width);
  const newHeight = Math.round(entry.contentRect.height);

  // Only resize if dimensions actually changed
  if (newWidth !== currentWidth || newHeight !== currentHeight) {
    currentWidth = newWidth;
    currentHeight = newHeight;
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Immediately render to avoid flicker
    if (hasDrawElementImage) {
      lg.render();
      (canvas as HTMLCanvasElement & { requestPaint?: () => void }).requestPaint?.();
    }
  }
}).observe(canvas);
