import GUI from 'lil-gui';
import '../node_modules/lil-gui/dist/lil-gui.css';
import { CSS_PROPERTY_MAP, DEFAULTS } from './liquid-glass';
import type { GlassConfig } from './liquid-glass';

const CSS_VAR_BY_CONFIG = Object.fromEntries(
  Object.entries(CSS_PROPERTY_MAP).map(([cssVar, configKey]) => [configKey, cssVar]),
) as Record<keyof GlassConfig, string>;

const CONTROL_RANGES: Record<keyof GlassConfig, { min: number; max: number; step: number }> = {
  blurAmount: { min: 0, max: 1, step: 0.01 },
  refraction: { min: 0, max: 1.5, step: 0.01 },
  chromAberration: { min: 0, max: 0.25, step: 0.005 },
  edgeHighlight: { min: 0, max: 1, step: 0.01 },
  specular: { min: 0, max: 1, step: 0.01 },
  fresnel: { min: 0, max: 2, step: 0.01 },
  distortion: { min: 0, max: 1, step: 0.01 },
  cornerRadius: { min: 0, max: 120, step: 1 },
  zRadius: { min: 0, max: 120, step: 1 },
  opacity: { min: 0, max: 1, step: 0.01 },
  saturation: { min: -1, max: 1, step: 0.01 },
  tintStrength: { min: 0, max: 1, step: 0.01 },
  brightness: { min: -0.5, max: 0.5, step: 0.01 },
  shadowOpacity: { min: 0, max: 1, step: 0.01 },
  shadowSpread: { min: 0, max: 80, step: 1 },
  shadowOffsetY: { min: -20, max: 40, step: 1 },
  bevelMode: { min: 0, max: 1, step: 1 },
};

const CONTROL_LABELS: Record<keyof GlassConfig, string> = {
  blurAmount: 'Blur',
  refraction: 'Refraction',
  chromAberration: 'Chroma',
  edgeHighlight: 'Edge Highlight',
  specular: 'Specular',
  fresnel: 'Fresnel',
  distortion: 'Distortion',
  cornerRadius: 'Corner Radius',
  zRadius: 'Z Radius',
  opacity: 'Opacity',
  saturation: 'Saturation',
  tintStrength: 'Tint',
  brightness: 'Brightness',
  shadowOpacity: 'Shadow Opacity',
  shadowSpread: 'Shadow Spread',
  shadowOffsetY: 'Shadow Y',
  bevelMode: 'Bevel Mode',
};

export function mountLiquidGlassGui(target: HTMLElement): () => void {
  const settings: GlassConfig = { ...DEFAULTS };
  const gui = new GUI({ title: 'Liquid Glass' });
  const originalInlineOverrides = new WeakMap<HTMLElement, Set<keyof GlassConfig>>();

  const getGlassElements = () => Array.from(target.querySelectorAll<HTMLElement>('.liquid-glass'));

  const getOriginalOverrides = (element: HTMLElement) => {
    let overrides = originalInlineOverrides.get(element);
    if (overrides) return overrides;

    overrides = new Set<keyof GlassConfig>();
    for (const key of Object.keys(settings) as Array<keyof GlassConfig>) {
      if (element.style.getPropertyValue(CSS_VAR_BY_CONFIG[key]).trim()) {
        overrides.add(key);
      }
    }
    originalInlineOverrides.set(element, overrides);
    return overrides;
  };

  const requestPaint = () => {
    const canvas = target as HTMLCanvasElement & { requestPaint?: () => void };
    canvas.requestPaint?.();
  };

  const apply = (key: keyof GlassConfig) => {
    const cssVar = CSS_VAR_BY_CONFIG[key];
    target.style.setProperty(cssVar, String(settings[key]));

    for (const element of getGlassElements()) {
      if (!getOriginalOverrides(element).has(key)) {
        element.style.setProperty(cssVar, String(settings[key]));
      }
    }

    requestPaint();
  };

  const applyAll = () => {
    for (const key of Object.keys(settings) as Array<keyof GlassConfig>) {
      apply(key);
    }
  };

  applyAll();

  for (const key of Object.keys(settings) as Array<keyof GlassConfig>) {
    const range = CONTROL_RANGES[key];
    gui.add(settings, key, range.min, range.max, range.step).name(CONTROL_LABELS[key]).onChange(() => apply(key));
  }

  gui.add({ reset: () => {
    Object.assign(settings, DEFAULTS);
    applyAll();
    gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  } }, 'reset').name('Reset Defaults');

  return () => gui.destroy();
}
