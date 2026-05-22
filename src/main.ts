import { mountMacBookScene } from './macbook-scene';
import { LiquidGlassCanvas } from './liquid-glass';
import { mountLiquidGlassGui } from './liquid-glass-gui';

const sceneRoot = document.getElementById('scene-root');
const htmlSource = document.getElementById('html-source');

if (!sceneRoot || !(htmlSource instanceof HTMLCanvasElement)) {
  throw new Error('Missing scene root or html-source element');
}

const sceneContainer: HTMLElement = sceneRoot;
const sourceCanvas: HTMLCanvasElement = htmlSource;

const lg = new LiquidGlassCanvas(sourceCanvas);
mountLiquidGlassGui(sourceCanvas);

async function init() {
  const success = await lg.waitForInit();
  
  const dpr = window.devicePixelRatio || 1;
  const baseWidth = 1536;
  const baseHeight = 1024;
  
  // Set physical pixels based on DPR for high-quality rendering
  sourceCanvas.width = baseWidth * dpr;
  sourceCanvas.height = baseHeight * dpr;
  
  // Keep CSS size at the base dimensions
  sourceCanvas.style.width = `${baseWidth}px`;
  sourceCanvas.style.height = `${baseHeight}px`;

  if (success) {
    (sourceCanvas as HTMLCanvasElement & { onpaint?: () => void }).onpaint = () => {
      lg.render();
    };
  } else {
    console.error('LiquidGlass: WebGPU not available, falling back to native rendering');
  }

  // Ensure the background image is loaded to avoid "No cached paint record"
  const bgImg = new Image();
  bgImg.src = '/assets/background.png';
  await bgImg.decode().catch(() => {});

  // Give the browser a moment to stabilize the layout/paint cache for the experimental API
  await new Promise((resolve) => setTimeout(resolve, 100));

  mountMacBookScene(sceneContainer, sourceCanvas);

  // Kickstart the paint loop
  function loop() {
    if ((sourceCanvas as any).requestPaint) {
      (sourceCanvas as any).requestPaint();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

init();
