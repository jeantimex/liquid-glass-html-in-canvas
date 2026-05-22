/**
 * GlassRendererGPU — WebGPU rendering pipeline for the liquid glass effect.
 */

import SHADER_BLIT from './shaders/blit.wgsl?raw';
import SHADER_BLUR from './shaders/blur.wgsl?raw';
import SHADER_GLASS from './shaders/glass.wgsl?raw';
import { BLUR_ITERATIONS, SHADOW_PAD } from './defaults';
import type { GlassConfig } from './defaults';

interface RenderTarget {
  texture: GPUTexture;
  view: GPUTextureView;
  w: number;
  h: number;
}

interface RenderTargetSet {
  bg: RenderTarget;
  blurA: RenderTarget;
  blurB: RenderTarget;
}

export class GlassRendererGPU {
  readonly canvas: HTMLCanvasElement;

  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private blitPipeline: GPURenderPipeline | null = null;
  private blurPipeline: GPURenderPipeline | null = null;
  private glassPipeline: GPURenderPipeline | null = null;

  private quadBuffer: GPUBuffer | null = null;
  private panelBuffer: GPUBuffer | null = null;

  private blitUniformBuffer: GPUBuffer | null = null;
  private blurUniformBuffer: GPUBuffer | null = null;
  private glassUniformBuffer: GPUBuffer | null = null;

  private sampler: GPUSampler | null = null;

  private readonly targetCache = new Map<string, RenderTargetSet>();
  private activeTargets: RenderTargetSet | null = null;

  private bgTexture: GPUTexture | null = null;
  private bgTextureView: GPUTextureView | null = null;

  width = 0;
  height = 0;

