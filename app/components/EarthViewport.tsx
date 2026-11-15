// app/components/EarthViewport.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EicDataset, ReticleFeatures } from '../lib/datasets';
import { buildGibsTileUrl } from '../lib/gibsOffscreen';
import { Crosshair, MapPin, Minus, Plus } from 'lucide-react';

interface EarthViewportProps {
  dataset: EicDataset;
  onSampleUpdate: (features: ReticleFeatures & { zoom?: number }) => void;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MOSAIC_ZOOM = 1; // 2x2 grid of 256x256 tiles = 512x512 global texture (4x faster load)
const TILE_SIZE = 256;
const MOSAIC_DIM = TILE_SIZE * Math.pow(2, MOSAIC_ZOOM); // 512

// Module-level cache so Blue Marble base Earth is fetched ONLY ONCE across all dataset switches
let cachedBaseEarthCanvas: HTMLCanvasElement | null = null;
let baseEarthPromise: Promise<HTMLCanvasElement> | null = null;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function getBaseEarthCanvas(): Promise<HTMLCanvasElement> {
  if (cachedBaseEarthCanvas) return Promise.resolve(cachedBaseEarthCanvas);
  if (baseEarthPromise) return baseEarthPromise;

  baseEarthPromise = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = MOSAIC_DIM;
    canvas.height = MOSAIC_DIM;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#071324';
    ctx.fillRect(0, 0, MOSAIC_DIM, MOSAIC_DIM);

    const n = Math.pow(2, MOSAIC_ZOOM);
    const jobs: Promise<void>[] = [];
    for (let ty = 0; ty < n; ty++) {
      for (let tx = 0; tx < n; tx++) {
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-01-01/GoogleMapsCompatible_Level8/${MOSAIC_ZOOM}/${ty}/${tx}.jpg`;
        jobs.push(
          loadImage(url).then((img) => {
            if (img) ctx.drawImage(img, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          })
        );
      }
    }
    await Promise.all(jobs);

    // Offline fallback: if GIBS Blue Marble tiles failed to load, draw local /earth.png
    const pixelCheck = ctx.getImageData(MOSAIC_DIM / 2, MOSAIC_DIM / 2, 1, 1).data;
    if (pixelCheck[0] === 7 && pixelCheck[1] === 19 && pixelCheck[2] === 36) {
      const localEarth = await loadImage('/earth.png');
      if (localEarth) {
        ctx.drawImage(localEarth, 0, 0, MOSAIC_DIM, MOSAIC_DIM);
      }
    }

    cachedBaseEarthCanvas = canvas;
    return canvas;
  })();

  return baseEarthPromise;
}

export default function EarthViewport({ dataset, onSampleUpdate }: EarthViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tmpCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const centerRef = useRef<{ lat: number; lon: number }>({ lat: 12.0, lon: 45.0 });
  const targetRef = useRef<{ lat: number; lon: number } | null>(null);
  const zoomRef = useRef<number>(1.0);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; lat: number; lon: number }>({
    x: 0,
    y: 0,
    lat: 12.0,
    lon: 45.0,
  });

  // Dirty flag: only re-raycast the sphere when orientation, zoom, size, or tile pixels change
  const needsRenderRef = useRef<boolean>(true);
  const isVisibleRef = useRef<boolean>(true);
  const globalPixelsRef = useRef<Uint8ClampedArray | null>(null);

  const [hudCoords, setHudCoords] = useState({ lat: 12.0, lon: 45.0 });
  const [hudValue, setHudValue] = useState<number>(
    (dataset.minVal + dataset.maxVal) / 2
  );
  const [zoomLabel, setZoomLabel] = useState<string>('1.0x');

  const emitReticleSample = useCallback(
    (lat: number, lon: number, zoom: number) => {
      const pixels = globalPixelsRef.current;
      let norm = 0.5;
      const qNorms: [number, number, number, number] = [0.5, 0.5, 0.5, 0.5];
      let gradient = 0.25;

      if (pixels) {
        const clampedLat = Math.max(-85.05, Math.min(85.05, lat));
        const xNorm = ((((lon + 180) % 360) + 360) % 360) / 360;
        const latRad = clampedLat * DEG2RAD;
        const yNorm =
          (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;

        const cx = Math.floor(xNorm * (MOSAIC_DIM - 1));
        const cy = Math.max(
          0,
          Math.min(MOSAIC_DIM - 1, Math.floor(yNorm * (MOSAIC_DIM - 1)))
        );

        const sampleAt = (sx: number, sy: number) => {
          const wx = ((sx % MOSAIC_DIM) + MOSAIC_DIM) % MOSAIC_DIM;
          const wy = Math.max(0, Math.min(MOSAIC_DIM - 1, sy));
          const idx = (wy * MOSAIC_DIM + wx) * 4;
          const a = pixels[idx + 3];
          if (a === 0) return 0.2;
          return (
            (0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]) /
            255
          );
        };

        qNorms[0] = sampleAt(cx - 3, cy - 3);
        qNorms[1] = sampleAt(cx + 3, cy - 3);
        qNorms[2] = sampleAt(cx - 3, cy + 3);
        qNorms[3] = sampleAt(cx + 3, cy + 3);
        norm = (qNorms[0] + qNorms[1] + qNorms[2] + qNorms[3]) / 4;
        gradient = Math.min(1, (Math.max(...qNorms) - Math.min(...qNorms)) * 2.5);
      }

      const mapVal = (n: number) =>
        dataset.minVal + n * (dataset.maxVal - dataset.minVal);

      const windowMean = mapVal(norm);
      setHudValue(windowMean);

      onSampleUpdate({
        datasetId: dataset.id,
        lat,
        lon,
        zoom,
        windowMean,
        quadrantMeans: [
          mapVal(qNorms[0]),
          mapVal(qNorms[1]),
          mapVal(qNorms[2]),
          mapVal(qNorms[3]),
        ],
        spatialGradient: gradient,
      });
    },
    [dataset, onSampleUpdate]
  );

  // 1. Composite cached Blue Marble Earth immediately, then stream the 4 dataset tiles progressively
  useEffect(() => {
    let cancelled = false;
    const offscreen = document.createElement('canvas');
    offscreen.width = MOSAIC_DIM;
    offscreen.height = MOSAIC_DIM;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const commitBuffer = () => {
      if (cancelled) return;
      globalPixelsRef.current = ctx.getImageData(0, 0, MOSAIC_DIM, MOSAIC_DIM).data;
      needsRenderRef.current = true;
      emitReticleSample(centerRef.current.lat, centerRef.current.lon, zoomRef.current);
    };

    (async () => {
      // Paint cached Blue Marble continents right away (0ms on every dataset switch after first load)
      const baseCanvas = await getBaseEarthCanvas();
      if (cancelled) return;
      ctx.drawImage(baseCanvas, 0, 0);
      commitBuffer();

      // Stream the 4 scientific GIBS tiles (z=1) and repaint as each one arrives
      const n = Math.pow(2, MOSAIC_ZOOM);
      const dataGibs = { ...dataset.gibs, zoom: MOSAIC_ZOOM };

      for (let ty = 0; ty < n; ty++) {
        for (let tx = 0; tx < n; tx++) {
          const url = buildGibsTileUrl(dataGibs, tx, ty);
          loadImage(url).then((img) => {
            if (!img || cancelled) return;
            ctx.globalAlpha = dataset.id === 'nightlights_change' ? 0.92 : 0.82;
            ctx.drawImage(img, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            ctx.globalAlpha = 1.0;
            commitBuffer();
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataset, emitReticleSample]);

  // 2. Observe visibility & container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) needsRenderRef.current = true;
      },
      { threshold: 0.05 }
    );
    io.observe(el);

    const ro = new ResizeObserver(() => {
      needsRenderRef.current = true;
    });
    ro.observe(el);

    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);

  // 3. On-Demand 3D Orthographic Globe Renderer (zero CPU/GPU work when idle)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!tmpCanvasRef.current) {
      tmpCanvasRef.current = document.createElement('canvas');
    }

    let rafId = 0;

    const renderGlobe = () => {
      rafId = requestAnimationFrame(renderGlobe);
      if (!isVisibleRef.current) return;

      // Animate smooth fly-to hotspot
      if (targetRef.current) {
        const dLat = targetRef.current.lat - centerRef.current.lat;
        let dLon = targetRef.current.lon - centerRef.current.lon;
        if (dLon > 180) dLon -= 360;
        if (dLon < -180) dLon += 360;

        if (Math.abs(dLat) < 0.08 && Math.abs(dLon) < 0.08) {
          centerRef.current = { ...targetRef.current };
          targetRef.current = null;
          setHudCoords({ ...centerRef.current });
          emitReticleSample(centerRef.current.lat, centerRef.current.lon, zoomRef.current);
        } else {
          centerRef.current.lat += dLat * 0.14;
          centerRef.current.lon =
            ((centerRef.current.lon + dLon * 0.14 + 540) % 360) - 180;
          setHudCoords({ ...centerRef.current });
        }
        needsRenderRef.current = true;
      }

      if (!needsRenderRef.current) return;
      needsRenderRef.current = false;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.36 * zoomRef.current;

      // Outer atmospheric halo
      const halo = ctx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.92,
        cx,
        cy,
        baseRadius * 1.16
      );
      halo.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      halo.addColorStop(0.55, 'rgba(239, 132, 80, 0.12)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.16, 0, Math.PI * 2);
      ctx.fill();

      const pixels = globalPixelsRef.current;
      if (!pixels) return;

      const step = 2;
      const rInt = Math.ceil(baseRadius);
      const minX = Math.max(0, Math.floor(cx - rInt));
      const maxX = Math.min(width - 1, Math.ceil(cx + rInt));
      const minY = Math.max(0, Math.floor(cy - rInt));
      const maxY = Math.min(height - 1, Math.ceil(cy + rInt));

      const boxW = Math.ceil((maxX - minX) / step);
      const boxH = Math.ceil((maxY - minY) / step);
      if (boxW <= 0 || boxH <= 0) return;

      const imgData = ctx.createImageData(boxW, boxH);
      const out = imgData.data;

      const lat0 = centerRef.current.lat * DEG2RAD;
      const lon0 = centerRef.current.lon * DEG2RAD;
      const sinLat0 = Math.sin(lat0);
      const cosLat0 = Math.cos(lat0);
      const invR = 1 / baseRadius;

      for (let py = 0; py < boxH; py++) {
        const yNorm = (minY + py * step - cy) * invR;
        const y2 = yNorm * yNorm;
        if (y2 >= 1) continue;

        for (let px = 0; px < boxW; px++) {
          const xNorm = (minX + px * step - cx) * invR;
          const rho2 = xNorm * xNorm + y2;
          if (rho2 > 1) continue;

          const z = Math.sqrt(1 - rho2);
          const lat = Math.asin(z * sinLat0 - yNorm * cosLat0);
          const lon = lon0 + Math.atan2(xNorm, z * cosLat0 + yNorm * sinLat0);

          const u = ((((lon * RAD2DEG + 180) % 360) + 360) % 360) / 360;
          const clampedLat = Math.max(-1.4844, Math.min(1.4844, lat));
          const v =
            (1 - Math.log(Math.tan(clampedLat) + 1 / Math.cos(clampedLat)) / Math.PI) / 2;

          const tx = Math.floor(u * (MOSAIC_DIM - 1));
          const ty = Math.max(
            0,
            Math.min(MOSAIC_DIM - 1, Math.floor(v * (MOSAIC_DIM - 1)))
          );
          const srcIdx = (ty * MOSAIC_DIM + tx) * 4;

          const shade =
            0.42 + 0.58 * Math.max(0, z * 0.85 - xNorm * 0.35 - yNorm * 0.25);

          const dstIdx = (py * boxW + px) * 4;
          out[dstIdx] = Math.min(255, pixels[srcIdx] * shade);
          out[dstIdx + 1] = Math.min(255, pixels[srcIdx + 1] * shade);
          out[dstIdx + 2] = Math.min(255, pixels[srcIdx + 2] * shade);
          out[dstIdx + 3] = 255;
        }
      }

      const tmp = tmpCanvasRef.current!;
      if (tmp.width !== boxW || tmp.height !== boxH) {
        tmp.width = boxW;
        tmp.height = boxH;
      }
      const tmpCtx = tmp.getContext('2d');
      if (tmpCtx) {
        tmpCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(tmp, minX, minY, boxW * step, boxH * step);
      }

      ctx.strokeStyle = 'rgba(239, 132, 80, 0.55)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.stroke();
    };

    rafId = requestAnimationFrame(renderGlobe);
    return () => cancelAnimationFrame(rafId);
  }, [emitReticleSample]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    targetRef.current = null;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      lat: centerRef.current.lat,
      lon: centerRef.current.lon,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const sensitivity = 0.35 / zoomRef.current;

    const nextLat = Math.max(
      -82,
      Math.min(82, dragStartRef.current.lat + dy * sensitivity)
    );
    const nextLon =
      ((((dragStartRef.current.lon - dx * sensitivity + 180) % 360) + 360) % 360) -
      180;

    centerRef.current = { lat: nextLat, lon: nextLon };
    needsRenderRef.current = true;
    setHudCoords({ lat: nextLat, lon: nextLon });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    emitReticleSample(centerRef.current.lat, centerRef.current.lon, zoomRef.current);
  };

  const adjustZoom = (delta: number | 'fit') => {
    const nextZoom =
      delta === 'fit'
        ? 1.0
        : Math.max(0.7, Math.min(2.4, Number((zoomRef.current + delta).toFixed(2))));
    zoomRef.current = nextZoom;
    needsRenderRef.current = true;
    setZoomLabel(`${nextZoom.toFixed(1)}x`);
    emitReticleSample(centerRef.current.lat, centerRef.current.lon, nextZoom);
  };

  const flyToHotspot = (lat: number, lon: number) => {
    targetRef.current = { lat, lon };
    needsRenderRef.current = true;
  };

  const latDir = hudCoords.lat >= 0 ? 'N' : 'S';
  const lonDir = hudCoords.lon >= 0 ? 'E' : 'W';

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative h-full w-full select-none overflow-hidden rounded-2xl border border-white/[0.1] bg-[#06080b] cursor-grab active:cursor-grabbing"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:48px_48px]"
        aria-hidden="true"
      />

      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Top-Left Dataset Pill */}
      <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2 rounded-lg border border-white/[0.1] bg-black/75 px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase backdrop-blur-md">
        <Crosshair className="h-3.5 w-3.5 text-[#ef8450]" />
        <span className="font-semibold text-white">{dataset.shortCode}</span>
        <span className="text-white/30">/</span>
        <span className="text-zinc-300">{dataset.name}</span>
      </div>

      {/* Top-Right Telemetry Readout */}
      <div className="pointer-events-none absolute right-3.5 top-3.5 rounded-lg border border-white/[0.1] bg-black/75 px-3 py-1.5 font-mono text-[11px] tabular-nums backdrop-blur-md">
        <span className="text-zinc-300">
          {Math.abs(hudCoords.lat).toFixed(1)}°{latDir}{' '}
          {Math.abs(hudCoords.lon).toFixed(1)}°{lonDir}
        </span>
        <span className="mx-2 text-white/25">/</span>
        <span className="font-semibold text-[#f0a078]">
          {hudValue.toFixed(2)} {dataset.unit}
        </span>
      </div>

      {/* Center 256x256 ROI Reticle Overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-40 w-40 sm:h-48 sm:w-48">
          <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-white/75" />
          <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-white/75" />
          <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-white/75" />
          <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-white/75" />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_#fff]" />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] tracking-[0.2em] text-white/55">
            256×256 ROI
          </span>
        </div>
      </div>

      {/* Right Zoom Control Stack */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-3.5 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-white/[0.1] bg-black/80 p-1.5 font-mono text-[10px] backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => adjustZoom(0.2)}
          aria-label="Zoom in"
          className="cursor-pointer rounded-md p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="py-0.5 text-[9px] tabular-nums text-zinc-400">{zoomLabel}</span>
        <button
          type="button"
          onClick={() => adjustZoom('fit')}
          className="cursor-pointer rounded-md px-1.5 py-1 text-[9px] uppercase text-zinc-400 hover:bg-white/10 hover:text-white"
        >
          FIT
        </button>
        <button
          type="button"
          onClick={() => adjustZoom(-0.2)}
          aria-label="Zoom out"
          className="cursor-pointer rounded-md p-1.5 text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Bottom-Left Colorbar Scale */}
      <div className="pointer-events-none absolute bottom-3.5 left-3.5 flex items-center gap-2 rounded-lg border border-white/[0.1] bg-black/75 px-3 py-1.5 font-mono text-[10px] tabular-nums backdrop-blur-md">
        <span className="text-zinc-400">{dataset.minVal}</span>
        <span
          className="h-2 w-24 rounded-full"
          style={{ background: dataset.colorGradient }}
        />
        <span className="text-zinc-300">
          {dataset.maxVal} {dataset.unit}
        </span>
      </div>

      {/* Bottom-Right Hotspot Quick-Jump Pills */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-3.5 right-3.5 flex flex-wrap justify-end gap-1.5"
      >
        {dataset.hotspots.map((spot) => (
          <button
            key={spot.id}
            type="button"
            onClick={() => flyToHotspot(spot.lat, spot.lon)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.12] bg-black/80 px-2.5 py-1.5 font-mono text-[10px] text-zinc-200 backdrop-blur-md transition hover:border-[#ef8450]/60 hover:text-white"
          >
            <MapPin className="h-3 w-3 text-[#ef8450]" />
            {spot.label}
          </button>
        ))}
      </div>
    </div>
  );
}