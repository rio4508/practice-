/**
 * Vignette Bloom ASCII & Raster Art Render Engine (Canvas2D)
 * Recreates 21st.dev ASCII effects with 8-step pipeline, 26 render modes,
 * color grading, post-processing FX, lighting, masking, and animation loops.
 */

export const VIGNETTE_BLOOM_PRESET = {
  renderMode: "mosaic",
  bgMode: "solid",
  bgBlur: 12,
  bgOpacity: 90,
  cellSize: 16,
  coverage: 100,
  invert: false,
  styleBlend: "source-over",
  charSet: "standard",
  customChars: "",
  brightness: 12,
  contrast: 115,
  edgeEmphasis: 0,
  density: 0,
  toneCurve: [
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ],
  tint: "#3ca6ff",
  tintOpacity: 0,
  overlayBlend: "multiply",
  saturation: 100,
  grayscale: 0,
  blurType: "off",
  blurAmount: 35,
  blurAngle: 0,
  directionalBothSides: false,
  tiltFocus: 35,
  tiltPosition: 50,
  tiltFeather: 15,
  lensFocus: 40,
  blurCenterX: 50,
  blurCenterY: 50,
  progressivePosition: 55,
  progressiveReverse: false,
  pfx: {
    vignette: { enabled: true, intensity: 38 },
    scanLines: { enabled: false, intensity: 40 },
    chromatic: { enabled: false, intensity: 15 },
    bloom: { enabled: true, intensity: 25 },
    filmGrain: { enabled: false, intensity: 30 },
    glitch: { enabled: false, intensity: 20 },
    pixelate: { enabled: false, intensity: 15 },
    halftone: { enabled: false, intensity: 20 },
    filmDust: { enabled: false, intensity: 20 }
  },
  animated: true,
  animStyle: "wave",
  animSpeed: { enabled: true, intensity: 100 },
  animIntensity: { enabled: true, intensity: 60 },
  lights: { enabled: false, points: [] },
  mask: {
    enabled: false,
    tool: "freehand",
    brushSize: 30,
    showOverlay: false,
    invert: false,
    dataUrl: null,
    shapes: []
  }
};

export const CHAR_SETS = {
  standard: " .:-=+*#%@",
  blocks: " ░▒▓█",
  binary: " 01",
  matrix: " ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ",
  minimal: " .:+*#",
  digits: " 0123456789",
  ascii: " !\"#$%&'()*+,-./0123456789:;<=>?@",
  hexdump: " 0123456789ABCDEF"
};

