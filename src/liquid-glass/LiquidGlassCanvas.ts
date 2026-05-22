/**
 * LiquidGlassCanvas — Integrates liquid glass effects with html-in-canvas.
 *
 * Detects elements with the `.liquid-glass` class inside a layoutsubtree canvas
 * and applies glass effects using CSS custom properties for configuration.
 */

import { GlassRenderer } from './GlassRenderer';
import { DEFAULTS, CSS_PROPERTY_MAP, SHADOW_PAD } from './defaults';
import type { GlassConfig } from './defaults';

export { DEFAULTS, CSS_PROPERTY_MAP, SHADOW_PAD };
export type { GlassConfig };

type DrawElementImageFn = (element: Element, dx: number, dy: number) => DOMMatrix | undefined;

export class LiquidGlassCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private readonly renderer: GlassRenderer;
  private readonly sceneCanvas: HTMLCanvasElement;
  private readonly sceneCtx: CanvasRenderingContext2D;
  private readonly drawElementImage: DrawElementImageFn | null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new GlassRenderer();
    this.sceneCanvas = document.createElement('canvas');
    this.sceneCtx = this.sceneCanvas.getContext('2d')!;

    const ctx = this.ctx as CanvasRenderingContext2D & {
      drawElementImage?: DrawElementImageFn;
      drawElement?: DrawElementImageFn;
    };
    this.drawElementImage = ctx.drawElementImage?.bind(ctx) ?? ctx.drawElement?.bind(ctx) ?? null;
  }

  render(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W === 0 || H === 0 || !this.drawElementImage) return;

    this.ctx.reset();

    const allChildren = Array.from(this.canvas.children) as HTMLElement[];
    const glassElements = Array.from(this.canvas.querySelectorAll('.liquid-glass')) as HTMLElement[];
    const glassSet = new Set(glassElements);

    // Step 1: Draw all non-glass elements first (background)
    for (const child of allChildren) {
      if (!glassSet.has(child)) {
        this._drawElementAt(child, 0, 0);
      }
    }

    // Step 2: For each glass element, capture background + apply effect + draw content
    for (const glassEl of glassElements) {
      const config = this._getConfigFromCSS(glassEl);
      const rect = glassEl.getBoundingClientRect();
      const elW = rect.width;
      const elH = rect.height;

      // Center position in canvas
      const cx = (W - elW) / 2;
      const cy = (H - elH) / 2;

      // Padded area for shadow
      const padX = cx - SHADOW_PAD;
      const padY = cy - SHADOW_PAD;
      const padW = elW + SHADOW_PAD * 2;
      const padH = elH + SHADOW_PAD * 2;

      // Capture the background behind where the glass will be
      this._captureRegion(padX, padY, padW, padH);

      // Run the glass shader
      this.renderer.resize(Math.round(padW), Math.round(padH));
      this.renderer.uploadAndBlur(this.sceneCanvas, 0, 0, Math.round(padW), Math.round(padH), config.blurAmount);
      this.renderer.clear();
      this.renderer.renderGlassPanel(config, elW, elH, 1);

      // Draw the glass effect
      this.ctx.drawImage(this.renderer.canvas, 0, 0, padW, padH, padX, padY, padW, padH);

      // Draw the glass content on top
      const transform = this.drawElementImage(glassEl, cx, cy);
      if (transform) {
        glassEl.style.transform = transform.toString();
      }
    }
  }

  private _drawElementAt(element: HTMLElement, offsetX: number, offsetY: number): void {
    if (!this.drawElementImage) return;
    const transform = this.drawElementImage(element, offsetX, offsetY);
    if (transform) {
      element.style.transform = transform.toString();
    }
  }

  private _captureRegion(x: number, y: number, w: number, h: number): void {
    const rw = Math.round(w);
    const rh = Math.round(h);

    if (this.sceneCanvas.width !== rw || this.sceneCanvas.height !== rh) {
      this.sceneCanvas.width = rw;
      this.sceneCanvas.height = rh;
    }

    // Fill with white first (fallback)
    this.sceneCtx.fillStyle = '#ffffff';
    this.sceneCtx.fillRect(0, 0, rw, rh);

    // Copy the region from the main canvas
    this.sceneCtx.drawImage(this.canvas, x, y, w, h, 0, 0, rw, rh);
  }

  private _getConfigFromCSS(element: HTMLElement): GlassConfig {
    const style = getComputedStyle(element);
    const config = { ...DEFAULTS };

    for (const [cssVar, configKey] of Object.entries(CSS_PROPERTY_MAP)) {
      const value = style.getPropertyValue(cssVar).trim();
      if (value) {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          (config as Record<string, number>)[configKey] = num;
        }
      }
    }

    return config;
  }

  destroy(): void {
    this.renderer.destroy();
  }
}
