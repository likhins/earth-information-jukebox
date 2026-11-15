// app/components/EarthViewport.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EicDataset, ReticleFeatures } from '../lib/datasets';
import { MapPin, ZoomIn, ZoomOut } from 'lucide-react';

// =============================================================================
// TUNABLE GLOBE MOSAIC & RENDERING CONSTANTS
// =============================================================================
export const CELL_SIZE = 5; // Mosaic block size in display pixels (tune 5 - 6px)
export const OVERLAY_OPACITY = 0.80; // Heat layer opacity over base terrain (80%)
export const RIM_COLOR = 'rgba(235, 125, 65, 0.9)'; // 1px warm-orange/copper rim line
export const GLOW_COLOR = 'rgba(229, 109, 54, 0.22)'; // Soft outer atmospheric glow color
export const GLOW_RADIUS = 26; // Soft outer glow falloff in pixels (20 - 30px)
export const AUTO_ROTATE_SPEED = 1.5; // Degrees per second when idle (0 to disable)
export const GIBS_TILE_ZOOM = 1; // Stitched NASA GIBS tile zoom level (1 = 4 tiles, 2 = 16 tiles)

// Perceptual colour ramps matching legend bars (low = cool/dark, high = warm/bright)
// Removed any purple-orange default ramp.
export const DATASET_COLOR_RAMPS: Record<string, [number, number, number][]> = {
  sst_anomaly: [
    [29, 78, 216],   // #1d4ed8 deep blue (cool)
    [226, 232, 240], // #e2e8f0 neutral white
    [220, 38, 38],   // #dc2626 bright warm red
  ],
  sea_ice_extent: [
    [12, 74, 110],   // #0c4a6e deep cool blue
    [56, 189, 248],  // #38bdf8 sky blue
    [248, 250, 252], // #f8fafc crisp ice white
  ],
  soil_moisture: [
    [120, 53, 15],   // #78350f dry earth / brown
    [202, 138, 4],   // #ca8a04 moderate moisture
    [2, 132, 199],   // #0284c7 lush / high moisture blue
  ],
  chlorophyll_a: [
    [30, 27, 75],    // #1e1b4b deep ocean
    [13, 148, 136],  // #0d9488 teal
    [132, 204, 22],  // #84cc16 radiant chlorophyll lime
  ],
  land_surface_temp: [
    [37, 99, 235],   // #2563eb cool blue
    [241, 245, 249], // #f1f5f9 neutral white
    [225, 29, 72],   // #e11d48 hot crimson
  ],
  nightlights_change: [
    [2, 6, 23],      // #020617 dark night
    [245, 158, 11],  // #f59e0b warm amber
    [254, 240, 138], // #fef08a radiant yellow
  ],
  co2_concentration: [
    [6, 95, 70],     // #065f46 baseline green
    [250, 204, 21],  // #facc15 elevated yellow
    [153, 27, 27],   // #991b1b high concentration red
  ],
  aerosol_optical: [
    [15, 23, 42],    // #0f172a clean dark slate
    [217, 119, 6],   // #d97706 moderate dust amber
    [239, 68, 68],   // #ef4444 dense particulate red (no purple-orange!)
  ],
  greenland_mass: [
    [190, 18, 60],   // #be123c high mass loss red
    [244, 63, 94],   // #f43f5e moderate loss
    [56, 189, 248],  // #38bdf8 stable/positive ice mass
  ],
};

// Legend-consistent mapping function used by both the overlay and the legend bar
export function sampleDatasetRamp(datasetId: string, normalizedVal: number): [number, number, number] {
  const ramp = DATASET_COLOR_RAMPS[datasetId] || DATASET_COLOR_RAMPS.sst_anomaly;
  const clamped = Math.max(0, Math.min(1, normalizedVal));
  if (ramp.length < 2) return ramp[0] || [255, 255, 255];

  const segment = (ramp.length - 1) * clamped;
  const idx = Math.min(ramp.length - 2, Math.floor(segment));
  const subT = segment - idx;
  const c1 = ramp[idx];
  const c2 = ramp[idx + 1];

  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * subT),
    Math.round(c1[1] + (c2[1] - c1[1]) * subT),
    Math.round(c1[2] + (c2[2] - c1[2]) * subT),
  ];
}

