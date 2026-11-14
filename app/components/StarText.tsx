"use client";

import { useEffect, useRef } from "react";

export default function StarText() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let observer: ResizeObserver | undefined;

    const render = () => {
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
      const top = height * (mobile ? 0.22 : 0.245);
      const maxWidth = Math.min(width - left * 2, mobile ? width * 0.87 : 700);
      let titleSize = mobile ? Math.min(42, width * 0.105) : Math.min(62, width * 0.052);
      let bodySize = mobile ? 12 : 15;
      const labelSize = mobile ? 8 : 10;

      const titleLines = ["Listen beyond", "what you can see."];
      while (titleSize > 28) {
        text.font = "600 " + titleSize + "px Arial, Helvetica, sans-serif";
        if (Math.max(...titleLines.map((line) => text.measureText(line).width)) <= maxWidth) break;
        titleSize -= 1;
      }
      while (bodySize > 10) {
        text.font = "400 " + bodySize + "px Arial, Helvetica, sans-serif";
        if (Math.max(text.measureText("An exploration of our planet through data,").width, text.measureText("patterns and sound.").width) <= maxWidth) break;
        bodySize -= 1;
      }

      text.fillStyle = "#fff";
      text.textBaseline = "top";
      text.font = "600 " + labelSize + "px ui-monospace, SFMono-Regular, Menlo, monospace";
      text.fillText("POLARIS  ·  EARTH INFORMATION JUKEBOX", left, top, maxWidth);

      const titleY = top + (mobile ? 34 : 42);
      text.font = "600 " + titleSize + "px Arial, Helvetica, sans-serif";
      text.fillText(titleLines[0], left, titleY, maxWidth);
      text.fillText(titleLines[1], left, titleY + titleSize * 1.16, maxWidth);

      const bodyY = titleY + titleSize * 2.55;
      text.font = "400 " + bodySize + "px Arial, Helvetica, sans-serif";
      text.fillText("An exploration of our planet through data,", left + 1, bodyY, maxWidth);
      text.fillText("patterns and sound.", left + 1, bodyY + bodySize * 1.65, maxWidth);

      const pixels = text.getImageData(0, 0, mask.width, mask.height).data;
      const step = mobile ? 2.65 : 2.9;
      const points: { x: number; y: number; radius: number; alpha: number }[] = [];

      for (let y = 0; y < mask.height; y += step) {
        for (let x = 0; x < mask.width; x += step) {
          const ix = Math.floor(x);
          const iy = Math.floor(y);
          const opacity = pixels[(iy * mask.width + ix) * 4 + 3];
          if (opacity > 115) {
            const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const noise = seed - Math.floor(seed);
            points.push({
              x: x + (noise - 0.5) * 0.35,
              y: y + (noise - 0.5) * 0.35,
              radius: noise > 0.94 ? 1.45 : noise > 0.68 ? 1.12 : 0.88,
              alpha: 0.76 + noise * 0.24,
            });
          }
        }
      }

      // One-time rasterization: each dot is painted once, not redrawn every frame.
      for (const point of points) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(232,242,255," + point.alpha + ")";
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    render();
    observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer?.disconnect();
  }, []);

  return (
    <div className="star-text-wrap pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
      <canvas ref={canvasRef} className="star-text-canvas" />
      <div className="sr-only">
        <p>Polaris · Earth Information Jukebox</p>
        <h1>Listen beyond what you can see.</h1>
        <p>An exploration of our planet through data, patterns and sound.</p>
      </div>
    </div>
  );
}
