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
  const [zoom, setZoom] = useState<number>(1.25);
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
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.43 * zoom;

    ctx.clearRect(0, 0, width, height);

    // Subtle procedural starfield instead of harsh grid lines
    ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
    for (let s = 0; s < 55; s++) {
      const sx = ((s * 197) % width);
      const sy = ((s * 313) % height);
      const r = s % 3 === 0 ? 1.2 : 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft atmospheric halo
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius * 1.22);
    halo.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
    halo.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.22, 0, Math.PI * 2);
    ctx.fill();

    // Globe Sphere
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

    // Organic geospatial thermal/data waves
    const lonRad = (lon * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;

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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Ultra-subtle graticules
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let g = -2; g <= 2; g++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * Math.cos((g * Math.PI) / 6), radius, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius, radius * Math.cos((g * Math.PI) / 6), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Inner limb shadow for 3D depth
    const innerShadow = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius);
    innerShadow.addColorStop(0, 'rgba(2, 6, 23, 0)');
    innerShadow.addColorStop(1, 'rgba(2, 6, 23, 0.55)');
    ctx.fillStyle = innerShadow;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();

    // Crisp thin rim highlight
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)';
    ctx.lineWidth = 1;
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
      className="relative w-full h-full bg-[#020617] border border-white/[0.07] rounded-2xl overflow-hidden select-none"
    >
      {/* Full-Bleed Canvas */}
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
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing focus:outline-none"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Floating Top-Left Dataset Pill */}
      <div className="pointer-events-none absolute top-3.5 left-3.5 z-10 flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-950/65 backdrop-blur-md border border-white/10 font-mono text-xs">
        <Crosshair className="h-3.5 w-3.5 text-sky-400" />
        <span className="text-sky-400 font-semibold">{dataset.shortCode}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-200">{dataset.name}</span>
      </div>

      {/* Floating Top-Right Telemetry Pill */}
      <div className="pointer-events-none absolute top-3.5 right-3.5 z-10 hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full bg-slate-950/65 backdrop-blur-md border border-white/10 font-mono text-xs">
        <span className="text-slate-400">
          {Math.abs(lat).toFixed(1)}°{lat >= 0 ? 'N' : 'S'}{' '}
          {Math.abs(lon).toFixed(1)}°{lon >= 0 ? 'E' : 'W'}
        </span>
        <span className="text-slate-700">|</span>
        <span className="text-sky-300 font-semibold">
          {liveVal.toFixed(2)} {dataset.unit}
        </span>
      </div>

      {/* Minimalist Corner-Bracket Sampling Reticle */}
      <div
        aria-hidden="true"
        className="pointer-events-none z-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 flex items-center justify-center"
      >
        <span className="absolute top-0 left-0 w-3.5 h-3.5 border-t border-l border-sky-400/80" />
        <span className="absolute top-0 right-0 w-3.5 h-3.5 border-t border-r border-sky-400/80" />
        <span className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b border-l border-sky-400/80" />
        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b border-r border-sky-400/80" />
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400/90 shadow-[0_0_10px_#38bdf8]" />
        <span className="absolute -bottom-5 text-[9px] font-mono tracking-widest uppercase text-sky-300/70">
          256×256 ROI
        </span>
      </div>

      {/* Floating Zoom Pill */}
      <div className="z-10 absolute right-3.5 bottom-14 flex flex-col items-center gap-1 bg-slate-950/70 backdrop-blur-md border border-white/10 rounded-full p-1 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(4.5, +(z + 0.25).toFixed(2)))}
          aria-label="Zoom in"
          className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <span className="text-sky-400 font-semibold py-0.5">{zoom.toFixed(1)}×</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.85, +(z - 0.25).toFixed(2)))}
          aria-label="Zoom out"
          className="p-1.5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Bottom Legend & Presets */}
      <div className="z-10 absolute bottom-3 inset-x-3.5 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-2xl sm:rounded-full bg-slate-950/70 backdrop-blur-md border border-white/10 text-[11px] font-mono">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400">{dataset.minVal}</span>
          <div
            role="img"
            aria-label={`Color scale from ${dataset.minVal} to ${dataset.maxVal} ${dataset.unit}`}
            className="w-28 h-2 rounded-full"
            style={{ background: dataset.colorGradient }}
          />
          <span className="text-slate-400">
            {dataset.maxVal} {dataset.unit}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {dataset.hotspots.map((spot) => (
            <button
              key={spot.id}
              type="button"
              onClick={() => {
                setLat(spot.lat);
                setLon(spot.lon);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.04] hover:bg-sky-500/20 border border-white/10 hover:border-sky-400/50 text-slate-200 transition cursor-pointer"
            >
              <MapPin className="w-3 h-3 text-sky-400" />
              {spot.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