export function getDatasetLegendGradient(datasetId: string): string {
  const ramp = DATASET_COLOR_RAMPS[datasetId] || DATASET_COLOR_RAMPS.sst_anomaly;
  const stops = ramp.map((rgb, idx) => {
    const pct = ((idx / (ramp.length - 1)) * 100).toFixed(0);
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]}) ${pct}%`;
  });
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// Convert GIBS tile sample to normalized [0, 1] scalar value
function getNormalizedValFromGibs(datasetId: string, r: number, g: number, b: number): number {
  switch (datasetId) {
    case 'sst_anomaly': {
      // Blue anomaly (-3C) to Red anomaly (+3C)
      const diff = (r - b) / 510;
      return Math.max(0, Math.min(1, 0.5 + diff));
    }
    case 'sea_ice_extent': {
      // NASA MUR Sea Ice concentration scales brightness from ~80 to 255
      return Math.max(0, Math.min(1, (g - 75) / 180));
    }
    case 'soil_moisture': {
      // SMAP Soil Moisture green channel scales moisture intensity
      return Math.max(0, Math.min(1, (g - 55) / 200));
    }
    case 'chlorophyll_a': {
      return Math.max(0, Math.min(1, (g - 25) / 215));
    }
    case 'land_surface_temp': {
      const diff = (r - b) / 510;
      return Math.max(0, Math.min(1, 0.5 + diff));
    }
    case 'nightlights_change': {
      return Math.max(0, Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 255));
    }
    case 'co2_concentration': {
      return Math.max(0, Math.min(1, (0.6 * r + 0.4 * g) / 255));
    }
    case 'aerosol_optical': {
      return Math.max(0, Math.min(1, (0.7 * r + 0.3 * g) / 255));
    }
    case 'greenland_mass': {
      return Math.max(0, Math.min(1, (b - r + 255) / 510));
    }
    default: {
      return Math.max(0, Math.min(1, (0.299 * r + 0.587 * g + 0.114 * b) / 255));
    }
  }
}

// Helper to load an image tile with retries
async function loadTileWithRetry(url: string, retries = 2): Promise<HTMLImageElement | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = (e) => reject(e);
        image.src = url;
      });
      return img;
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
  }
  return null;
}

interface EarthViewportProps {
  dataset: EicDataset;
  onSampleUpdate: (features: ReticleFeatures) => void;
}

export default function EarthViewport({ dataset, onSampleUpdate }: EarthViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 640 });
  const [lat, setLat] = useState<number>(12.0);
  const [lon, setLon] = useState<number>(45.0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [liveVal, setLiveVal] = useState<number>(0);

  const latRef = useRef(12.0);
  const lonRef = useRef(45.0);
  const zoomRef = useRef(1.0);
  latRef.current = lat;
  lonRef.current = lon;
  zoomRef.current = zoom;

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Texture state for base Earth Blue Marble
  const textureDataRef = useRef<{
    data: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);
  const [textureLoaded, setTextureLoaded] = useState(false);

  // Stitched GIBS dataset overlay caches: Map<datasetId, ImageData>
  const loadedOverlaysRef = useRef<Map<string, ImageData>>(new Map());
  const activeLoadingRef = useRef<Set<string>>(new Set());
  const [, setOverlayUpdateCounter] = useState(0);

  // Transition state for cross-fading datasets (~400ms)
  const prevDatasetRef = useRef<EicDataset | null>(null);
  const currentDatasetRef = useRef<EicDataset>(dataset);
  const transitionStartRef = useRef<number>(0);

  // Fetch & stitch NASA GIBS tiles for a dataset into an equirectangular/mercator ImageData buffer
  const loadAndStitchGibsOverlay = useCallback(async (targetDataset: EicDataset) => {
    const dsId = targetDataset.id;
    if (loadedOverlaysRef.current.has(dsId) || activeLoadingRef.current.has(dsId)) {
      return;
    }

    activeLoadingRef.current.add(dsId);
    const gibs = targetDataset.gibs;
    const zoomLvl = GIBS_TILE_ZOOM;
    const n = Math.pow(2, zoomLvl);
    const tileSize = 256;
    const fullSize = n * tileSize;

    const tilePromises: Promise<{ x: number; y: number; img: HTMLImageElement | null; url: string }>[] = [];

    for (let ty = 0; ty < n; ty++) {
      for (let tx = 0; tx < n; tx++) {
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${gibs.layerId}/default/${gibs.date}/${gibs.matrixSet}/${zoomLvl}/${ty}/${tx}.${gibs.ext}`;
        tilePromises.push(
          loadTileWithRetry(url).then((img) => ({ x: tx, y: ty, img, url }))
        );
      }
    }

    // Await all tiles before first draw
    const results = await Promise.all(tilePromises);
    const failedTiles: string[] = [];

    const stitchCanvas = document.createElement('canvas');
    stitchCanvas.width = fullSize;
    stitchCanvas.height = fullSize;
    const stitchCtx = stitchCanvas.getContext('2d', { willReadFrequently: true });

    if (stitchCtx) {
      for (const res of results) {
        if (res.img) {
          stitchCtx.drawImage(res.img, res.x * tileSize, res.y * tileSize, tileSize, tileSize);
        } else {
          failedTiles.push(res.url);
        }
      }

      if (failedTiles.length > 0) {
        console.warn(`[POLARIS] GIBS failed tiles for ${targetDataset.name}:`, failedTiles);
      }

      const stitchedData = stitchCtx.getImageData(0, 0, fullSize, fullSize);
      loadedOverlaysRef.current.set(dsId, stitchedData);
      setOverlayUpdateCounter((c) => c + 1);
    }

    activeLoadingRef.current.delete(dsId);
  }, []);

  // Trigger tile stitching on dataset switch
  useEffect(() => {
    if (dataset.id !== currentDatasetRef.current.id) {
      prevDatasetRef.current = currentDatasetRef.current;
      currentDatasetRef.current = dataset;
      transitionStartRef.current = performance.now();
    }
    loadAndStitchGibsOverlay(dataset);
  }, [dataset, loadAndStitchGibsOverlay]);

  // Pre-fetch primary datasets on mount
  useEffect(() => {
    loadAndStitchGibsOverlay(dataset);
  }, [dataset, loadAndStitchGibsOverlay]);

  // Load and pre-decode Blue Marble base texture once
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = '/blue-marble.jpg';

    img.onload = () => {
      if (cancelled) return;
      const off = document.createElement('canvas');
      off.width = img.width;
      off.height = img.height;
      const ctx = off.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, img.width, img.height);
      textureDataRef.current = {
        data: imgData.data,
        width: img.width,
        height: img.height,
      };
      setTextureLoaded(true);
    };

    return () => {
      cancelled = true;
    };
  }, []);

  // Resize observer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __setGlobeRotation?: (newLat: number, newLon: number) => void }).__setGlobeRotation = (
        newLat: number,
        newLon: number
      ) => {
        latRef.current = newLat;
        lonRef.current = newLon;
        setLat(newLat);
        setLon(newLon);
      };
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Wheel zoom (scales cell sampling, not cropping canvas)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      setZoom((prev) => Math.max(0.85, Math.min(4.5, +(prev + delta).toFixed(2))));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Feature calculation & telemetry callback
  const computeFeatures = useCallback(
    (currentLat: number, currentLon: number, currentZoom: number) => {
      const radLat = (currentLat * Math.PI) / 180;
      const radLon = (currentLon * Math.PI) / 180;

      const signal =
        0.5 +
        0.28 * Math.sin(radLon * 2 + dataset.id.length) * Math.cos(radLat * 1.5) +
        0.18 * Math.cos(radLat * 3 - radLon);

      const clamped = Math.max(0, Math.min(1, signal));
      const span = dataset.maxVal - dataset.minVal;
      const windowMean = dataset.minVal + clamped * span;

      const quadrantMeans: [number, number, number, number] = [
        dataset.minVal + Math.max(0, Math.min(1, clamped + 0.08 * Math.sin(radLon))) * span,
        dataset.minVal + Math.max(0, Math.min(1, clamped - 0.06 * Math.cos(radLat))) * span,
        dataset.minVal + Math.max(0, Math.min(1, clamped + 0.11 * Math.cos(radLon * 2))) * span,
        dataset.minVal + Math.max(0, Math.min(1, clamped - 0.09 * Math.sin(radLat * 2))) * span,
      ];

      const spatialGradient = Math.abs(Math.sin(radLat * 2.5) * Math.cos(radLon * 2.5));

      setLiveVal(windowMean);
      onSampleUpdate({
        datasetId: dataset.id,
        lat: currentLat,
        lon: currentLon,
        zoom: currentZoom,
        windowMean,
        quadrantMeans,
        spatialGradient,
      });
    },
    [dataset, onSampleUpdate]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => computeFeatures(lat, lon, zoom));
    return () => window.cancelAnimationFrame(frame);
  }, [lat, lon, zoom, dataset, computeFeatures]);

  // Main 60fps Render & Auto-rotation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const offscreenCanvas = offscreenCanvasRef.current;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    if (!offscreenCtx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let lowResImageData: ImageData | null = null;
    let cachedLowW = 0;
    let cachedLowH = 0;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // 1. Idle auto-rotation at ~1.5 deg/sec (pauses on user drag or reduced-motion)
      if (!isDragging.current && !prefersReducedMotion && AUTO_ROTATE_SPEED > 0) {
        const nextLon = ((lonRef.current + AUTO_ROTATE_SPEED * dt + 540) % 360) - 180;
        lonRef.current = nextLon;
        setLon(nextLon);
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvasSize;

      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Fit whole globe inside container centered: max diameter = min(80vh, container width - 160px, height - 70px)
      const vh80 = typeof window !== 'undefined' ? window.innerHeight * 0.8 : height * 0.8;
      const baseDiameter = Math.max(80, Math.min(vh80, width - 160, height - 70));
      const baseRadius = baseDiameter / 2;

      const cx = width / 2;
      const cy = height / 2;
      // Zoom scales the cell sampling and projection, not cropping canvas
      const radius = baseRadius * zoomRef.current;

      ctx.clearRect(0, 0, width, height);

      // Low-res mosaic dimensions (1 / CELL_SIZE)
      const lowW = Math.max(1, Math.ceil(width / CELL_SIZE));
      const lowH = Math.max(1, Math.ceil(height / CELL_SIZE));

      if (offscreenCanvas.width !== lowW || offscreenCanvas.height !== lowH) {
        offscreenCanvas.width = lowW;
        offscreenCanvas.height = lowH;
        lowResImageData = offscreenCtx.createImageData(lowW, lowH);
        cachedLowW = lowW;
        cachedLowH = lowH;
      } else if (!lowResImageData || cachedLowW !== lowW || cachedLowH !== lowH) {
        lowResImageData = offscreenCtx.createImageData(lowW, lowH);
        cachedLowW = lowW;
        cachedLowH = lowH;
      }

      const lowData = lowResImageData.data;
      lowData.fill(0);

      const lowCx = cx / CELL_SIZE;
      const lowCy = cy / CELL_SIZE;
      const lowR = radius / CELL_SIZE;
      const lowRSq = lowR * lowR;

      const minX = Math.max(0, Math.floor(lowCx - lowR));
      const maxX = Math.min(lowW - 1, Math.ceil(lowCx + lowR));
      const minY = Math.max(0, Math.floor(lowCy - lowR));
      const maxY = Math.min(lowH - 1, Math.ceil(lowCy + lowR));

      const texture = textureDataRef.current;
      const curDataset = currentDatasetRef.current;
      const prevDataset = prevDatasetRef.current;
      const elapsedTransition = time - transitionStartRef.current;
      const transitionProgress = Math.min(1, Math.max(0, elapsedTransition / 400));

      const latRad = (latRef.current * Math.PI) / 180;
      const lonRad = (lonRef.current * Math.PI) / 180;
      const cosLat = Math.cos(latRad);
      const sinLat = Math.sin(latRad);
      const cosLon = Math.cos(lonRad);
      const sinLon = Math.sin(lonRad);

      const texW = texture ? texture.width : 2048;
      const texH = texture ? texture.height : 1024;
      const texData = texture ? texture.data : null;

      const curOverlay = loadedOverlaysRef.current.get(curDataset.id) || null;
      const prevOverlay = prevDataset ? loadedOverlaysRef.current.get(prevDataset.id) || null : null;

      // Render each pixel in the low-res mosaic buffer using true inverse orthographic spherical projection
      for (let ly = minY; ly <= maxY; ly++) {
        const dy = ly - lowCy;
        const dySq = dy * dy;

        for (let lx = minX; lx <= maxX; lx++) {
          const dx = lx - lowCx;
          const distSq = dx * dx + dySq;
          if (distSq > lowRSq) continue;

          // 1. Convert screen position to normalized sphere normal (nx, ny, nz)
          const nx = dx / lowR;
          const ny = -dy / lowR; // screen y is down, north is positive ny
          const nz = Math.sqrt(Math.max(0, 1.0 - nx * nx - ny * ny));

          // 2. 3D sphere rotation by pitch (lat) and yaw (lon)
          const y1 = ny * cosLat + nz * sinLat;
          const z1 = -ny * sinLat + nz * cosLat;
          const x2 = nx * cosLon + z1 * sinLon;
          const z2 = -nx * sinLon + z1 * cosLon;
          const y2 = y1;

          // Inverse orthographic geodetic coordinates (pLat, pLon)
          const pLat = Math.asin(Math.max(-1, Math.min(1, y2)));
          const pLon = Math.atan2(x2, z2);

          const latDeg = (pLat * 180) / Math.PI;
          const lonDeg = (pLon * 180) / Math.PI;

          // 3. Base Earth Blue Marble True-Colour Sampling
          let baseR = 15;
          let baseG = 25;
          let baseB = 55;

          if (texData) {
            const u = (pLon + Math.PI) / (Math.PI * 2);
            const v = 0.5 - pLat / Math.PI;
            const tx = Math.max(0, Math.min(texW - 1, (u * texW) | 0));
            const ty = Math.max(0, Math.min(texH - 1, (v * texH) | 0));
            const texIdx = (ty * texW + tx) << 2;
            baseR = texData[texIdx];
            baseG = texData[texIdx + 1];
            baseB = texData[texIdx + 2];
          }

          // Lift exposure so oceans are deep blue, forests green, deserts tan, clouds/ice white
          baseR = Math.min(255, Math.pow(baseR / 255, 0.82) * 255 * 1.25);
          baseG = Math.min(255, Math.pow(baseG / 255, 0.82) * 255 * 1.22);
          baseB = Math.min(255, Math.pow(baseB / 255, 0.82) * 255 * 1.36);

          // 8. Spherical limb darkening: 0.45 + 0.55 * pow(nz, 0.6)
          const limb = 0.45 + 0.55 * Math.pow(Math.max(0, nz), 0.6);
          baseR *= limb;
          baseG *= limb;
          baseB *= limb;

          // +/-3% static brightness jitter per cell (sensor noise, static, not flickering)
          const noise =
            ((((lx * 13 + ly * 79) * 1013904223) & 0xff) / 255) * 0.06 - 0.03;
          const luminance = 1 + noise;
          baseR = Math.min(255, Math.max(0, baseR * luminance));
          baseG = Math.min(255, Math.max(0, baseG * luminance));
          baseB = Math.min(255, Math.max(0, baseB * luminance));

          // 4. Sample Dataset Overlay via Spherical Web Mercator Mapping
          let finalR = baseR;
          let finalG = baseG;
          let finalB = baseB;

          // Web Mercator projection bounds
          if (latDeg >= -85.0511 && latDeg <= 85.0511) {
            const uNorm = (lonDeg + 180) / 360;
            const rad = (latDeg * Math.PI) / 180;
            const vNorm = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;

            // Helper to sample a stitched dataset overlay
            const sampleOverlay = (overlayImg: ImageData, dsId: string) => {
              const oW = overlayImg.width;
              const oH = overlayImg.height;
              const ox = Math.max(0, Math.min(oW - 1, Math.floor(uNorm * oW)));
              const oy = Math.max(0, Math.min(oH - 1, Math.floor(vNorm * oH)));
              const oIdx = (oy * oW + ox) << 2;

              const oR = overlayImg.data[oIdx];
              const oG = overlayImg.data[oIdx + 1];
              const oB = overlayImg.data[oIdx + 2];
              const oA = overlayImg.data[oIdx + 3];

              // Skip missing data, transparency, and flat grey nodata fill
              if (oA < 15) return null;
              if (dsId === 'soil_moisture' && Math.abs(oR - oG) < 6 && Math.abs(oG - oB) < 6 && Math.abs(oR - 80) < 15) {
                return null;
              }

              const val = getNormalizedValFromGibs(dsId, oR, oG, oB);
              const rampColor = sampleDatasetRamp(dsId, val);
              // Apply matching limb darkening and static sensor noise to overlay cell
              return [
                rampColor[0] * limb * luminance,
                rampColor[1] * limb * luminance,
                rampColor[2] * limb * luminance,
              ];
            };

            const curSample = curOverlay ? sampleOverlay(curOverlay, curDataset.id) : null;
            const prevSample = prevDataset && prevOverlay && transitionProgress < 1
              ? sampleOverlay(prevOverlay, prevDataset.id)
              : null;

            if (prevSample && curSample && transitionProgress < 1) {
              const pAlpha = (1 - transitionProgress) * OVERLAY_OPACITY;
              const cAlpha = transitionProgress * OVERLAY_OPACITY;
              const totalAlpha = pAlpha + cAlpha;
              const inv = 1 - totalAlpha;
              finalR = baseR * inv + prevSample[0] * pAlpha + curSample[0] * cAlpha;
              finalG = baseG * inv + prevSample[1] * pAlpha + curSample[1] * cAlpha;
              finalB = baseB * inv + prevSample[2] * pAlpha + curSample[2] * cAlpha;
            } else if (curSample) {
              finalR = baseR * (1 - OVERLAY_OPACITY) + curSample[0] * OVERLAY_OPACITY;
              finalG = baseG * (1 - OVERLAY_OPACITY) + curSample[1] * OVERLAY_OPACITY;
              finalB = baseB * (1 - OVERLAY_OPACITY) + curSample[2] * OVERLAY_OPACITY;
            } else if (prevSample && transitionProgress < 1) {
              const pAlpha = (1 - transitionProgress) * OVERLAY_OPACITY;
              finalR = baseR * (1 - pAlpha) + prevSample[0] * pAlpha;
              finalG = baseG * (1 - pAlpha) + prevSample[1] * pAlpha;
              finalB = baseB * (1 - pAlpha) + prevSample[2] * pAlpha;
            }
          }

          const pixelIdx = (ly * lowW + lx) << 2;
          lowData[pixelIdx] = Math.min(255, Math.max(0, finalR | 0));
          lowData[pixelIdx + 1] = Math.min(255, Math.max(0, finalG | 0));
          lowData[pixelIdx + 2] = Math.min(255, Math.max(0, finalB | 0));
          lowData[pixelIdx + 3] = 255;
        }
      }

      offscreenCtx.putImageData(lowResImageData, 0, 0);

      // 5. Draw Soft Atmospheric Outer Glow (radial gradient, 20-30px falloff)
      const glow = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.98,
        cx,
        cy,
        radius + GLOW_RADIUS
      );
      glow.addColorStop(0, GLOW_COLOR);
      glow.addColorStop(0.35, 'rgba(229, 109, 54, 0.12)');
      glow.addColorStop(0.7, 'rgba(229, 109, 54, 0.04)');
      glow.addColorStop(1, 'rgba(229, 109, 54, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + GLOW_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // 6. Draw Pixel-Mosaic Globe with Crisp Blocky Edges & Clean Circular Silhouette
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip(); // Clean circular silhouette edge

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreenCanvas, 0, 0, lowW, lowH, 0, 0, width, height);
      ctx.restore();

      // 7. Thin 1px Warm-Orange/Copper Rim Line around Globe Silhouette
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = RIM_COLOR;
      ctx.lineWidth = 1.0;
      ctx.stroke();

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [canvasSize, textureLoaded]);

  // Pointer drag controls
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    const sensitivity = 0.35 / Math.sqrt(zoomRef.current);
    const nextLon = ((lonRef.current - dx * sensitivity + 540) % 360) - 180;
    const nextLat = Math.max(-85, Math.min(85, latRef.current + dy * sensitivity));

    lonRef.current = nextLon;
    latRef.current = nextLat;
    setLon(nextLon);
    setLat(nextLat);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      const nextLon = ((lonRef.current - 5 + 540) % 360) - 180;
      lonRef.current = nextLon;
      setLon(nextLon);
    }
    if (e.key === 'ArrowRight') {
      const nextLon = ((lonRef.current + 5 + 540) % 360) - 180;
      lonRef.current = nextLon;
      setLon(nextLon);
    }
    if (e.key === 'ArrowUp') {
      const nextLat = Math.min(85, latRef.current + 5);
      latRef.current = nextLat;
      setLat(nextLat);
    }
    if (e.key === 'ArrowDown') {
      const nextLat = Math.max(-85, latRef.current - 5);
      latRef.current = nextLat;
      setLat(nextLat);
    }
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4.5, +(z + 0.2).toFixed(2)));
    if (e.key === '-') setZoom((z) => Math.max(0.85, +(z - 0.2).toFixed(2)));
  };

  return (
    <section
      aria-label="Earth visualization viewport"
      className="relative h-full w-full select-none overflow-hidden bg-[#07080b] [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:48px_48px]"
    >
      {/* Globe canvas */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label="Interactive Earth pixel-mosaic globe. Drag or use arrow keys to rotate, scroll wheel to zoom."
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="absolute inset-0 h-full w-full cursor-grab touch-none focus:outline-none active:cursor-grabbing"
      >
        <canvas ref={canvasRef} className="block h-full w-full [image-rendering:pixelated]" />
      </div>

      {/* Floating Coordinates, Live Value, and ROI Size: Pure small mono text, NO pill/box */}
      <div className="pointer-events-none absolute right-6 top-3 z-20 flex flex-wrap items-center gap-2.5 font-mono text-[11px] tracking-wider text-white/50 sm:right-8 sm:top-3">
        <span>
          {Math.abs(lat).toFixed(1)}°{lat >= 0 ? 'N' : 'S'}&nbsp;{Math.abs(lon).toFixed(1)}°{lon >= 0 ? 'E' : 'W'}
        </span>
        <span className="text-white/20">·</span>
        <div className="inline-flex items-center gap-1">
          <span className="text-[#e56d36] font-mono font-medium tracking-normal">
            {liveVal.toFixed(2)}
          </span>
          <span className="text-white/40 text-[10px]">{dataset.unit}</span>
        </div>
        <span className="text-white/20">·</span>
        <span className="text-white/40 uppercase text-[10px]">256×256 ROI</span>
      </div>

      {/* ROI RETICLE: Four thin white L-shaped corner brackets (22px arms, 1.5px stroke),
          fixed to viewport center while the globe rotates beneath them */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[132px] w-[132px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center"
      >
        <div className="relative h-full w-full">
          {/* Top Left Bracket */}
          <span className="absolute left-0 top-0 h-[22px] w-[22px] border-l-[1.5px] border-t-[1.5px] border-white" />
          {/* Top Right Bracket */}
          <span className="absolute right-0 top-0 h-[22px] w-[22px] border-r-[1.5px] border-t-[1.5px] border-white" />
          {/* Bottom Left Bracket */}
          <span className="absolute bottom-0 left-0 h-[22px] w-[22px] border-b-[1.5px] border-l-[1.5px] border-white" />
          {/* Bottom Right Bracket */}
          <span className="absolute bottom-0 right-0 h-[22px] w-[22px] border-b-[1.5px] border-r-[1.5px] border-white" />

          {/* Center 8px sample point with faint glow */}
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]" />
        </div>

        {/* 256×256 ROI letter-spaced uppercase mono label centered under bottom brackets with dark text shadow */}
        <span
          className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/85 whitespace-nowrap"
          style={{ textShadow: '0 0 6px rgba(0,0,0,0.8)' }}
        >
          256×256 ROI
        </span>
      </div>

      {/* Minimal floating zoom controls: inside container with >= 24px padding from right edge */}
      <div className="absolute right-6 sm:right-8 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1 font-mono text-[10px] text-white/50">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4.5, +(z + 0.25).toFixed(2)))}
          aria-label="Zoom in"
          className="cursor-pointer p-1 text-white/40 transition hover:text-white"
        >
          <ZoomIn className="h-3.5 w-3.5 stroke-[1.5]" />
        </button>
        <span className="py-0.5 font-mono text-[10px] text-white/70">{zoom.toFixed(1)}×</span>
        <button
          type="button"
          onClick={() => setZoom(1.0)}
          aria-label="Fit globe to view"
          className="cursor-pointer px-1 py-0.5 text-[9px] tracking-widest text-white/40 transition hover:text-white"
        >
          FIT
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.25).toFixed(2)))}
          aria-label="Zoom out"
          className="cursor-pointer p-1 text-white/40 transition hover:text-white"
        >
          <ZoomOut className="h-3.5 w-3.5 stroke-[1.5]" />
        </button>
      </div>

      {/* Color scale & geographic presets: tiny, borderless floating rail */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-2 z-20 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 font-mono text-[10px] sm:px-8">
        <div className="flex items-center gap-2 text-white/50">
          <span className="tabular-nums">{dataset.minVal}</span>
          <div
            role="img"
            aria-label={`Color scale from ${dataset.minVal} to ${dataset.maxVal} ${dataset.unit}`}
            className="h-1.5 w-24 overflow-hidden rounded-full border-none shadow-none"
            style={{ background: getDatasetLegendGradient(dataset.id) }}
          />
          <span className="tabular-nums">
            {dataset.maxVal} <span className="text-white/35">{dataset.unit}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {dataset.hotspots.map((spot) => (
            <button
              key={spot.id}
              type="button"
              onClick={() => {
                setLat(spot.lat);
                setLon(spot.lon);
              }}
              className="inline-flex cursor-pointer items-center gap-1 text-[10px] text-white/40 transition hover:text-white"
            >
              <MapPin className="h-3 w-3 text-[#e56d36]" />
              <span>{spot.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
