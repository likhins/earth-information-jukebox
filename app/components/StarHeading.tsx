"use client";

import React, { useEffect, useRef } from "react";

type Props = { text: string; className?: string };

export default function StarHeading({ text: value, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;

    const render = () => {
      if (cancelled) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const mask = document.createElement("canvas");
      mask.width = width;
      mask.height = height;
      const maskCtx = mask.getContext("2d");
      if (!maskCtx) return;

      const mobile = width < 640;
      let fontSize = mobile ? Math.min(28, Math.max(18, width * 0.07)) : Math.min(44, Math.max(26, width * 0.048));
      const maxWidth = width - 4;

      try {
        maskCtx.letterSpacing = "1.5px";
      } catch {
        // Fallback
      }
      maskCtx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
      while (maskCtx.measureText(value).width > maxWidth && fontSize > 16) {
        fontSize -= 1;
        maskCtx.font = `600 ${fontSize}px Arial, Helvetica, sans-serif`;
      }

      maskCtx.fillStyle = "#ffffff";
      maskCtx.textAlign = "left";
      maskCtx.textBaseline = "middle";
      maskCtx.fillText(value, 2, height / 2, maxWidth);

      const pixels = maskCtx.getImageData(0, 0, width, height).data;
      const step = mobile ? 2.25 : 2.45;

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const pixelX = Math.floor(x);
          const pixelY = Math.floor(y);
          const idx = (pixelY * width + pixelX) * 4;
          const alpha = pixels[idx + 3];
          if (alpha < 115) continue;

          // Organic celestial particle jitter identical to hero StarText
          const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const noise = seed - Math.floor(seed);
          const jx = x + (noise - 0.5) * 0.35;
          const jy = y + (noise - 0.5) * 0.35;
          const dotRadius = noise > 0.94 ? 1.55 : noise > 0.68 ? 1.25 : 1.02;
          const dotAlpha = 0.76 + noise * 0.24;

          ctx.beginPath();
          ctx.fillStyle = `rgba(232,242,255,${dotAlpha})`;
          ctx.arc(jx, jy, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) render();
      });
    }
    render();

    const observer = new ResizeObserver(() => {
      render();
    });
    observer.observe(canvas);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [value]);

  return (
    <div className={`relative w-full ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" aria-hidden="true" />
      <h2 className="sr-only">{value}</h2>
    </div>
  );
}
