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

  /**
   * Renders all elements inside the canvas, applying glass effects to .liquid-glass elements.
   *
   * This is the simple API - it handles everything for you:
   * 1. Draws all non-glass elements normally
   * 2. For glass elements: captures background, applies effect, then draws content
   *
   * For more control, use renderGlassElements() instead and draw your own background first.
   */
  render(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W === 0 || H === 0 || !this.drawElementImage) return;

    this.ctx.reset();

    const dpr = window.devicePixelRatio || 1;
    const canvasRect = this.canvas.getBoundingClientRect();

    const allChildren = Array.from(this.canvas.children) as HTMLElement[];
    const glassElements = Array.from(this.canvas.querySelectorAll('.liquid-glass')) as HTMLElement[];
    const glassSet = new Set(glassElements);

    // Draw all non-glass elements first (they form the background)
    for (const child of allChildren) {
      if (!glassSet.has(child)) {
        const el = child as HTMLElement;
        const pos = this._getElementPosition(el, canvasRect);
        const x = pos.x * dpr;
        const y = pos.y * dpr;
        const transform = this.drawElementImage(child, x, y);
        if (transform) {
          el.style.transform = transform.toString();
        }
      }
    }

    // Apply glass effects to .liquid-glass elements
    for (const glassEl of glassElements) {
      this._renderGlassElement(glassEl as HTMLElement, canvasRect, dpr);
    }
  }

  /**
   * Renders only the .liquid-glass elements with glass effects.
   *
   * Use this when you want to draw your own background first:
   * ```
   * canvas.onpaint = () => {
   *   ctx.reset();
   *   ctx.drawElementImage(myBackground, 0, 0);
   *   ctx.drawElementImage(otherContent, x, y);
   *   liquidGlass.renderGlassElements(); // Apply glass effects on top
   * };
   * ```
   *
   * The method captures whatever is currently on the canvas as the background
   * for the glass blur/refraction effect.
   */
  renderGlassElements(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (W === 0 || H === 0 || !this.drawElementImage) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasRect = this.canvas.getBoundingClientRect();

    // Note: caller should have already scaled the context by DPR if needed
    const glassElements = this.canvas.querySelectorAll('.liquid-glass');
    for (const glassEl of glassElements) {
      this._renderGlassElement(glassEl as HTMLElement, canvasRect, dpr);
    }
  }

  /**
   * Computes element position from CSS styles since getBoundingClientRect
   * may not reflect CSS positioning for layoutsubtree canvas children.
   */
  private _getElementPosition(element: HTMLElement, canvasRect: DOMRect): { x: number; y: number; w: number; h: number } {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const canvasW = canvasRect.width;
    const canvasH = canvasRect.height;

    let x = 0;
    let y = 0;

    // Handle horizontal positioning
    const left = style.left;
    const right = style.right;
    const leftVal = parseFloat(left) || 0;
    const rightVal = parseFloat(right) || 0;

    // Check for centering: left: 0, right: 0 with auto margins centers the element
    // When both left and right are 0 (or equal), element is horizontally centered
    if (left !== 'auto' && right !== 'auto' && leftVal === 0 && rightVal === 0) {
      // Centered horizontally
      x = (canvasW - w) / 2;
    } else if (left !== 'auto' && left !== '') {
      x = leftVal + (parseFloat(style.marginLeft) || 0);
    } else if (right !== 'auto' && right !== '') {
      x = canvasW - w - rightVal - (parseFloat(style.marginRight) || 0);
    }

    // Handle vertical positioning
    const top = style.top;
    const bottom = style.bottom;
    const topVal = parseFloat(top) || 0;
    const bottomVal = parseFloat(bottom) || 0;

    // Check for vertical centering
    if (top !== 'auto' && bottom !== 'auto' && topVal === 0 && bottomVal === 0) {
      y = (canvasH - h) / 2;
    } else if (top !== 'auto' && top !== '') {
      y = topVal + (parseFloat(style.marginTop) || 0);
    } else if (bottom !== 'auto' && bottom !== '') {
      y = canvasH - h - bottomVal - (parseFloat(style.marginBottom) || 0);
    }

    return { x, y, w, h };
  }

  /**
   * Renders a glass element with the liquid glass effect.
   */
  private _renderGlassElement(element: HTMLElement, canvasRect: DOMRect, dpr: number): void {
    if (!this.drawElementImage) return;

    const config = this._getConfigFromCSS(element);
    const pos = this._getElementPosition(element, canvasRect);

    // Element position and size in CSS pixels
    const cssX = pos.x;
    const cssY = pos.y;
    const cssW = pos.w;
    const cssH = pos.h;

    // Convert to canvas pixel coordinates
    const canvasX = cssX * dpr;
    const canvasY = cssY * dpr;
    const canvasW = cssW * dpr;
    const canvasH = cssH * dpr;

    // Padded area for shadow (in canvas pixels)
    const padPx = SHADOW_PAD * dpr;
    const padX = canvasX - padPx;
    const padY = canvasY - padPx;
    const padW = canvasW + padPx * 2;
    const padH = canvasH + padPx * 2;

    // Capture the current canvas content behind where the glass will be
    this._captureRegion(padX, padY, padW, padH);

    // Run the glass shader
    this.renderer.resize(Math.round(padW), Math.round(padH));
    this.renderer.uploadAndBlur(this.sceneCanvas, 0, 0, Math.round(padW), Math.round(padH), config.blurAmount);
    this.renderer.clear();
    this.renderer.renderGlassPanel(config, cssW, cssH, dpr);

    // Draw the glass effect onto the canvas at canvas pixel coordinates
    this.ctx.drawImage(this.renderer.canvas, 0, 0, padW, padH, padX, padY, padW, padH);

    // Draw the element content on top
    const transform = this.drawElementImage(element, canvasX, canvasY);
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
