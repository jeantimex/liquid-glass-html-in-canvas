import { mountMacBookScene } from './macbook-scene';
import { LiquidGlassCanvas } from './liquid-glass';

const sceneRoot = document.getElementById('scene-root');
const htmlSource = document.getElementById('html-source') as HTMLCanvasElement;

if (!sceneRoot || !htmlSource) {
  throw new Error('Missing scene root or html-source element');
}

const lg = new LiquidGlassCanvas(htmlSource);

async function init() {
  const success = await lg.waitForInit();
  
  const dpr = window.devicePixelRatio || 1;
  const baseWidth = 1536;
  const baseHeight = 1024;
  
  // Set physical pixels based on DPR for high-quality rendering
  htmlSource.width = baseWidth * dpr;
  htmlSource.height = baseHeight * dpr;
  
  // Keep CSS size at the base dimensions
  htmlSource.style.width = `${baseWidth}px`;
  htmlSource.style.height = `${baseHeight}px`;

  if (success) {
    htmlSource.onpaint = () => {
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

  mountMacBookScene(sceneRoot, htmlSource);

  // Kickstart the paint loop
  function loop() {
    if ((htmlSource as any).requestPaint) {
      (htmlSource as any).requestPaint();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

init();