  private _initPromise: Promise<boolean> | null = null;
  private _initialized = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);
  }

  async init(): Promise<boolean> {
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    return this._initPromise;
  }

  private async _doInit(): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn('WebGPU not supported');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.warn('No WebGPU adapter found');
      return false;
    }

    this.device = await adapter.requestDevice();
    if (!this.device) {
      console.warn('Failed to get WebGPU device');
      return false;
    }

    this.context = this.canvas.getContext('webgpu');
    if (!this.context) {
      console.warn('Failed to get WebGPU context');
      return false;
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    this._initPipelines();
    this._initBuffers();
    this._initialized = true;

    return true;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  private _initPipelines(): void {
    const device = this.device!;

    // Sampler for all textures
    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // Blit pipeline
    const blitModule = device.createShaderModule({ code: SHADER_BLIT });
    const blitBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    this.blitPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [blitBindGroupLayout] }),
      vertex: {
        module: blitModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        }],
      },
      fragment: {
        module: blitModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    // Blur pipeline
    const blurModule = device.createShaderModule({ code: SHADER_BLUR });
    const blurBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    this.blurPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [blurBindGroupLayout] }),
      vertex: {
        module: blurModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        }],
      },
      fragment: {
        module: blurModule,
        entryPoint: 'fragmentMain',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    // Glass pipeline
    const glassModule = device.createShaderModule({ code: SHADER_GLASS });
    const glassBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });

    this.glassPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [glassBindGroupLayout] }),
      vertex: {
        module: glassModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 8,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }],
        }],
      },
      fragment: {
        module: glassModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-strip' },
    });
  }

  private _initBuffers(): void {
    const device = this.device!;

    // Quad vertices (-1 to 1)
    this.quadBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.quadBuffer.getMappedRange()).set([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.quadBuffer.unmap();

    // Panel vertices (-0.5 to 0.5)
    this.panelBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.panelBuffer.getMappedRange()).set([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    this.panelBuffer.unmap();

    // Uniform buffers
    this.blitUniformBuffer = device.createBuffer({
      size: 16, // vec2 scale + vec2 offset
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.blurUniformBuffer = device.createBuffer({
      size: 16, // vec2 dir + padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Glass uniforms: needs 112 bytes due to WGSL alignment (vec2f needs 8-byte alignment)
    this.glassUniformBuffer = device.createBuffer({
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const targets of this.targetCache.values()) {
      this._freeTargetSet(targets);
    }
    this.targetCache.clear();
    this.activeTargets = null;
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  uploadAndBlur(
    sourceCanvas: HTMLCanvasElement,
    sourceX: number,
    sourceY: number,
    width: number,
    height: number,
    blurAmount: number,
  ): void {
    if (!this._initialized || !this.device) return;
    if (!this._setActiveSize(width, height)) return;

    const device = this.device;
    const W = this.width;
    const H = this.height;
    const targets = this.activeTargets!;

    // Create a temporary canvas to crop the source
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = W;
    cropCanvas.height = H;
    const cropCtx = cropCanvas.getContext('2d')!;
    cropCtx.drawImage(sourceCanvas, -sourceX, -sourceY);

    // Upload to bgTexture
    if (!this.bgTexture || this.bgTexture.width !== W || this.bgTexture.height !== H) {
      if (this.bgTexture) this.bgTexture.destroy();
      this.bgTexture = device.createTexture({
        size: [W, H],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.bgTextureView = this.bgTexture.createView();
    }

    device.queue.copyExternalImageToTexture(
      { source: cropCanvas, flipY: true },
      { texture: this.bgTexture },
      [W, H],
    );

    const encoder = device.createCommandEncoder();

    // Blit bgTexture → bg target
    this._blitPass(encoder, this.bgTextureView!, targets.bg.view, W, H, 1, 1, 0, 0);

    // Blit bg → blurA (downsample)
    const bw = targets.blurA.w;
    const bh = targets.blurA.h;
    this._blitPass(encoder, targets.bg.view, targets.blurA.view, bw, bh, 1, 1, 0, 0);

    // Multi-pass Gaussian blur
    if (blurAmount > 0) {
      const spread = blurAmount * 2.5;
      for (let i = 0; i < BLUR_ITERATIONS; i++) {
        // Horizontal
        this._blurPass(encoder, targets.blurA.view, targets.blurB.view, bw, bh, spread / bw, 0);
        // Vertical
        this._blurPass(encoder, targets.blurB.view, targets.blurA.view, bw, bh, 0, spread / bh);
      }
    }

    device.queue.submit([encoder.finish()]);
  }

  private _blitPass(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView,
    w: number,
    h: number,
    scaleX: number,
    scaleY: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const device = this.device!;

    device.queue.writeBuffer(this.blitUniformBuffer!, 0, new Float32Array([scaleX, scaleY, offsetX, offsetY]));

    const bindGroup = device.createBindGroup({
      layout: this.blitPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.blitUniformBuffer! } },
        { binding: 1, resource: this.sampler! },
        { binding: 2, resource: srcView },
      ],
    });

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: dstView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      }],
    });

    pass.setPipeline(this.blitPipeline!);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.quadBuffer!);
    pass.setViewport(0, 0, w, h, 0, 1);
    pass.draw(4);
    pass.end();
  }

  private _blurPass(
    encoder: GPUCommandEncoder,
    srcView: GPUTextureView,
    dstView: GPUTextureView,
    w: number,
    h: number,
    dirX: number,
    dirY: number,
  ): void {
    const device = this.device!;

    device.queue.writeBuffer(this.blurUniformBuffer!, 0, new Float32Array([dirX, dirY, 0, 0]));

    const bindGroup = device.createBindGroup({
      layout: this.blurPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.blurUniformBuffer! } },
        { binding: 1, resource: this.sampler! },
        { binding: 2, resource: srcView },
      ],
    });

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: dstView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      }],
    });

    pass.setPipeline(this.blurPipeline!);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.quadBuffer!);
    pass.setViewport(0, 0, w, h, 0, 1);
    pass.draw(4);
    pass.end();
  }

  renderGlassPanel(config: GlassConfig, width: number, height: number, dpr: number): void {
    if (!this._initialized || !this.device || !this.context) return;

    const device = this.device;
    const W = this.width;
    const H = this.height;
    const targets = this.activeTargets!;

    // Update glass uniforms (must match WGSL struct layout with alignment)
    // Total: 28 floats = 112 bytes
    const uniforms = new Float32Array([
      W * 0.5, H * 0.5,           // center (vec2f, offset 0)
      width * dpr, height * dpr,   // size (vec2f, offset 8)
      W, H,                        // res (vec2f, offset 16)
      config.cornerRadius * dpr,   // radius (f32, offset 24)
      SHADOW_PAD * dpr,            // pad (f32, offset 28)
      config.refraction,           // refract (f32, offset 32)
      config.chromAberration,      // chroma (f32, offset 36)
      config.edgeHighlight,        // edgeHL (f32, offset 40)
      config.specular,             // spec (f32, offset 44)
      config.fresnel,              // fresnel (f32, offset 48)
      config.distortion,           // distort (f32, offset 52)
      config.opacity,              // alpha (f32, offset 56)
      config.saturation,           // sat (f32, offset 60)
      config.tintStrength,         // tint (f32, offset 64)
      config.zRadius * dpr,        // zRadius (f32, offset 68)
      config.brightness,           // brightness (f32, offset 72)
      config.shadowOpacity,        // shadowAlpha (f32, offset 76)
      config.shadowSpread * dpr,   // shadowSpread (f32, offset 80)
      config.shadowOffsetY * dpr,  // shadowOffY (f32, offset 84)
      config.bevelMode,            // bevelMode (f32, offset 88)
      0,                           // implicit padding (f32, offset 92)
      0, 0,                        // _pad (vec2f, offset 96)
      0, 0,                        // extra padding to reach 112 bytes
    ]);

    device.queue.writeBuffer(this.glassUniformBuffer!, 0, uniforms);

    const bindGroup = device.createBindGroup({
      layout: this.glassPipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.glassUniformBuffer! } },
        { binding: 1, resource: this.sampler! },
        { binding: 2, resource: targets.bg.view },
        { binding: 3, resource: targets.blurA.view },
      ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'load',
        storeOp: 'store',
      }],
    });

    pass.setPipeline(this.glassPipeline!);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, this.panelBuffer!);
    pass.setViewport(0, this.canvas.height - H, W, H, 0, 1);
    pass.draw(4);
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  clear(): void {
    if (!this._initialized || !this.device || !this.context) return;

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
      }],
    });
    pass.setViewport(0, this.canvas.height - this.height, this.width, this.height, 0, 1);
    pass.end();

    this.device.queue.submit([encoder.finish()]);
  }

  destroy(): void {
    for (const targets of this.targetCache.values()) {
      this._freeTargetSet(targets);
    }
    this.targetCache.clear();

    if (this.bgTexture) this.bgTexture.destroy();
    if (this.quadBuffer) this.quadBuffer.destroy();
    if (this.panelBuffer) this.panelBuffer.destroy();
    if (this.blitUniformBuffer) this.blitUniformBuffer.destroy();
    if (this.blurUniformBuffer) this.blurUniformBuffer.destroy();
    if (this.glassUniformBuffer) this.glassUniformBuffer.destroy();

    this.device?.destroy();
    this.canvas.remove();
  }

  private _setActiveSize(w: number, h: number): boolean {
    if (w <= 0 || h <= 0) return false;

    this.width = w;
    this.height = h;

    if (this.canvas.width < w || this.canvas.height < h) {
      this.canvas.width = Math.max(this.canvas.width, w);
      this.canvas.height = Math.max(this.canvas.height, h);
      this.context?.configure({
        device: this.device!,
        format: this.format,
        alphaMode: 'premultiplied',
      });
    }

    const key = `${w}x${h}`;
    let targets = this.targetCache.get(key);
    if (!targets) {
      targets = {
        bg: this._makeTarget(w, h),
        blurA: this._makeTarget(w, h),
        blurB: this._makeTarget(w, h),
      };
      this.targetCache.set(key, targets);
    }
    this.activeTargets = targets;
    return true;
  }

  private _makeTarget(w: number, h: number): RenderTarget {
    const texture = this.device!.createTexture({
      size: [w, h],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    return { texture, view: texture.createView(), w, h };
  }

  private _freeTarget(target: RenderTarget | null): void {
    if (target) target.texture.destroy();
  }

  private _freeTargetSet(targets: RenderTargetSet): void {
    this._freeTarget(targets.bg);
    this._freeTarget(targets.blurA);
    this._freeTarget(targets.blurB);
  }
}
