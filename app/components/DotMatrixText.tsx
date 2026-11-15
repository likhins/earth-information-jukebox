"use client";

import React, { useEffect, useRef } from "react";

interface DotMatrixTextProps {
  text: string;
  className?: string;
  size?: number; // target font size in px
  weight?: number | string;
  step?: number; // dot sampling grid spacing
  accent?: boolean; // warm orange or starlight blue
  align?: "left" | "center" | "right";
  lineHeight?: number;
  ariaLabel?: string;
}

export default function DotMatrixText({
  text,
  className = "",
  size = 28,
  weight = 600,
  step = 2.35,
  accent = false,
  align = "left",
  lineHeight = 1.25,
  ariaLabel,
}: DotMatrixTextProps) {
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

      if (!text || width < 4 || height < 4) return;

      const mask = document.createElement("canvas");
      mask.width = width;
      mask.height = height;
      const maskCtx = mask.getContext("2d");
      if (!maskCtx) return;

      const mobile = width < 640;
      let calculatedSize = mobile ? Math.min(size, 26) : size;

      // Word wrapping logic to handle multi-word titles without squishing
      try {
        maskCtx.letterSpacing = "1.5px";
      } catch {
        // Fallback for older browsers
      }
      maskCtx.font = `${weight} ${calculatedSize}px Arial, Helvetica, sans-serif`;
      const words = text.split(" ");
      let lines: string[] = [];

      const computeLines = (fontSize: number) => {
        maskCtx.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
        const result: string[] = [];
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (maskCtx.measureText(testLine).width <= width - 4) {
            currentLine = testLine;
          } else {
            if (currentLine) result.push(currentLine);
            currentLine = word;
          }
        }
        if (currentLine) result.push(currentLine);
        return result;
      };

      lines = computeLines(calculatedSize);
      const lineH = calculatedSize * lineHeight;
      let totalH = lines.length * lineH;

      // Scale down if total height exceeds canvas height
      while ((totalH > height || lines.some(l => maskCtx.measureText(l).width > width - 4)) && calculatedSize > 14) {
        calculatedSize -= 1;
        lines = computeLines(calculatedSize);
        totalH = lines.length * (calculatedSize * lineHeight);
      }

      maskCtx.fillStyle = "#ffffff";
      maskCtx.textBaseline = "middle";
      maskCtx.textAlign = align;

      const effectiveLineH = calculatedSize * lineHeight;
      const startY = (height - (lines.length - 1) * effectiveLineH) / 2;

      lines.forEach((line, idx) => {
        const textX = align === "center" ? width / 2 : align === "right" ? width - 2 : 2;
        const textY = startY + idx * effectiveLineH;
        maskCtx.fillText(line, textX, textY);
      });

      const pixels = maskCtx.getImageData(0, 0, width, height).data;
      const sampleStep = mobile ? Math.max(2.0, step * 0.9) : step;
      const colorPrefix = accent ? "rgba(229,109,54," : "rgba(232,242,255,";

      for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          const pixelX = Math.floor(x);
          const pixelY = Math.floor(y);
          const idx = (pixelY * width + pixelX) * 4;
          const alpha = pixels[idx + 3];
          if (alpha < 105) continue;

          // Organic celestial starlight twinkle jitter
          const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const noise = seed - Math.floor(seed);
          const jx = x + (noise - 0.5) * 0.35;
          const jy = y + (noise - 0.5) * 0.35;
          const dotRadius = noise > 0.92 ? 1.45 : noise > 0.6 ? 1.15 : 0.9;
          const dotAlpha = 0.76 + noise * 0.24;

          ctx.beginPath();
          ctx.fillStyle = `${colorPrefix}${dotAlpha})`;
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
  }, [text, size, weight, step, accent, align, lineHeight]);

  return (
    <div className={`relative ${className}`} aria-label={ariaLabel || text}>
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </div>
  );
}
