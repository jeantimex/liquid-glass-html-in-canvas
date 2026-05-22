/**
 * LiquidGlassCanvas — Integrates liquid glass effects with html-in-canvas.
 *
 * Detects elements with the `.liquid-glass` class inside a layoutsubtree canvas
 * and applies glass effects using CSS custom properties for configuration.
 *
 * Uses WebGPU for rendering.
 */

import { GlassRendererGPU } from './GlassRendererGPU';
import { DEFAULTS, CSS_PROPERTY_MAP, SHADOW_PAD } from './defaults';
import type { GlassConfig } from './defaults';

export { DEFAULTS, CSS_PROPERTY_MAP, SHADOW_PAD };
export type { GlassConfig };

type DrawElementImageFn = (element: Element, dx: number, dy: number) => DOMMatrix | undefined;

export class LiquidGlassCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private renderer: GlassRendererGPU;
  private readonly sceneCanvas: HTMLCanvasElement;
  private readonly sceneCtx: CanvasRenderingContext2D;
  private readonly drawElementImage: DrawElementImageFn | null;
  private _initPromise: Promise<boolean>;
  private _initialized = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new GlassRendererGPU();
    this.sceneCanvas = document.createElement('canvas');
    this.sceneCtx = this.sceneCanvas.getContext('2d')!;

    const ctx = this.ctx as CanvasRenderingContext2D & {
      drawElementImage?: DrawElementImageFn;
      drawElement?: DrawElementImageFn;
    };
    this.drawElementImage = ctx.drawElementImage?.bind(ctx) ?? ctx.drawElement?.bind(ctx) ?? null;

    this._initPromise = this._initWebGPU();
  }

  private async _initWebGPU(): Promise<boolean> {
    try {
      const success = await this.renderer.init();
      if (success) {
        this._initialized = true;
        console.log('LiquidGlass: WebGPU renderer initialized');
        return true;
      } else {
        console.error('LiquidGlass: WebGPU not available');
        return false;
      }
    } catch (e) {
      console.error('LiquidGlass: WebGPU init failed', e);
      return false;
    }
  }

  /**
   * Returns true if WebGPU is initialized and ready.
   */
  get isReady(): boolean {
    return this._initialized;
  }

  /**
   * Wait for WebGPU initialization to complete.
   */
  async waitForInit(): Promise<boolean> {
    return this._initPromise;
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
    if (W === 0 || H === 0 || !this.drawElementImage || !this._initialized) return;

    // IMPORTANT: Clear the canvas with a clean transparent slate
    this.ctx.clearRect(0, 0, W, H);

    const dpr = window.devicePixelRatio || 1;
    const canvasRect = this.canvas.getBoundingClientRect();

    const allChildren = Array.from(this.canvas.children) as HTMLElement[];
    const glassElements = Array.from(this.canvas.querySelectorAll('.liquid-glass')) as HTMLElement[];
    const glassSet = new Set(glassElements);

    if (allChildren.length === 0 && !(this as any).__lg_warn_empty) {
      console.warn('LiquidGlass: No children found inside the canvas to render.');
      (this as any).__lg_warn_empty = true;
    }

    // Draw all non-glass elements first (they form the background)
    for (const child of allChildren) {
      if (!glassSet.has(child)) {
        const el = child as HTMLElement;
        const pos = this._getElementPosition(el, canvasRect);
        
        // Skip elements with zero size
        if (pos.w <= 0 || pos.h <= 0) continue;

        const x = pos.x * dpr;
        const y = pos.y * dpr;

        try {
          const transform = this.drawElementImage(child, x, y);
          if (transform) {
            el.style.transform = transform.toString();
          }
        } catch (e: any) {
          // Log only once per element to avoid flooding
          if (!(child as any).__lg_error_logged) {
            console.warn(`LiquidGlass: Failed to draw background element ${child.tagName}.${child.className}:`, e.message || e);
            (child as any).__lg_error_logged = true;
          }
        }
      }
    }

    // Apply glass effects to .liquid-glass elements
    // Even if background elements failed, we must try to render the glass panels
    for (const glassEl of glassElements) {
      try {
        this._renderGlassElement(glassEl as HTMLElement, canvasRect, dpr);
      } catch (e: any) {
        if (!(glassEl as any).__lg_error_logged_glass) {
          console.error(`LiquidGlass: Failed to render glass effect for ${glassEl.tagName}.${glassEl.className}:`, e.message || e);
          (glassEl as any).__lg_error_logged_glass = true;
        }
      }
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
    if (W === 0 || H === 0 || !this.drawElementImage || !this._initialized) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasRect = this.canvas.getBoundingClientRect();

    const glassElements = this.canvas.querySelectorAll('.liquid-glass');
    for (const glassEl of glassElements) {
      this._renderGlassElement(glassEl as HTMLElement, canvasRect, dpr);
    }
  }

  /**
   * Parses a CSS length value, supporting px, %, and calc().
   */
  private _parseCSSLength(value: string, reference: number): number {
    if (!value || value === 'auto') return NaN;

    value = value.trim();

    // Handle calc() expressions
    if (value.startsWith('calc(')) {
      return this._parseCalc(value, reference);
    }

    // Handle percentage
    if (value.endsWith('%')) {
      return (parseFloat(value) / 100) * reference;
    }

    // Handle pixel values (or other units that parseFloat can handle)
    return parseFloat(value) || 0;
  }

  /**
   * Parses a basic calc() expression like calc(50% - 20px) or calc(100% - 50px).
   */
  private _parseCalc(calc: string, reference: number): number {
    // Extract the expression inside calc()
    const match = calc.match(/calc\((.+)\)/);
    if (!match) return 0;

    const expr = match[1].trim();

    // Handle simple expressions: value1 +/- value2
    const addMatch = expr.match(/(.+)\s*\+\s*(.+)/);
    const subMatch = expr.match(/(.+)\s*-\s*(.+)/);

    if (subMatch) {
      const left = this._parseCSSLength(subMatch[1].trim(), reference);
      const right = this._parseCSSLength(subMatch[2].trim(), reference);
      return left - right;
    }

    if (addMatch) {
      const left = this._parseCSSLength(addMatch[1].trim(), reference);
      const right = this._parseCSSLength(addMatch[2].trim(), reference);
      return left + right;
    }

    // Single value
    return this._parseCSSLength(expr, reference);
  }

  /**
   * Parses CSS transform to extract translate values.
   * Supports translate(), translateX(), translateY(), translate3d().
   */
  private _parseTransform(transform: string, elementW: number, elementH: number): { tx: number; ty: number } {
    let tx = 0;
    let ty = 0;

    if (!transform || transform === 'none') return { tx, ty };

    // Handle translate(x, y) or translate(x)
    const translateMatch = transform.match(/translate\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/);
    if (translateMatch) {
      tx = this._parseTranslateValue(translateMatch[1], elementW);
      ty = translateMatch[2] ? this._parseTranslateValue(translateMatch[2], elementH) : 0;
    }

    // Handle translateX(x)
    const translateXMatch = transform.match(/translateX\(\s*([^)]+)\s*\)/);
    if (translateXMatch) {
      tx = this._parseTranslateValue(translateXMatch[1], elementW);
    }

    // Handle translateY(y)
    const translateYMatch = transform.match(/translateY\(\s*([^)]+)\s*\)/);
    if (translateYMatch) {
      ty = this._parseTranslateValue(translateYMatch[1], elementH);
    }

    // Handle translate3d(x, y, z)
    const translate3dMatch = transform.match(/translate3d\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*[^)]+\s*\)/);
    if (translate3dMatch) {
      tx = this._parseTranslateValue(translate3dMatch[1], elementW);
      ty = this._parseTranslateValue(translate3dMatch[2], elementH);
    }

    return { tx, ty };
  }

  /**
   * Parses a translate value, handling percentages (relative to element size).
   */
  private _parseTranslateValue(value: string, elementSize: number): number {
    value = value.trim();
    if (value.endsWith('%')) {
      return (parseFloat(value) / 100) * elementSize;
    }
    return parseFloat(value) || 0;
  }

  /**
   * Computes element position from CSS styles.
   *
   * NOTE: This is a workaround for the experimental html-in-canvas API.
   * Currently, getBoundingClientRect() returns (0, 0) for all elements inside
   * a layoutsubtree canvas. When the API matures and reports correct positions,
   * this method can be simplified to just use getBoundingClientRect().
   *
   * Supports:
   * - top, bottom, left, right (px and %)
   * - margin (px)
   * - calc() expressions (basic add/subtract)
   * - transform: translate() for positioning adjustments
   * - Centering with left: 0; right: 0; margin: auto
   *
   * Not supported (would require reimplementing CSS layout engine):
   * - Flexbox positioning
   * - Grid positioning
   * - Complex calc() expressions
   */
  private _getElementPosition(element: HTMLElement, _canvasRect: DOMRect): { x: number; y: number; w: number; h: number } {
    const style = getComputedStyle(element);
    
    // Use the canvas CSS dimensions for layout math (DPR-independent)
    const canvasW = parseFloat(getComputedStyle(this.canvas).width) || this.canvas.width || 1536;
    const canvasH = parseFloat(getComputedStyle(this.canvas).height) || this.canvas.height || 1024;

    // We still need the element's size. If getBoundingClientRect is 0,0 due to the layoutsubtree,
    // we fallback to computed styles.
    const rect = element.getBoundingClientRect();
    const w = rect.width || parseFloat(style.width) || 0;
    const h = rect.height || parseFloat(style.height) || 0;

    let x = 0;
    let y = 0;

    // Get raw CSS values (not computed) for percentage detection
    const inlineStyle = element.style;
    const leftRaw = inlineStyle.left || style.left;
    const rightRaw = inlineStyle.right || style.right;
    const topRaw = inlineStyle.top || style.top;
    const bottomRaw = inlineStyle.bottom || style.bottom;

    // Parse position values
    const leftVal = this._parseCSSLength(leftRaw, canvasW);
    const rightVal = this._parseCSSLength(rightRaw, canvasW);
    const topVal = this._parseCSSLength(topRaw, canvasH);
    const bottomVal = this._parseCSSLength(bottomRaw, canvasH);

    const marginLeft = parseFloat(style.marginLeft) || 0;
    const marginRight = parseFloat(style.marginRight) || 0;
    const marginTop = parseFloat(style.marginTop) || 0;
    const marginBottom = parseFloat(style.marginBottom) || 0;

    // Handle horizontal positioning
    const hasLeft = !isNaN(leftVal);
    const hasRight = !isNaN(rightVal);

    // Check for centering: left: 0, right: 0 (or both equal) with auto margins
    if (hasLeft && hasRight && leftVal === 0 && rightVal === 0) {
      x = (canvasW - w) / 2;
    } else if (hasLeft && hasRight) {
      // Both left and right specified - element stretches, position from left
      x = leftVal + marginLeft;
    } else if (hasLeft) {
      x = leftVal + marginLeft;
    } else if (hasRight) {
      x = canvasW - w - rightVal - marginRight;
    }

    // Handle vertical positioning
    const hasTop = !isNaN(topVal);
    const hasBottom = !isNaN(bottomVal);

    // Check for vertical centering
    if (hasTop && hasBottom && topVal === 0 && bottomVal === 0) {
      y = (canvasH - h) / 2;
    } else if (hasTop && hasBottom) {
      // Both top and bottom specified - element stretches, position from top
      y = topVal + marginTop;
    } else if (hasTop) {
      y = topVal + marginTop;
    } else if (hasBottom) {
      y = canvasH - h - bottomVal - marginBottom;
    }

    // Apply CSS transform translate if present
    const { tx, ty } = this._parseTransform(style.transform, w, h);
    x += tx;
    y += ty;

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

    const renderW = Math.round(padW);
    const renderH = Math.round(padH);

    // Run the glass shader. The renderer owns size/cache management; forcing a
    // resize here invalidates GPU resources every paint and causes resize flicker.
    this.renderer.clear();
    this.renderer.uploadAndBlur(this.sceneCanvas, 0, 0, renderW, renderH, config.blurAmount);
    this.renderer.renderGlassPanel(config, cssW, cssH, dpr);

    // Draw the glass effect onto the canvas at canvas pixel coordinates
    this.ctx.drawImage(this.renderer.canvas, 0, 0, padW, padH, padX, padY, padW, padH);

    // Draw the element content on top
    try {
      const transform = this.drawElementImage(element, canvasX, canvasY);
      if (transform) {
        element.style.transform = transform.toString();
      }
    } catch (e) {
      if (!(element as any).__lg_error_logged) {
        console.warn(`LiquidGlass: Failed to draw glass element ${element.tagName}.${element.className}:`, e);
        (element as any).__lg_error_logged = true;
      }
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
