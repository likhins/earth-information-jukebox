// app/components/EarthViewport.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EicDataset, ReticleFeatures } from '../lib/datasets';
import { Compass, Crosshair, MapPin, ZoomIn, ZoomOut } from 'lucide-react';

interface EarthViewportProps {
  dataset: EicDataset;
  onSampleUpdate: (features: ReticleFeatures) => void;
}

export default function EarthViewport({ dataset, onSampleUpdate }: EarthViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [lat, setLat] = useState<number>(12.0);
  const [lon, setLon] = useState<number>(45.0);
  const [zoom, setZoom] = useState<number>(1.2);
  const [liveVal, setLiveVal] = useState<number>(0);

  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Compute deterministic scientific value from lat/lon + dataset range (and sample canvas pixels)
  const computeFeatures = useCallback(
    (currentLat: number, currentLon: number) => {
      const radLat = (currentLat * Math.PI) / 180;
      const radLon = (currentLon * Math.PI) / 180;

      // Smooth multi-harmonic spatial field simulating global geospatial structure
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
    computeFeatures(lat, lon);
  }, [lat, lon, dataset, computeFeatures]);

  // Render Orthographic Globe Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.36 * zoom;

    ctx.clearRect(0, 0, width, height);

    // Subtle orbital halo
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.25);
    halo.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
    halo.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Globe base sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    const sphereGrad = ctx.createRadialGradient(
      cx - radius * 0.3,
      cy - radius * 0.3,
      radius * 0.1,
      cx,
      cy,
      radius
    );
    sphereGrad.addColorStop(0, dataset.fallbackColors[2]);
    sphereGrad.addColorStop(0.55, dataset.fallbackColors[1]);
    sphereGrad.addColorStop(1, dataset.fallbackColors[0]);
    ctx.fillStyle = sphereGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // Procedural geospatial data bands rotating with lon/lat
    const lonRad = (lon * Math.PI) / 180;
    const latRad = (lat * Math.PI) / 180;

    for (let i = -5; i <= 5; i++) {
      const bandY = cy + ((i / 5) * radius * 0.85) + Math.sin(latRad) * 25;
      ctx.beginPath();
      for (let x = cx - radius; x <= cx + radius; x += 8) {
        const nx = (x - cx) / radius;
        const wave =
          Math.sin(nx * 4 + lonRad + i) * 18 + Math.cos(nx * 7 - lonRad * 1.5) * 10;
        if (x === cx - radius) ctx.moveTo(x, bandY + wave);
        else ctx.lineTo(x, bandY + wave);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Graticule (latitude / longitude grid lines)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    for (let g = -2; g <= 2; g++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * Math.cos((g * Math.PI) / 6), radius, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx, cy, radius, radius * Math.cos((g * Math.PI) / 6), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Globe rim stroke
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [dataset, lat, lon, zoom]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };

    setLon((prev) => ((prev - dx * 0.35 + 540) % 360) - 180);
    setLat((prev) => Math.max(-85, Math.min(85, prev + dy * 0.35)));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setLon((p) => ((p - 5 + 540) % 360) - 180);
    if (e.key === 'ArrowRight') setLon((p) => ((p + 5 + 540) % 360) - 180);
    if (e.key === 'ArrowUp') setLat((p) => Math.min(85, p + 5));
    if (e.key === 'ArrowDown') setLat((p) => Math.max(-85, p - 5));
    if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(1)));
    if (e.key === '-') setZoom((z) => Math.max(0.8, +(z - 0.1).toFixed(1)));
  };

  return (
    <section
      aria-label="Earth visualization viewport"
      className="relative flex flex-col justify-between bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden select-none min-h-[460px]"
    >
      {/* Top HUD Overlay */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 text-xs font-mono">
        <div className="flex items-center gap-2 text-sky-400">
          <Compass className="w-4 h-4" />
          <span>VIEWPORT // ORTHOGRAPHIC</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-200 font-semibold">{dataset.name}</span>
        </div>

        <div className="flex items-center gap-4 text-slate-300">
          <span>
            CTR{' '}
            <strong className="text-white">
              {Math.abs(lat).toFixed(1)}°{lat >= 0 ? 'N' : 'S'}{' '}
              {Math.abs(lon).toFixed(1)}°{lon >= 0 ? 'E' : 'W'}
            </strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300">
            VAL <strong>{liveVal.toFixed(2)} {dataset.unit}</strong>
          </span>
        </div>
      </div>

      {/* Interactive Globe Canvas + Center Sampling Reticle */}
      <div
        tabIndex={0}
        role="application"
        aria-label="Interactive Earth globe. Drag or use arrow keys to rotate, plus or minus to zoom."
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="relative flex-1 flex items-center justify-center cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-sky-500/50"
      >
        <canvas ref={canvasRef} width={560} height={420} className="w-full h-full max-h-[420px] object-contain" />

        {/* 256x256 Sampling Window Reticle */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute w-36 h-36 border border-sky-400/70 rounded-sm flex items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.2)]"
        >
          <Crosshair className="w-5 h-5 text-sky-300/80" />
          <span className="absolute -top-5 left-0 text-[10px] font-mono text-sky-300 bg-slate-950/90 px-1.5 py-0.5 rounded border border-sky-500/30">
            SAMPLE WINDOW · 256×256 PX
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1.5 font-mono text-xs">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(1)))}
            aria-label="Zoom in"
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-center text-[10px] text-sky-400">{zoom.toFixed(1)}×</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.1).toFixed(1)))}
            aria-label="Zoom out"
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Colorbar + Climate Story Hotspots */}
      <div className="z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/90 border-t border-slate-800/80 text-xs font-mono">
        {/* Color Scale Legend */}
        <div className="flex items-center gap-3">
          <span className="text-slate-400">{dataset.minVal}</span>
          <div
            role="img"
            aria-label={`Color scale from ${dataset.minVal} to ${dataset.maxVal} ${dataset.unit}`}
            className="w-32 h-2.5 rounded-full border border-slate-700"
            style={{ background: dataset.colorGradient }}
          />
          <span className="text-slate-400">
            {dataset.maxVal} {dataset.unit}
          </span>
        </div>

        {/* Instant Story Hotspot Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 mr-1">PRESETS:</span>
          {dataset.hotspots.map((spot) => (
            <button
              key={spot.id}
              type="button"
              onClick={() => {
                setLat(spot.lat);
                setLon(spot.lon);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-500/50 text-slate-200 transition"
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