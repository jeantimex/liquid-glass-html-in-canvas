# Liquid Glass HTML in Canvas

Apply beautiful liquid glass effects to HTML elements rendered inside a canvas using the experimental [html-in-canvas](https://github.com/nickswalker/nickswalker.github.io/tree/main/experiments/html-in-canvas) API.

![Liquid Glass Demo](https://img.shields.io/badge/demo-live-brightgreen)

## Features

- Apple-style liquid glass effect with blur, refraction, and chromatic aberration
- Works with the experimental `layoutsubtree` canvas and `drawElementImage()` API
- Configure effects via CSS custom properties
- Supports device pixel ratio for sharp rendering on high-DPI displays
- Simple API - just add a class and call `render()`

## Requirements

This project uses the experimental html-in-canvas API which is currently only available in Chrome with a flag enabled:

1. Open `chrome://flags`
2. Search for "Experimental Web Platform features"
3. Enable it and restart Chrome

## Installation

```bash
npm install
npm run dev
```

## Quick Start

### 1. Set up your HTML

Add the `layoutsubtree` attribute to your canvas and place HTML elements inside:

```html
<canvas id="canvas" layoutsubtree>
  <!-- Background content -->
  <div class="background">
    <img src="/background.jpg" alt="Background" />
  </div>

  <!-- Glass panel - add the .liquid-glass class -->
  <div id="my-panel" class="liquid-glass">
    Hello, Glass!
  </div>
</canvas>
```

### 2. Add CSS for positioning and glass configuration

```css
#canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.background {
  position: absolute;
  inset: 0;
}

#my-panel {
  position: absolute;
  top: 50px;
  left: 50px;
  padding: 20px 40px;
  color: white;
  font-size: 24px;

  /* Liquid glass configuration */
  --lg-blur: 0.15;
  --lg-refraction: 0.7;
  --lg-corner-radius: 32;
}
```

### 3. Initialize and render

```typescript
import { LiquidGlassCanvas } from './liquid-glass';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const liquidGlass = new LiquidGlassCanvas(canvas);

// Set up the paint handler
canvas.onpaint = () => {
  liquidGlass.render();
};

// Request continuous repaints
function loop() {
  canvas.requestPaint?.();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Handle canvas resize for sharp rendering
new ResizeObserver(([entry]) => {
  if (entry.devicePixelContentBoxSize) {
    canvas.width = entry.devicePixelContentBoxSize[0].inlineSize;
    canvas.height = entry.devicePixelContentBoxSize[0].blockSize;
  }
  canvas.requestPaint?.();
}).observe(canvas, { box: 'device-pixel-content-box' });
```

## API

### `LiquidGlassCanvas`

#### Constructor

```typescript
const liquidGlass = new LiquidGlassCanvas(canvas: HTMLCanvasElement);
```

#### Methods

##### `render()`

Renders all elements inside the canvas, automatically applying glass effects to elements with the `.liquid-glass` class.

```typescript
canvas.onpaint = () => {
  liquidGlass.render();
};
```

##### `renderGlassElements()`

Renders only the glass elements. Use this when you want to draw your own background first:

```typescript
canvas.onpaint = () => {
  ctx.reset();
  // Draw your own background
  ctx.drawElementImage(myBackground, 0, 0);
  ctx.drawElementImage(otherContent, x, y);
  
  // Apply glass effects on top
  liquidGlass.renderGlassElements();
};
```

##### `destroy()`

Cleans up WebGL resources:

```typescript
liquidGlass.destroy();
```

## CSS Custom Properties

Configure the glass effect using CSS custom properties on `.liquid-glass` elements:

| Property | Default | Description |
|----------|---------|-------------|
| `--lg-blur` | `0.0` | Background blur amount (0-1) |
| `--lg-refraction` | `0.69` | Light refraction intensity |
| `--lg-corner-radius` | `65` | Corner radius in pixels |
| `--lg-z-radius` | `40` | Z-depth radius for 3D effect |
| `--lg-chrom-aberration` | `0.05` | Chromatic aberration intensity |
| `--lg-edge-highlight` | `0.05` | Edge highlight intensity |
| `--lg-specular` | `0.0` | Specular reflection intensity |
| `--lg-fresnel` | `1.0` | Fresnel effect intensity |
| `--lg-distortion` | `0.0` | Distortion amount |
| `--lg-opacity` | `1.0` | Overall opacity |
| `--lg-saturation` | `0.0` | Color saturation adjustment |
| `--lg-tint` | `0.0` | Tint strength |
| `--lg-brightness` | `0.0` | Brightness adjustment |
| `--lg-shadow-opacity` | `0.3` | Drop shadow opacity |
| `--lg-shadow-spread` | `10` | Drop shadow spread in pixels |
| `--lg-shadow-offset-y` | `1` | Drop shadow Y offset |
| `--lg-bevel-mode` | `0` | Bevel rendering mode |

### Example Configurations

#### Subtle Glass
```css
.subtle-glass {
  --lg-blur: 0.1;
  --lg-refraction: 0.5;
  --lg-corner-radius: 16;
}
```

#### Frosted Glass
```css
.frosted-glass {
  --lg-blur: 0.3;
  --lg-refraction: 0.4;
  --lg-saturation: -0.2;
  --lg-corner-radius: 24;
}
```

#### Bold Glass
```css
.bold-glass {
  --lg-blur: 0.15;
  --lg-refraction: 0.8;
  --lg-chrom-aberration: 0.08;
  --lg-edge-highlight: 0.1;
  --lg-fresnel: 1.5;
  --lg-corner-radius: 32;
  --lg-shadow-opacity: 0.4;
}
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; overflow: hidden; }
    
    #canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .background {
      position: absolute;
      inset: 0;
    }

    .background img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .glass-card {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 40px 60px;
      color: white;
      font-family: system-ui;
      font-size: 32px;
      font-weight: bold;
      
      --lg-blur: 0.2;
      --lg-refraction: 0.7;
      --lg-corner-radius: 40;
      --lg-z-radius: 30;
      --lg-fresnel: 1.2;
    }
  </style>
</head>
<body>
  <canvas id="canvas" layoutsubtree>
    <div class="background">
      <img src="/background.jpg" alt="" />
    </div>
    <div class="glass-card liquid-glass">
      Hello, Liquid Glass!
    </div>
  </canvas>

  <script type="module">
    import { LiquidGlassCanvas } from './src/liquid-glass';

    const canvas = document.getElementById('canvas');
    const lg = new LiquidGlassCanvas(canvas);

    canvas.onpaint = () => lg.render();

    function loop() {
      canvas.requestPaint?.();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    new ResizeObserver(([entry]) => {
      if (entry.devicePixelContentBoxSize) {
        canvas.width = entry.devicePixelContentBoxSize[0].inlineSize;
        canvas.height = entry.devicePixelContentBoxSize[0].blockSize;
      }
      canvas.requestPaint?.();
    }).observe(canvas, { box: 'device-pixel-content-box' });
  </script>
</body>
</html>
```

## How It Works

1. **Layout**: Elements inside the `layoutsubtree` canvas are laid out by CSS but not painted to the screen
2. **Background Capture**: For each `.liquid-glass` element, the library captures the canvas content behind it
3. **WebGL Processing**: The captured region is processed through WebGL shaders that apply blur, refraction, chromatic aberration, and other effects
4. **Compositing**: The glass effect is drawn to the canvas, followed by the element's content on top

## Browser Support

Currently requires Chrome with the "Experimental Web Platform features" flag enabled.

## License

MIT