export class AsciiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Offscreen buffers for fast pipeline passes
    this.sampleCanvas = document.createElement('canvas');
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });

    this.effectCanvas = document.createElement('canvas');
    this.effectCtx = this.effectCanvas.getContext('2d', { willReadFrequently: true });

    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d');

    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d');

    this.sourceImage = null;
    this.params = JSON.parse(JSON.stringify(VIGNETTE_BLOOM_PRESET));

    // Matrix rain column state
    this.matrixDrops = [];
    
    // Time reference
    this.startTime = performance.now();
  }

  setSourceImage(img) {
    this.sourceImage = img;
  }

  setParams(newParams) {
    this.params = Object.assign({}, this.params, newParams);
  }

  render(timestamp = performance.now()) {
    if (!this.sourceImage || !this.sourceImage.complete || this.sourceImage.naturalWidth === 0) {
      return;
    }

    const { width, height } = this.canvas;
    if (width === 0 || height === 0) return;

    const ctx = this.ctx;
    const time = (timestamp - this.startTime) / 1000;
    const params = this.params;

    // Resize offscreen canvases if needed
    if (this.sampleCanvas.width !== width || this.sampleCanvas.height !== height) {
      this.sampleCanvas.width = width;
      this.sampleCanvas.height = height;
      this.effectCanvas.width = width;
      this.effectCanvas.height = height;
      this.bloomCanvas.width = width;
      this.bloomCanvas.height = height;
      this.maskCanvas.width = width;
      this.maskCanvas.height = height;
    }

    // Prepare sampled image into sampleCanvas
    this.sampleCtx.clearRect(0, 0, width, height);
    this.sampleCtx.drawImage(this.sourceImage, 0, 0, width, height);
    const sampleImageData = this.sampleCtx.getImageData(0, 0, width, height);
    const pixels = sampleImageData.data;

    // ----------------------------------------------------
    // STEP 1: Draw Background
    // ----------------------------------------------------
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (params.bgMode === "solid") {
      ctx.fillStyle = "#090a0f";
      ctx.fillRect(0, 0, width, height);
    } else if (params.bgMode === "blurred") {
      ctx.save();
      ctx.filter = `blur(${params.bgBlur || 12}px)`;
      ctx.globalAlpha = (params.bgOpacity ?? 90) / 100;
      ctx.drawImage(this.sourceImage, 0, 0, width, height);
      ctx.restore();
    } else if (params.bgMode === "photo") {
      ctx.save();
      ctx.globalAlpha = (params.bgOpacity ?? 90) / 100;
      ctx.drawImage(this.sourceImage, 0, 0, width, height);
      ctx.restore();
    } // "none" leaves transparent background

    // ----------------------------------------------------
    // STEP 2 & STEP 3: Raster / ASCII Effect Generation
    // ----------------------------------------------------
    const eCtx = this.effectCtx;
    eCtx.clearRect(0, 0, width, height);

    const cellSize = Math.max(4, Math.round(params.cellSize || 16));
    const cols = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);

    // Initialize matrix rain if needed
    if (params.renderMode === "matrix" && this.matrixDrops.length !== cols) {
      this.matrixDrops = Array.from({ length: cols }, () => Math.floor(Math.random() * rows));
    }

    // Animation settings
    const animSpeed = params.animSpeed?.enabled ? (params.animSpeed.intensity / 50) : 1.0;
    const animIntensity = params.animIntensity?.enabled ? (params.animIntensity.intensity / 100) : 0.6;
    const animTime = time * animSpeed;

    // Glyphs set
    let glyphs = CHAR_SETS.standard;
    if (params.charSet === "custom" && params.customChars && params.customChars.trim().length > 0) {
      glyphs = params.customChars;
    } else if (CHAR_SETS[params.charSet]) {
      glyphs = CHAR_SETS[params.charSet];
    }

    eCtx.save();
    eCtx.font = `bold ${cellSize * 0.9}px monospace`;
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';

    const coverageLimit = (params.coverage ?? 100) / 100;
    const densityScale = 1 + (params.density || 0) / 100;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Coverage check
        if (coverageLimit < 1) {
          const pseudoRandom = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
          if ((pseudoRandom - Math.floor(pseudoRandom)) > coverageLimit) {
            continue;
          }
        }

        const cx = c * cellSize;
        const cy = r * cellSize;
        const centerX = cx + cellSize / 2;
        const centerY = cy + cellSize / 2;

        // Sample average color from image data
        let sumR = 0, sumG = 0, sumB = 0, sumA = 0, samples = 0;
        const step = Math.max(1, Math.floor(cellSize / 4));

        for (let py = cy; py < Math.min(cy + cellSize, height); py += step) {
          for (let px = cx; px < Math.min(cx + cellSize, width); px += step) {
            const idx = (py * width + px) * 4;
            sumR += pixels[idx];
            sumG += pixels[idx + 1];
            sumB += pixels[idx + 2];
            sumA += pixels[idx + 3];
            samples++;
          }
        }

        if (samples === 0) continue;

        let avgR = Math.round(sumR / samples);
        let avgG = Math.round(sumG / samples);
        let avgB = Math.round(sumB / samples);
        let avgA = (sumA / samples) / 255;

        if (avgA === 0) continue;

        // Relative Luminance Y
        let lum = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;

        // Edge emphasis calculation
        if (params.edgeEmphasis > 0) {
          const rightX = Math.min(cx + cellSize, width - 1);
          const bottomY = Math.min(cy + cellSize, height - 1);
          const idxR = (cy * width + rightX) * 4;
          const idxB = (bottomY * width + cx) * 4;
          const lumR = (0.299 * pixels[idxR] + 0.587 * pixels[idxR + 1] + 0.114 * pixels[idxR + 2]) / 255;
          const lumB = (0.299 * pixels[idxB] + 0.587 * pixels[idxB + 1] + 0.114 * pixels[idxB + 2]) / 255;
          const edgeMag = Math.sqrt((lum - lumR) ** 2 + (lum - lumB) ** 2);
          lum = Math.min(1, Math.max(0, lum + edgeMag * (params.edgeEmphasis / 50)));
        }

        // Apply Invert
        if (params.invert) {
          lum = 1 - lum;
        }

        // Procedural Animation Modulation
        if (params.animated) {
          let mod = 0;
          if (params.animStyle === "wave") {
            mod = Math.sin(animTime * 3 + (c + r) * 0.3) * 0.25 * animIntensity;
          } else if (params.animStyle === "pulse") {
            mod = Math.cos(animTime * 4) * 0.2 * animIntensity;
          } else if (params.animStyle === "shimmer") {
            mod = (Math.sin(animTime * 10 + c * r * 0.1) > 0.3 ? 0.2 : -0.1) * animIntensity;
          } else if (params.animStyle === "ripple") {
            const dist = Math.hypot(c - cols / 2, r - rows / 2);
            mod = Math.sin(dist * 0.5 - animTime * 4) * 0.25 * animIntensity;
          } else if (params.animStyle === "flicker") {
            mod = (Math.random() - 0.5) * 0.3 * animIntensity;
          }
          lum = Math.min(1, Math.max(0, lum + mod));
        }

        eCtx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`;
        eCtx.strokeStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`;

        // Render Mode Primitive Handlers
        const mode = params.renderMode || "mosaic";

        switch (mode) {
          case "characters": {
            const charIdx = Math.floor(lum * (glyphs.length - 1));
            const char = glyphs[Math.min(glyphs.length - 1, Math.max(0, charIdx))];
            eCtx.fillText(char, centerX, centerY);
            break;
          }

          case "dither": {
            const bayer = [
              [0, 8, 2, 10],
              [12, 4, 14, 6],
              [3, 11, 1, 9],
              [15, 7, 13, 5]
            ];
            const threshold = (bayer[r % 4][c % 4] + 0.5) / 16;
            if (lum > threshold) {
              const radius = (cellSize / 2) * densityScale * 0.8;
              eCtx.beginPath();
              eCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
              eCtx.fill();
            }
            break;
          }

          case "mosaic": {
            const pad = Math.max(0, (1 - densityScale) * (cellSize / 2));
            eCtx.fillRect(cx + pad, cy + pad, cellSize - pad * 2, cellSize - pad * 2);
            break;
          }

          case "pixel": {
            eCtx.fillRect(cx, cy, cellSize, cellSize);
            break;
          }

          case "dots": {
            const radius = (cellSize / 2) * Math.max(0.1, lum) * densityScale;
            eCtx.beginPath();
            eCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            eCtx.fill();
            break;
          }

          case "cross": {
            const len = (cellSize / 2) * lum * densityScale;
            eCtx.lineWidth = Math.max(1, cellSize * 0.15);
            eCtx.beginPath();
            eCtx.moveTo(centerX - len, centerY);
            eCtx.lineTo(centerX + len, centerY);
            eCtx.moveTo(centerX, centerY - len);
            eCtx.lineTo(centerX, centerY + len);
            eCtx.stroke();
            break;
          }

          case "diamond": {
            const s = (cellSize / 2) * lum * densityScale;
            eCtx.beginPath();
            eCtx.moveTo(centerX, centerY - s);
            eCtx.lineTo(centerX + s, centerY);
            eCtx.lineTo(centerX, centerY + s);
            eCtx.lineTo(centerX - s, centerY);
            eCtx.closePath();
            eCtx.fill();
            break;
          }

          case "voxel": {
            const size = (cellSize / 2) * densityScale;
            eCtx.beginPath();
            eCtx.fillStyle = `rgba(${Math.min(255, avgR + 40)}, ${Math.min(255, avgG + 40)}, ${Math.min(255, avgB + 40)}, ${avgA})`;
            eCtx.moveTo(centerX, centerY - size * 0.8);
            eCtx.lineTo(centerX + size * 0.8, centerY - size * 0.4);
            eCtx.lineTo(centerX, centerY);
            eCtx.lineTo(centerX - size * 0.8, centerY - size * 0.4);
            eCtx.closePath();
            eCtx.fill();

            eCtx.fillStyle = `rgba(${Math.max(0, avgR - 30)}, ${Math.max(0, avgG - 30)}, ${Math.max(0, avgB - 30)}, ${avgA})`;
            eCtx.beginPath();
            eCtx.moveTo(centerX - size * 0.8, centerY - size * 0.4);
            eCtx.lineTo(centerX, centerY);
            eCtx.lineTo(centerX, centerY + size * 0.8);
            eCtx.lineTo(centerX - size * 0.8, centerY + size * 0.4);
            eCtx.closePath();
            eCtx.fill();

            eCtx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`;
            eCtx.beginPath();
            eCtx.moveTo(centerX, centerY);
            eCtx.lineTo(centerX + size * 0.8, centerY - size * 0.4);
            eCtx.lineTo(centerX + size * 0.8, centerY + size * 0.4);
            eCtx.lineTo(centerX, centerY + size * 0.8);
            eCtx.closePath();
            eCtx.fill();
            break;
          }

          case "lego": {
            const pad = 1;
            eCtx.fillRect(cx + pad, cy + pad, cellSize - pad * 2, cellSize - pad * 2);
            eCtx.fillStyle = `rgba(${Math.min(255, avgR + 50)}, ${Math.min(255, avgG + 50)}, ${Math.min(255, avgB + 50)}, ${avgA})`;
            eCtx.beginPath();
            eCtx.arc(centerX, centerY, cellSize * 0.25 * densityScale, 0, Math.PI * 2);
            eCtx.fill();
            break;
          }

          case "mixed": {
            if (lum > 0.75) {
              const len = (cellSize / 2) * densityScale;
              eCtx.lineWidth = 2;
              eCtx.beginPath();
              eCtx.moveTo(centerX - len, centerY); eCtx.lineTo(centerX + len, centerY);
              eCtx.moveTo(centerX, centerY - len); eCtx.lineTo(centerX, centerY + len);
              eCtx.stroke();
            } else if (lum > 0.4) {
              eCtx.beginPath();
              eCtx.arc(centerX, centerY, (cellSize / 2) * lum * densityScale, 0, Math.PI * 2);
              eCtx.fill();
            } else {
              const s = (cellSize / 3) * densityScale;
              eCtx.fillRect(centerX - s / 2, centerY - s / 2, s, s);
            }
            break;
          }

          case "lines": {
            eCtx.lineWidth = Math.max(1, cellSize * lum * 0.5 * densityScale);
            eCtx.beginPath();
            eCtx.moveTo(cx, centerY);
            eCtx.lineTo(cx + cellSize, centerY);
            eCtx.stroke();
            break;
          }

          case "diagonal": {
            eCtx.lineWidth = Math.max(1, cellSize * lum * 0.4 * densityScale);
            eCtx.beginPath();
            eCtx.moveTo(cx, cy + cellSize);
            eCtx.lineTo(cx + cellSize, cy);
            eCtx.stroke();
            break;
          }

          case "braille": {
            const brailleBase = 0x2800;
            let code = 0;
            if (lum > 0.2) code |= 0x1;
            if (lum > 0.4) code |= 0x2;
            if (lum > 0.6) code |= 0x4;
            if (lum > 0.8) code |= 0x40;
            const bChar = String.fromCharCode(brailleBase + code);
            eCtx.fillText(bChar, centerX, centerY);
            break;
          }

          case "disco": {
            const rad = (cellSize / 2) * Math.sin(animTime * 5 + c + r) * 0.4 + (cellSize / 2) * 0.6;
            const grad = eCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, rad);
            grad.addColorStop(0, `rgba(255, 255, 255, ${avgA})`);
            grad.addColorStop(0.5, `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA})`);
            grad.addColorStop(1, 'transparent');
            eCtx.fillStyle = grad;
            eCtx.beginPath();
            eCtx.arc(centerX, centerY, rad, 0, Math.PI * 2);
            eCtx.fill();
            break;
          }

          case "hexdump": {
            const hexChars = "0123456789ABCDEF";
            const hexVal = hexChars[Math.floor(lum * 15)];
            eCtx.fillText(hexVal, centerX, centerY);
            break;
          }

          case "matrix": {
            const rainY = this.matrixDrops[c] || 0;
            if (r === Math.floor(rainY)) {
              eCtx.fillStyle = '#ffffff';
            } else if (r < rainY && r > rainY - 8) {
              eCtx.fillStyle = `rgba(50, 255, 100, ${1 - (rainY - r) / 8})`;
            } else {
              eCtx.fillStyle = `rgba(0, 180, 50, ${lum * 0.6})`;
            }
            const matrixChar = CHAR_SETS.matrix[Math.floor(Math.random() * CHAR_SETS.matrix.length)];
            eCtx.fillText(matrixChar, centerX, centerY);
            
            if (r === rows - 1 && Math.random() > 0.95) {
              this.matrixDrops[c] = (this.matrixDrops[c] + 0.2 * animSpeed) % rows;
            }
            break;
          }

          case "rings": {
            const numRings = Math.max(1, Math.floor(lum * 4));
            eCtx.lineWidth = 1.5;
            for (let i = 1; i <= numRings; i++) {
              const rRadius = (cellSize / 2) * (i / 4) * densityScale;
              eCtx.beginPath();
              eCtx.arc(centerX, centerY, rRadius, 0, Math.PI * 2);
              eCtx.stroke();
            }
            break;
          }

          case "hearts": {
            const hScale = (cellSize / 32) * Math.max(0.2, lum) * densityScale;
            eCtx.save();
            eCtx.translate(centerX, centerY);
            eCtx.scale(hScale, hScale);
            eCtx.beginPath();
            eCtx.moveTo(0, 4);
            eCtx.bezierCurveTo(-12, -12, -20, 2, 0, 16);
            eCtx.bezierCurveTo(20, 2, 12, -12, 0, 4);
            eCtx.fill();
            eCtx.restore();
            break;
          }

          case "stars": {
            const outerR = (cellSize / 2) * Math.max(0.2, lum) * densityScale;
            const innerR = outerR * 0.4;
            eCtx.beginPath();
            for (let i = 0; i < 10; i++) {
              const starR = i % 2 === 0 ? outerR : innerR;
              const angle = (i * Math.PI) / 5 - Math.PI / 2;
              const sx = centerX + starR * Math.cos(angle);
              const sy = centerY + starR * Math.sin(angle);
              if (i === 0) eCtx.moveTo(sx, sy);
              else eCtx.lineTo(sx, sy);
            }
            eCtx.closePath();
            eCtx.fill();
            break;
          }

          case "hexagons": {
            const hR = (cellSize / 2) * densityScale * 0.9;
            eCtx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (i * Math.PI) / 3;
              const hx = centerX + hR * Math.cos(angle);
              const hy = centerY + hR * Math.sin(angle);
              if (i === 0) eCtx.moveTo(hx, hy);
              else eCtx.lineTo(hx, hy);
            }
            eCtx.closePath();
            eCtx.fill();
            break;
          }

          case "triangles": {
            const tR = (cellSize / 2) * densityScale;
            const flip = (c + r) % 2 === 0 ? 1 : -1;
            eCtx.beginPath();
            eCtx.moveTo(centerX, centerY - tR * flip);
            eCtx.lineTo(centerX + tR, centerY + tR * flip);
            eCtx.lineTo(centerX - tR, centerY + tR * flip);
            eCtx.closePath();
            eCtx.fill();
            break;
          }

          case "bubbles": {
            const bR = (cellSize / 2) * Math.max(0.3, lum) * densityScale;
            eCtx.beginPath();
            eCtx.arc(centerX, centerY, bR, 0, Math.PI * 2);
            eCtx.fill();
            eCtx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            eCtx.beginPath();
            eCtx.arc(centerX - bR * 0.3, centerY - bR * 0.3, bR * 0.25, 0, Math.PI * 2);
            eCtx.fill();
            break;
          }

          case "hatch": {
            eCtx.lineWidth = 1.2;
            const linesCount = Math.floor(lum * 5);
            for (let l = 0; l < linesCount; l++) {
              const offset = (cellSize / 5) * l;
              eCtx.beginPath();
              eCtx.moveTo(cx + offset, cy);
              eCtx.lineTo(cx + cellSize, cy + cellSize - offset);
              eCtx.stroke();
            }
            break;
          }

          case "contour": {
            const level = Math.floor(lum * 6);
            const cR = (cellSize / 2) * (level / 6) * densityScale;
            eCtx.lineWidth = 1;
            eCtx.beginPath();
            eCtx.arc(centerX, centerY, cR, 0, Math.PI * 2);
            eCtx.stroke();
            break;
          }

          case "halfblocks": {
            eCtx.fillRect(cx, cy, cellSize, cellSize / 2);
            eCtx.fillStyle = `rgba(${Math.max(0, avgR - 40)}, ${Math.max(0, avgG - 40)}, ${Math.max(0, avgB - 40)}, ${avgA})`;
            eCtx.fillRect(cx, cy + cellSize / 2, cellSize, cellSize / 2);
            break;
          }
        }
      }
    }

    eCtx.restore();

    // Composite step 3 result over step 1 background
    ctx.save();
    ctx.globalCompositeOperation = params.styleBlend || 'source-over';
    ctx.drawImage(this.effectCanvas, 0, 0, width, height);
    ctx.restore();

    // STEP 4: Color Adjustments & Filters
    const bVal = params.brightness ?? 0;
    const cVal = params.contrast ?? 100;
    const sVal = params.saturation ?? 100;
    const gVal = params.grayscale ?? 0;

    let filterStr = "";
    if (bVal !== 0) filterStr += `brightness(${100 + bVal}%) `;
    if (cVal !== 100) filterStr += `contrast(${cVal}%) `;
    if (sVal !== 100) filterStr += `saturate(${sVal}%) `;
    if (gVal > 0) filterStr += `grayscale(${gVal}%) `;

    if (filterStr.trim().length > 0) {
      ctx.save();
      ctx.filter = filterStr.trim();
      ctx.drawImage(this.canvas, 0, 0, width, height);
      ctx.restore();
    }

    // Tint Overlay
    if (params.tintOpacity > 0 && params.tint) {
      ctx.save();
      ctx.globalAlpha = params.tintOpacity / 100;
      ctx.globalCompositeOperation = params.overlayBlend || 'multiply';
      ctx.fillStyle = params.tint;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // STEP 5: Post-Effects Pipeline (PFX)
    const pfx = params.pfx || {};

    // Bloom Effect
    if (pfx.bloom?.enabled && pfx.bloom.intensity > 0) {
      const bInt = pfx.bloom.intensity / 100;
      this.bloomCtx.clearRect(0, 0, width, height);
      this.bloomCtx.filter = `brightness(140%) contrast(150%) blur(${12 * bInt}px)`;
      this.bloomCtx.drawImage(this.canvas, 0, 0, width, height);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = bInt * 0.8;
      ctx.drawImage(this.bloomCanvas, 0, 0, width, height);
      ctx.restore();
    }

    // Vignette Effect
    if (pfx.vignette?.enabled && pfx.vignette.intensity > 0) {
      const vInt = pfx.vignette.intensity / 100;
      ctx.save();
      const radius = Math.hypot(width / 2, height / 2);
      const vGrad = ctx.createRadialGradient(width / 2, height / 2, radius * (1 - vInt * 0.7), width / 2, height / 2, radius);
      vGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vGrad.addColorStop(1, `rgba(0, 0, 0, ${vInt * 0.95})`);
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}
