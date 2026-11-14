// app/components/EarthViewport.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EicDataset, ReticleFeatures } from '../lib/datasets';
import { Crosshair, MapPin, ZoomIn, ZoomOut } from 'lucide-react';

interface EarthViewportProps {
  dataset: EicDataset;
  onSampleUpdate: (features: ReticleFeatures) => void;
}

export default function EarthViewport({ dataset, onSampleUpdate }: EarthViewportProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 520 });
  const [lat, setLat] = useState<number>(12.0);
  const [lon, setLon] = useState<number>(45.0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [liveVal, setLiveVal] = useState<number>(0);

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
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

  const computeFeatures = useCallback(
    (currentLat: number, currentLon: number) => {
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
        windowMean,
        quadrantMeans,
        spatialGradient,
      });
    },
    [dataset, onSampleUpdate]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => computeFeatures(lat, lon));
    return () => window.cancelAnimationFrame(frame);
  }, [lat, lon, dataset, computeFeatures]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvasSize;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    // Bias the globe upward to keep its lower edge clear of the fixed color-scale rail.
    const cy = height * 0.44;
    const radius = Math.min(width, height) * 0.46 * zoom;

    ctx.clearRect(0, 0, width, height);

    // Restrained starfield to connect the workspace to the landing hero.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let s = 0; s < 55; s++) {
      const sx = ((s * 197) % width);
      const sy = ((s * 313) % height);
      const r = s % 3 === 0 ? 1.1 : 0.65;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Faint atmospheric edge; the data field itself remains dataset-driven.
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius * 1.22);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.055)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.22, 0, Math.PI * 2);
    ctx.fill();

    // Globe sphere — dataset colors and all sampling geometry are preserved.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const sphereGrad = ctx.createRadialGradient(
      cx - radius * 0.28,
      cy - radius * 0.28,
      radius * 0.06,
      cx,
      cy,
      radius
    );
    sphereGrad.addColorStop(0, dataset.fallbackColors[2]);
    sphereGrad.addColorStop(0.55, dataset.fallbackColors[1]);
    sphereGrad.addColorStop(1, dataset.fallbackColors[0]);
    ctx.fillStyle = sphereGrad;
    ctx.fillRect(0, 0, width, height);

    const lonRad = (lon * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;

    // Organic data contours.
    for (let i = -5; i <= 5; i++) {
      const bandY = cy + (i / 5) * radius * 0.85 + Math.sin(latRad) * (radius * 0.14);
      ctx.beginPath();
      for (let x = Math.max(0, cx - radius); x <= Math.min(width, cx + radius); x += 8) {
        const nx = (x - cx) / radius;
        const wave =
          Math.sin(nx * 3.5 + lonRad + i) * (radius * 0.08) +
          Math.cos(nx * 6 - lonRad * 1.4) * (radius * 0.04);
        if (x <= Math.max(0, cx - radius) + 8) ctx.moveTo(x, bandY + wave);
        else ctx.lineTo(x, bandY + wave);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.105)';
      ctx.lineWidth = 1.15;
      ctx.stroke();
    }

    // Subtle geographic graticules.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.065)';
    ctx.lineWidth = 0.85;
    for (let g = -2; g <= 2; g++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * Math.cos((g * Math.PI) / 6), radius, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius, radius * Math.cos((g * Math.PI) / 6), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const innerShadow = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius);
    innerShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    innerShadow.addColorStop(1, 'rgba(0, 0, 0, 0.52)');
    ctx.fillStyle = innerShadow;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }, [dataset, lat, lon, zoom, canvasSize]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    const sensitivity = 0.35 / Math.sqrt(zoom);
    setLon((prev) => ((prev - dx * sensitivity + 540) % 360) - 180);
    setLat((prev) => Math.max(-85, Math.min(85, prev + dy * sensitivity)));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setLon((p) => ((p - 5 + 540) % 360) - 180);
    if (e.key === 'ArrowRight') setLon((p) => ((p + 5 + 540) % 360) - 180);
    if (e.key === 'ArrowUp') setLat((p) => Math.min(85, p + 5));
    if (e.key === 'ArrowDown') setLat((p) => Math.max(-85, p - 5));
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4.5, +(z + 0.2).toFixed(2)));
    if (e.key === '-') setZoom((z) => Math.max(0.85, +(z - 0.2).toFixed(2)));
  };

  return (
    <section
      aria-label="Earth visualization viewport"
      className="polaris-instrument-surface relative h-full w-full select-none overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#080909] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
    >
      <div
        ref={containerRef}
        tabIndex={0}
        role="application"
        aria-label="Interactive Earth globe. Drag or use arrow keys to rotate, scroll wheel or plus and minus to zoom."
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="absolute inset-0 h-full w-full cursor-grab touch-none focus:outline-none active:cursor-grabbing"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* Dataset identity */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2.5 rounded-full border border-white/[0.13] bg-[#090a0a]/75 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.15em] backdrop-blur-md sm:left-6 sm:top-5">
        <Crosshair className="h-3 w-3 text-white/65" />
        <span className="text-white/85">{dataset.shortCode}</span>
        <span className="text-white/25">/</span>
        <span className="max-w-[42vw] truncate text-white/50">{dataset.name}</span>
      </div>

      {/* Coordinate and live value readout */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 hidden rounded-full border border-white/[0.13] bg-[#090a0a]/75 px-3 py-2 font-mono text-[8px] tracking-[0.1em] text-white/65 backdrop-blur-md sm:block sm:right-6 sm:top-5">
        {Math.abs(lat).toFixed(1)}°{lat >= 0 ? 'N' : 'S'}&nbsp;&nbsp;
        {Math.abs(lon).toFixed(1)}°{lon >= 0 ? 'E' : 'W'}
        <span className="mx-3 text-white/20">/</span>
        <span className="text-[#f0a078]">{liveVal.toFixed(2)} {dataset.unit}</span>
      </div>

      {/* Sampling reticle */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[44%] z-10 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
      >
        <span className="absolute left-0 top-0 h-3.5 w-3.5 border-l border-t border-white/70" />
        <span className="absolute right-0 top-0 h-3.5 w-3.5 border-r border-t border-white/70" />
        <span className="absolute bottom-0 left-0 h-3.5 w-3.5 border-b border-l border-white/70" />
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 border-b border-r border-white/70" />
        <span className="h-1 w-1 rounded-full bg-white/90" />
        <span className="absolute -bottom-5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/45">256×256 ROI</span>
      </div>

      {/* Zoom controls */}
      <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-2xl border border-white/[0.14] bg-[#111313]/90 p-1.5 font-mono text-[9px] text-white/70 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md sm:right-6">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4.5, +(z + 0.25).toFixed(2)))}
          aria-label="Zoom in"
          className="cursor-pointer rounded-xl p-2 text-white/50 transition-colors hover:bg-[#e7824d]/15 hover:text-[#f0a078]"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <span className="py-0.5 text-white/80">{zoom.toFixed(1)}×</span>
        <button
          type="button"
          onClick={() => setZoom(1.0)}
          aria-label="Fit globe to view"
          title="Fit globe to view"
          className="cursor-pointer rounded-lg px-2 py-1 font-mono text-[7px] tracking-[0.12em] text-white/45 transition-colors hover:bg-[#e7824d]/15 hover:text-[#f0a078]"
        >
          FIT
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.25).toFixed(2)))}
          aria-label="Zoom out"
          className="cursor-pointer rounded-xl p-2 text-white/50 transition-colors hover:bg-[#e7824d]/15 hover:text-[#f0a078]"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Color scale and geographic presets */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-white/[0.13] bg-[#090a0a]/92 px-4 py-3.5 font-mono text-[8px] tracking-[0.08em] backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="text-white/45">{dataset.minVal}</span>
          <div
            role="img"
            aria-label={`Color scale from ${dataset.minVal} to ${dataset.maxVal} ${dataset.unit}`}
            className="h-1.5 w-24 overflow-hidden rounded-full"
            style={{ background: dataset.colorGradient }}
          />
          <span className="text-white/45">{dataset.maxVal} {dataset.unit}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {dataset.hotspots.map((spot) => (
            <button
              key={spot.id}
              type="button"
              onClick={() => {
                setLat(spot.lat);
                setLon(spot.lon);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.035] px-2.5 py-1.5 text-white/48 transition-colors hover:border-[#e7824d]/45 hover:bg-[#e7824d]/[0.08] hover:text-[#f0a078]"
            >
              <MapPin className="h-3 w-3" />
              {spot.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
