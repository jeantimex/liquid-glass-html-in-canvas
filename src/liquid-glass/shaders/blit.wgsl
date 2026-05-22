// Blit shader - copy texture with UV transform

struct BlitUniforms {
  scale: vec2f,
  offset: vec2f,
}

@group(0) @binding(0) var<uniform> u: BlitUniforms;
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
  return textureSample(tex, texSampler, in.uv * u.scale + u.offset);
}
