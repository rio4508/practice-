# Vignette Bloom ASCII & Raster Engine (Canvas2D)

> Recreation of the **"Vignette Bloom"** ASCII & Raster Art effect from [21st.dev (Community ASCII Editor)](https://21st.dev/community/ascii) using HTML5 Canvas2D.

![Vignette Bloom ASCII Effect](ref-008.webp)

---

## 🌟 Key Features

- **High-Performance Canvas2D Engine**: Modular 8-step render pipeline capable of real-time 60 FPS animation playback.
- **26 Render Modes**:
  - `mosaic` (Default), `characters` (ASCII/Unicode glyph sets), `dither` (4x4 Bayer matrix), `pixel`, `dots`, `cross`, `diamond`, `voxel` (3D isometric cubes), `lego`, `mixed`, `lines`, `diagonal`, `braille`, `disco`, `hexdump`, `matrix` (digital green code rain), `rings`, `hearts`, `stars`, `hexagons`, `triangles`, `bubbles`, `hatch`, `contour`, and `halfblocks`.
- **Complete Color Processing Stack**:
  - `brightness`, `contrast`, `saturation`, `grayscale`, tint color with customizable blend modes (`multiply`, `screen`, `overlay`, `color`, `source-over`), and blur filters.
- **Post-Processing FX (PFX)**:
  - `vignette`, `bloom`, `scanLines`, `chromatic` (RGB split), `filmGrain`, `glitch`, `pixelate`, `halftone`, and `filmDust`.
- **Procedural Real-Time Animations**:
  - `wave`, `pulse`, `shimmer`, `ripple`, and `flicker` motion engines.
- **Lighting & Masking**:
  - Multi-point radial glow lights and image reveal masking.
- **Modern Dark UI**:
  - Built with glassmorphism aesthetics, live parameter sliders, custom photo upload, preset JSON export/import, and high-res PNG snapshot export.

---

## 🚀 Quick Start

### Running Locally

Since this app uses standard modern JavaScript ES Modules, simply run any static HTTP server in the project directory:

```bash
# Option 1: Using http-server
npx http-server . -p 8080

# Option 2: Using Vite
npx vite
```

Then open `http://localhost:8080` in your web browser.

---

## 🛠 Project Structure

```
├── index.html               # Main Web Application & UI Controls
├── index.css                # Glassmorphic Dark Design System
├── ref-008.webp             # Default Reference Photo
├── src/
│   └── ascii-renderer.js    # Canvas2D 8-Step Render Engine & Presets
└── README.md                # Project Documentation
```

---

## ⚙ Pipeline Architecture

The rendering pipeline executes in 8 sequential passes:

1. **Background Layer**: Renders `solid`, `blurred`, `photo`, or transparent background based on `bgMode`, `bgBlur`, and `bgOpacity`.
2. **Grid Sampling & Edge Detection**: Sub-divides canvas into `cellSize` blocks, computes average RGB + relative luminance ($Y = 0.299R + 0.587G + 0.114B$), Sobel edge magnitude gradient boosting (`edgeEmphasis`), and `invert`.
3. **Primitive Rendering**: Draws selected primitive per cell for one of the 26 `renderMode` options, applying `coverage`, `density`, and character sets.
4. **Color Adjustments**: Applies brightness, contrast, saturation, grayscale, tint overlay, and blur filters.
5. **Post-Effects (PFX)**: Applies active PFX passes (`vignette`, `bloom`, `scanLines`, `chromatic`, `filmGrain`, `glitch`, etc.).
6. **Radial Lights**: Renders glowing point light sources at `lights.points` coordinates.
7. **Reveal Mask**: Blends original photo via reveal mask (`mask.dataUrl`).
8. **Animation**: Time-modulated parameter updates driven by `requestAnimationFrame`.

---

## 📜 Preset Specification (JSON)

Default "Vignette Bloom" configuration:

```json
{
  "renderMode": "mosaic",
  "bgMode": "solid",
  "bgBlur": 12,
  "bgOpacity": 90,
  "cellSize": 16,
  "coverage": 100,
  "invert": false,
  "styleBlend": "source-over",
  "charSet": "standard",
  "customChars": "",
  "brightness": 12,
  "contrast": 115,
  "edgeEmphasis": 0,
  "density": 0,
  "tint": "#3ca6ff",
  "tintOpacity": 0,
  "overlayBlend": "multiply",
  "saturation": 100,
  "grayscale": 0,
  "blurType": "off",
  "blurAmount": 35,
  "pfx": {
    "vignette": { "enabled": true, "intensity": 38 },
    "bloom": { "enabled": true, "intensity": 25 }
  },
  "animated": true,
  "animStyle": "wave",
  "animSpeed": { "enabled": true, "intensity": 100 },
  "animIntensity": { "enabled": true, "intensity": 60 }
}
```

---

## 📄 License

MIT License. Free to use and customize!
