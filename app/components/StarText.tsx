"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  radius: number;
  alpha: number;
  phase: number;
  speed: number;
};

export default function StarText() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let startedAt = 0;
    let stars: Star[] = [];
    let ambient: Star[] = [];
    let resizeObserver: ResizeObserver | undefined;
    let visibilityObserver: IntersectionObserver | undefined;
    let visible = true;

    const random = (min: number, max: number) => min + Math.random() * (max - min);

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw the intended copy into an offscreen mask. The live canvas itself
      // spans the entire hero, so particles can begin anywhere in the scene.
      const mask = document.createElement("canvas");
      mask.width = Math.ceil(width);
      mask.height = Math.ceil(height);
      const mctx = mask.getContext("2d");
      if (!mctx) return;

      const mobile = width < 640;
      const left = Math.max(24, width * (mobile ? 0.065 : 0.09));
      const top = height * (mobile ? 0.25 : 0.285);
      const titleSize = mobile ? Math.min(43, width * 0.105) : Math.min(62, width * 0.052);
      const labelSize = mobile ? 8 : 10;
      const bodySize = mobile ? 12 : 15;
      const maxTextWidth = Math.min(width - left * 2, mobile ? width * 0.86 : 690);

      mctx.fillStyle = "#fff";
      mctx.textBaseline = "top";
      mctx.font = "500 " + labelSize + "px ui-monospace, SFMono-Regular, Menlo, monospace";
      mctx.fillText("POLARIS  ·  EARTH INFORMATION JUKEBOX", left, top, maxTextWidth);

      mctx.font = "600 " + titleSize + "px Arial, Helvetica, sans-serif";
      const titleY = top + (mobile ? 35 : 43);
      mctx.fillText("Listen beyond", left, titleY, maxTextWidth);
      mctx.fillText("what you can see.", left, titleY + titleSize * 1.13, maxTextWidth);

      mctx.font = "400 " + bodySize + "px Arial, Helvetica, sans-serif";
      const bodyY = titleY + titleSize * 2.48;
      mctx.fillText("An exploration of our planet through data,", left + 1, bodyY, maxTextWidth);
      mctx.fillText("patterns and sound.", left + 1, bodyY + bodySize * 1.65, maxTextWidth);

      const pixels = mctx.getImageData(0, 0, mask.width, mask.height).data;
      const targets: { x: number; y: number }[] = [];
      // Wider sampling creates readable, separate star points instead of a
      // dense pixel fill. A little jitter keeps the lettering organic.
      const step = mobile ? 3.7 : 4.1;
      for (let y = 0; y < mask.height; y += step) {
        for (let x = 0; x < mask.width; x += step) {
          const ix = Math.floor(x);
          const iy = Math.floor(y);
          if (pixels[(iy * mask.width + ix) * 4 + 3] > 105 && Math.random() > 0.08) {
            targets.push({ x: left + x - left + random(-0.65, 0.65), y: y + random(-0.65, 0.65) });
          }
        }
      }

      stars = targets.map((target) => ({
        x: random(0, width),
        y: random(0, height),
        tx: target.x,
        ty: target.y,
        radius: Math.random() < 0.12 ? random(1.45, 2.15) : random(0.75, 1.35),
        alpha: random(0.62, 1),
        phase: random(0, Math.PI * 2),
        speed: random(0.45, 1.15),
      }));

      // A separate, full-screen field remains scattered after the letters form.
      const density = Math.max(240, Math.round((width * height) / 1250));
      ambient = Array.from({ length: density }, () => ({
        x: random(0, width),
        y: random(0, height),
        tx: 0,
        ty: 0,
        radius: Math.random() < 0.08 ? random(1.35, 2.1) : random(0.35, 1.05),
        alpha: random(0.12, 0.72),
        phase: random(0, Math.PI * 2),
        speed: random(0.12, 0.55),
      }));
      startedAt = performance.now();
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const elapsed = now - startedAt;
      const gatherStart = 1900;
      const gatherDuration = 3400;
      const t = Math.max(0, Math.min(1, (elapsed - gatherStart) / gatherDuration));
      const gather = 1 - Math.pow(1 - t, 3);

      // Ambient stars drift gently over the whole viewport at all times.
      for (const star of ambient) {
        const driftX = Math.sin(now * 0.00011 * star.speed + star.phase) * 5;
        const driftY = Math.cos(now * 0.00009 * star.speed + star.phase) * 4;
        const twinkle = 0.55 + 0.45 * Math.sin(now * 0.0012 * star.speed + star.phase);
        ctx.beginPath();
        ctx.fillStyle = "rgba(210,229,255," + Math.max(0.08, star.alpha * twinkle) + ")";
        ctx.arc(star.x + driftX, star.y + driftY, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // These stars start throughout the full hero, then only a portion
      // converges into the letterforms; the ambient field stays untouched.
      for (const star of stars) {
        const wanderX = Math.sin(now * 0.00018 * star.speed + star.phase) * 7 * (1 - gather);
        const wanderY = Math.cos(now * 0.00016 * star.speed + star.phase) * 6 * (1 - gather);
        const x = star.x + (star.tx - star.x) * gather + wanderX;
        const y = star.y + (star.ty - star.y) * gather + wanderY;
        const twinkle = 0.72 + 0.28 * Math.sin(now * 0.0015 * star.speed + star.phase);
        const alpha = (0.5 + gather * 0.48) * twinkle * star.alpha;
        ctx.beginPath();
        ctx.fillStyle = "rgba(230,242,255," + alpha + ")";
        ctx.shadowColor = "rgba(166,207,255,0.8)";
        ctx.shadowBlur = gather > 0.72 ? 3.2 : 1.2;
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (visible) frame = requestAnimationFrame(draw);
    };

    build();
    frame = requestAnimationFrame(draw);
    resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      build();
      frame = requestAnimationFrame(draw);
    });
    resizeObserver.observe(canvas);

    visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(frame);
      if (visible) {
        startedAt = performance.now();
        frame = requestAnimationFrame(draw);
      }
    }, { threshold: 0.05 });
    visibilityObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="sr-only">
        <p>Polaris · Earth Information Jukebox</p>
        <h1>Listen beyond what you can see.</h1>
        <p>An exploration of our planet through data, patterns and sound.</p>
      </div>
    </div>
  );
}
