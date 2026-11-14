"use client";

import { useEffect, useRef } from "react";

type Props = { text: string };

export default function StarHeading({ text: value }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

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
      const maskCtx = mask.getContext("2d");
      if (!maskCtx) return;

      const mobile = width < 640;
      let fontSize = mobile ? Math.min(34, width * 0.09) : Math.min(66, width * 0.055);
      const maxWidth = width - 8;
      maskCtx.font = "700 " + fontSize + "px Arial, Helvetica, sans-serif";
      while (maskCtx.measureText(value).width > maxWidth && fontSize > 18) {
        fontSize -= 1;
        maskCtx.font = "700 " + fontSize + "px Arial, Helvetica, sans-serif";
      }
      maskCtx.fillStyle = "#fff";
      maskCtx.textAlign = "left";
      maskCtx.textBaseline = "middle";
      maskCtx.font = "700 " + fontSize + "px Arial, Helvetica, sans-serif";
      maskCtx.fillText(value, 2, height / 2, maxWidth);

      const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;
      const step = mobile ? 2.0 : 2.15;
      for (let y = 0; y < mask.height; y += step) {
        for (let x = 0; x < mask.width; x += step) {
          const alpha = pixels[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3];
          if (alpha < 100) continue;
          const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const noise = seed - Math.floor(seed);
          ctx.beginPath();
          ctx.fillStyle = "rgba(232,242,255," + (0.78 + noise * 0.22) + ")";
          ctx.arc(x, y, noise > 0.88 ? 1.35 : 0.95, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    // Render once after layout. This wordmark is intentionally static.
    const frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div className="polaris-star-heading-frame" aria-hidden="true">
      <canvas ref={canvasRef} className="polaris-star-heading" />
      <h1 className="sr-only">{value}</h1>
    </div>
  );
}
