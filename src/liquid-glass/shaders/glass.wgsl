// Glass shader - the core liquid glass effect

struct GlassUniforms {
  center: vec2f,
  size: vec2f,
  res: vec2f,
  radius: f32,
  pad: f32,
  refract: f32,
  chroma: f32,
  edgeHL: f32,
  spec: f32,
  fresnel: f32,
  distort: f32,
  alpha: f32,
  sat: f32,
  tint: f32,
  zRadius: f32,
  brightness: f32,
  shadowAlpha: f32,
  shadowSpread: f32,
  shadowOffY: f32,
  bevelMode: f32,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> u: GlassUniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var bgTex: texture_2d<f32>;
@group(0) @binding(3) var blurTex: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) localPx: vec2f,
  @location(1) screenUV: vec2f,
}

@vertex
fn vertexMain(@location(0) pos: vec2f) -> VertexOutput {
  var out: VertexOutput;
  let total = u.size + vec2f(u.pad * 2.0);
  out.localPx = pos * total;
  let px = u.center + pos * total;
  out.screenUV = vec2f(px.x / u.res.x, 1.0 - px.y / u.res.y);
  var ndc = (px / u.res) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  out.position = vec4f(ndc, 0.0, 1.0);
  return out;
}

// Rounded-rect signed distance
fn rrSDF(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

// Bevel height field
fn bevelHeight(d: f32, zR: f32) -> f32 {
  if (d <= 0.0) { return 0.0; }
  if (d >= zR) { return zR; }
  return sqrt(d * (2.0 * zR - d));
}

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
  let half_ = u.size * 0.5;
  let r = min(u.radius, min(half_.x, half_.y));
  let sdf = rrSDF(in.localPx, half_, r);

  // Anti-aliased mask
  let mask = 1.0 - smoothstep(-1.5, 0.5, sdf);

  let maxD = min(half_.x, half_.y);
  let inside = -sdf;
  let edge = smoothstep(maxD * 0.35, 0.0, inside);

  // Surface normal via bevel height field
  let zR = u.zRadius;
  let e = 2.0;
  let dC = inside;
  let dR = -rrSDF(in.localPx + vec2f(e, 0.0), half_, r);
  let dL = -rrSDF(in.localPx - vec2f(e, 0.0), half_, r);
  let dU = -rrSDF(in.localPx + vec2f(0.0, e), half_, r);
  let dD = -rrSDF(in.localPx - vec2f(0.0, e), half_, r);
  let hC = bevelHeight(dC, zR);
  let hR = bevelHeight(dR, zR);
  let hL = bevelHeight(dL, zR);
  let hU = bevelHeight(dU, zR);
  let hD = bevelHeight(dD, zR);
  let hGrad = vec2f(hR - hL, hU - hD) / (2.0 * e);
  let N = normalize(vec3f(-hGrad, 1.0));

  let depth = smoothstep(0.0, zR, inside);

  // Refraction - compute both modes and select
  let pxToUV = vec2f(1.0, -1.0) / u.res;
  let ior = 1.5;
  let refrPow = 1.0 - 1.0 / ior;
  let thickness = hC * 2.0;
  let thickNorm = thickness / max(zR * 2.0, 1.0);

  // Biconvex mode
  let exitRefr = hGrad * refrPow;
  let entryRefr = hGrad * refrPow;
  let throughRefr = entryRefr * thickNorm * 0.5;
  var refrPxBiconvex = (exitRefr + entryRefr + throughRefr) * u.refract * 30.0;
  let centerDir = -in.localPx / max(half_, vec2f(1.0));
  refrPxBiconvex += centerDir * u.refract * 4.0 * depth;

  // Dome mode
  let refrPxDome = -in.localPx * u.refract * depth * 0.35;

  // Select based on bevel mode
  let refrPx = select(refrPxBiconvex, refrPxDome, u.bevelMode >= 0.5);
  let refr = refrPx * pxToUV;

  // Micro-distortion noise
  let ns = in.localPx * 0.08;
  let absPxToUV = vec2f(1.0) / u.res;
  let micro = (vec2f(hash(ns), hash(ns + vec2f(37.0))) - 0.5) * u.distort * 4.0 * absPxToUV;

  // Chromatic aberration
  let caS = u.chroma * 18.0 * (edge * 0.7 + 0.3) * 2.0;
  let caD = N.xy * caS * pxToUV;
  let base = in.screenUV + refr + micro;

  // Sample textures (must be in uniform control flow)
  let sharpR = textureSample(bgTex, texSampler, base + caD).r;
  let sharpG = textureSample(bgTex, texSampler, base).g;
  let sharpB = textureSample(bgTex, texSampler, base - caD).b;
  let sharp = vec3f(sharpR, sharpG, sharpB);

  let blurR = textureSample(blurTex, texSampler, base + caD).r;
  let blurG = textureSample(blurTex, texSampler, base).g;
  let blurB = textureSample(blurTex, texSampler, base - caD).b;
  let blur = vec3f(blurR, blurG, blurB);

  // Edge-weighted blur mix
  let edgeMix = 1.0 - edge * 0.15;
  var col = mix(sharp, blur, edgeMix);

  // Brightness
  col *= 1.0 + u.brightness;

  // Saturation
  let lum = dot(col, vec3f(0.299, 0.587, 0.114));
  col = mix(vec3f(lum), col, 1.0 + u.sat);

  // Cool glass tint
  col = mix(col, col * vec3f(0.92, 0.95, 1.05), u.tint);
  col *= 1.0 + 0.06 * depth;

  // Fresnel
  let fres = pow(1.0 - abs(N.z), 4.0) * u.fresnel;

  // Specular highlights (multi-light Blinn-Phong)
  let V = vec3f(0.0, 0.0, 1.0);
  let L1 = normalize(vec3f(0.4, 0.7, 1.0));
  let H1 = normalize(L1 + V);
  let sp1 = pow(max(dot(N, H1), 0.0), 90.0);
  let L2 = normalize(vec3f(-0.3, -0.5, 1.0));
  let H2 = normalize(L2 + V);
  let sp2 = pow(max(dot(N, H2), 0.0), 50.0) * 0.3;
  let L3 = normalize(vec3f(0.1, 0.3, 1.0));
  let spB = pow(max(dot(N, L3), 0.0), 6.0) * 0.1;
  let L4 = normalize(vec3f(0.0, 0.9, 0.4));
  let H4 = normalize(L4 + V);
  let sp4 = pow(max(dot(N, H4), 0.0), 120.0) * 0.6;
  let totalSpec = (sp1 + sp2 + spB + sp4) * u.spec;

  // Inner border / stroke highlight
  let borderWidth = 1.5;
  let innerStroke = smoothstep(-borderWidth - 1.0, -borderWidth, sdf)
                  * (1.0 - smoothstep(-1.0, 0.0, sdf));
  let topBias = 0.5 + 0.5 * (-in.localPx.y / half_.y);
  let innerStrokeFinal = innerStroke * (0.4 + 0.6 * topBias);

  // Edge highlight & inner glow
  let rim = edge * u.edgeHL * 0.22;
  let innerGlow = smoothstep(5.0, 0.0, -sdf) * u.edgeHL * 0.15;

  // Environment-like reflection (fake)
  let envRefl = (N.y * 0.5 + 0.5) * fres * 0.08;

  // Composite glass effect
  var fin = col;
  fin += vec3f(totalSpec);
  fin += vec3f(rim + innerGlow);
  fin += vec3f(innerStrokeFinal * u.edgeHL * 0.55);
  fin += vec3f(envRefl);
  fin = mix(fin, vec3f(1.0), fres * 0.2);

  // Shadow calculation (outside panel)
  let sdfShadow = rrSDF(in.localPx - vec2f(0.0, u.shadowOffY), half_, r);
  let shadowD = max(sdfShadow - 1.0, 0.0);
  let spread = max(u.shadowSpread, 1.0);
  let falloff = 1.0 / (spread * spread);
  let outerShadow = exp(-shadowD * shadowD * falloff) * 0.65;
  let contactShadow = exp(-shadowD * 0.08 / max(spread * 0.04, 0.01)) * 0.35;
  let shadow = (outerShadow + contactShadow) * u.shadowAlpha;

  // Select between shadow (outside) and glass (inside)
  let isOutside = sdf > 0.0;
  let finalColor = select(fin, vec3f(0.0), isOutside);
  let finalAlpha = select(mask * u.alpha, shadow, isOutside);

  return vec4f(finalColor, finalAlpha);
}
