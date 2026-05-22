/**
 * Default configuration values for the liquid glass effect.
 */

export interface GlassConfig {
  blurAmount: number;
  refraction: number;
  chromAberration: number;
  edgeHighlight: number;
  specular: number;
  fresnel: number;
  distortion: number;
  cornerRadius: number;
  zRadius: number;
  opacity: number;
  saturation: number;
  tintStrength: number;
  brightness: number;
  shadowOpacity: number;
  shadowSpread: number;
  shadowOffsetY: number;
  bevelMode: number;
}

export const DEFAULTS: GlassConfig = {
  blurAmount: 0.0,
  refraction: 0.69,
  chromAberration: 0.05,
  edgeHighlight: 0.05,
  specular: 0.0,
  fresnel: 1.0,
  distortion: 0.0,
  cornerRadius: 65,
  zRadius: 40,
  opacity: 1.0,
  saturation: 0.0,
  tintStrength: 0.0,
  brightness: 0.0,
  shadowOpacity: 0.3,
  shadowSpread: 10,
  shadowOffsetY: 1,
  bevelMode: 0,
};

/** CSS custom property names mapped to config keys */
export const CSS_PROPERTY_MAP: Record<string, keyof GlassConfig> = {
  '--lg-blur': 'blurAmount',
  '--lg-refraction': 'refraction',
  '--lg-chrom-aberration': 'chromAberration',
  '--lg-edge-highlight': 'edgeHighlight',
  '--lg-specular': 'specular',
  '--lg-fresnel': 'fresnel',
  '--lg-distortion': 'distortion',
  '--lg-corner-radius': 'cornerRadius',
  '--lg-z-radius': 'zRadius',
  '--lg-opacity': 'opacity',
  '--lg-saturation': 'saturation',
  '--lg-tint': 'tintStrength',
  '--lg-brightness': 'brightness',
  '--lg-shadow-opacity': 'shadowOpacity',
  '--lg-shadow-spread': 'shadowSpread',
  '--lg-shadow-offset-y': 'shadowOffsetY',
  '--lg-bevel-mode': 'bevelMode',
};

/** Number of Gaussian blur passes */
export const BLUR_ITERATIONS = 6;

/** Extra padding around each panel for rendering the drop shadow (px) */
export const SHADOW_PAD = 20;
