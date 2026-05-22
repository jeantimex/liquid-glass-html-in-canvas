// Blur shader - 9-tap Gaussian blur (single direction)

struct BlurUniforms {
  dir: vec2f,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> u: BlurUniforms;
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@location(0) pos: vec2f) -> VertexOutput {
  var out: VertexOutput;
  out.uv = pos * 0.5 + 0.5;
  out.position = vec4f(pos, 0.0, 1.0);
  return out;
}

@fragment
fn fragmentMain(in: VertexOutput) -> @location(0) vec4f {
  var s = textureSample(tex, texSampler, in.uv) * 0.227027;
  s += textureSample(tex, texSampler, in.uv + u.dir * 1.0) * 0.194594;
  s += textureSample(tex, texSampler, in.uv - u.dir * 1.0) * 0.194594;
  s += textureSample(tex, texSampler, in.uv + u.dir * 2.0) * 0.121622;
  s += textureSample(tex, texSampler, in.uv - u.dir * 2.0) * 0.121622;
  s += textureSample(tex, texSampler, in.uv + u.dir * 3.0) * 0.054054;
  s += textureSample(tex, texSampler, in.uv - u.dir * 3.0) * 0.054054;
  s += textureSample(tex, texSampler, in.uv + u.dir * 4.0) * 0.016216;
  s += textureSample(tex, texSampler, in.uv - u.dir * 4.0) * 0.016216;
  return s;
}
