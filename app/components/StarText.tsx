"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; radius: number; alpha: number };

export default function StarText() {
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = textCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let observer: ResizeObserver | undefined;

    const renderText = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const mask = document.createElement("canvas");
      mask.width = Math.ceil(width);
      mask.height = Math.ceil(height);
      const text = mask.getContext("2d");
      if (!text) return;

      const mobile = width < 640;
      const left = Math.max(24, width * (mobile ? 0.065 : 0.09));
      const maxWidth = Math.min(width - left * 2, mobile ? width * 0.87 : 700);
      let titleSize = mobile ? Math.min(42, width * 0.105) : Math.min(62, width * 0.052);
      const teamSize = mobile ? 23 : 30;
      const titleLines = ["Listen beyond", "what you can see."];

      text.fillStyle = "#fff";
      text.textBaseline = "top";
      text.textAlign = "center";
      text.font = "700 " + teamSize + "px Arial, Helvetica, sans-serif";
      text.fillText("POLARIS", width / 2, height * 0.145);

      text.textAlign = "left";
      while (titleSize > 28) {
        text.font = "600 " + titleSize + "px Arial, Helvetica, sans-serif";
        if (Math.max(...titleLines.map((line) => text.measureText(line).width)) <= maxWidth) break;
        titleSize -= 1;
      }
      const titleY = height * (mobile ? 0.34 : 0.365);
      text.font = "600 " + titleSize + "px Arial, Helvetica, sans-serif";
      text.fillText(titleLines[0], left, titleY, maxWidth);
      text.fillText(titleLines[1], left, titleY + titleSize * 1.16, maxWidth);

      const pixels = text.getImageData(0, 0, mask.width, mask.height).data;
      const step = mobile ? 2.25 : 2.45;
      const points: Particle[] = [];

      for (let y = 0; y < mask.height; y += step) {
        for (let x = 0; x < mask.width; x += step) {
          const opacity = pixels[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3];
          if (opacity > 115) {
            const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const noise = seed - Math.floor(seed);
            points.push({
              x: x + (noise - 0.5) * 0.35,
              y: y + (noise - 0.5) * 0.35,
              radius: noise > 0.94 ? 1.55 : noise > 0.68 ? 1.25 : 1.02,
              alpha: 0.76 + noise * 0.24,
            });
          }
        }
      }

      for (const point of points) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(232,242,255," + point.alpha + ")";
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    renderText();
    observer = new ResizeObserver(renderText);
    observer.observe(canvas);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const canvas = waveCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frame = 0;
    let lastDraw = 0;
    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (time - lastDraw < 40) return;
      lastDraw = time;
      frame += 0.045;
      ctx.clearRect(0, 0, width, height);

      const mobile = width < 640;
      const centerX = width / 2;
      const span = Math.min(width * 0.62, mobile ? width * 0.78 : 820);
      const count = mobile ? 76 : 116;
      const spacing = span / (count - 1);
      const rows = [
        { y: height * 0.285, amplitude: mobile ? 9 : 13, phase: 0.2 },
      ];

      for (const row of rows) {
        for (let i = 0; i < count; i++) {
          const x = centerX - span / 2 + i * spacing;
          const position = i / (count - 1);
          const envelope = Math.pow(Math.sin(Math.PI * position), 0.72);
          const signal =
            Math.sin(i * 0.19 + frame + row.phase) * 0.56 +
            Math.sin(i * 0.073 - frame * 1.35 + row.phase) * 0.28 +
            Math.sin(i * 0.37 + frame * 0.72) * 0.16;
          const y = row.y + signal * row.amplitude * envelope;
          const pulse = 0.5 + 0.5 * Math.sin(i * 0.14 - frame * 1.8 + row.phase);
          const radius = 0.65 + pulse * 0.75;
          const alpha = (0.18 + pulse * 0.42) * (0.25 + envelope * 0.75);
          ctx.beginPath();
          ctx.fillStyle = "rgba(205,226,255," + alpha + ")";
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="star-text-wrap pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
      <canvas ref={waveCanvasRef} className="star-wave-canvas" />
      <canvas ref={textCanvasRef} className="star-text-canvas" />
      <div className="sr-only">
        <p>Polaris</p>
        <h1>Listen beyond what you can see.</h1>
      </div>
    </div>
  );
}
