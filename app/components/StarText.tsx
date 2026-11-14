"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number; y: number; tx: number; ty: number;
  radius: number; phase: number; drift: number;
};

type AmbientStar = { x: number; y: number; radius: number; phase: number };

export default function StarText() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let particles: Particle[] = [];
    let ambient: AmbientStar[] = [];
    let width = 0;
    let height = 0;
    let startedAt = 0;
    let observer: ResizeObserver | undefined;

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const textCanvas = document.createElement("canvas");
      textCanvas.width = Math.round(width);
      textCanvas.height = Math.round(height);
      const textCtx = textCanvas.getContext("2d");
      if (!textCtx) return;

      const compact = width < 390;
      const labelSize = compact ? 9 : 10;
      const titleSize = compact ? 36 : Math.min(48, width * 0.11);
      const bodySize = compact ? 12 : 14;

      textCtx.fillStyle = "#fff";
      textCtx.textBaseline = "top";
      textCtx.font = "500 " + labelSize + "px ui-monospace, SFMono-Regular, Menlo, monospace";
      textCtx.fillText("POLARIS  ·  EARTH INFORMATION JUKEBOX", 1, 5);
      textCtx.font = "600 " + titleSize + "px Arial, Helvetica, sans-serif";
      textCtx.fillText("Listen beyond", 0, 42);
      textCtx.fillText("what you can see.", 0, 42 + titleSize * 1.08);
      textCtx.font = "400 " + bodySize + "px Arial, Helvetica, sans-serif";
      textCtx.fillText("An exploration of our planet through data,", 1, 42 + titleSize * 2.28);
      textCtx.fillText("patterns and sound.", 1, 42 + titleSize * 2.28 + bodySize * 1.65);

      const pixels = textCtx.getImageData(0, 0, textCanvas.width, textCanvas.height);
      const targets: { x: number; y: number }[] = [];
      const sampleStep = 2;
      for (let y = 0; y < textCanvas.height; y += sampleStep) {
        for (let x = 0; x < textCanvas.width; x += sampleStep) {
          if (pixels.data[(y * textCanvas.width + x) * 4 + 3] > 100) targets.push({ x, y });
        }
      }

      particles = targets.map((target, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        tx: target.x,
        ty: target.y,
        radius: index % 9 === 0 ? 1.65 : 1.15,
        phase: Math.random() * Math.PI * 2,
        drift: 2 + Math.random() * 5,
      }));

      ambient = Array.from({ length: Math.max(65, Math.round(width * height / 1500)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.45 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
      }));
      startedAt = performance.now();
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const elapsed = now - startedAt;
      const gatherStart = 1500;
      const gatherDuration = 2600;
      const rawProgress = reduceMotion ? 1 : Math.max(0, Math.min(1, (elapsed - gatherStart) / gatherDuration));
      const progress = 1 - Math.pow(1 - rawProgress, 3);

      // A loose starfield remains visible behind the forming typography.
      for (const star of ambient) {
        const shimmer = 0.2 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.001 + star.phase));
        ctx.beginPath();
        ctx.fillStyle = "rgba(205,225,255," + shimmer + ")";
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // The same stars begin scattered across the canvas, then converge into letterforms.
      for (const particle of particles) {
        const wander = reduceMotion || progress >= 1 ? 0 : Math.sin(now * 0.0007 + particle.phase) * particle.drift * (1 - progress);
        const x = particle.x + (particle.tx - particle.x) * progress + wander;
        const y = particle.y + (particle.ty - particle.y) * progress + Math.cos(now * 0.0008 + particle.phase) * particle.drift * (1 - progress);
        const twinkle = reduceMotion ? 0.9 : 0.72 + 0.28 * Math.sin(now * 0.0015 + particle.phase);
        const alpha = progress < 1 ? 0.52 + progress * 0.4 : 0.86 * twinkle;
        ctx.beginPath();
        ctx.fillStyle = "rgba(226,240,255," + alpha + ")";
        ctx.shadowColor = "rgba(155,205,255,0.9)";
        ctx.shadowBlur = progress > 0.75 ? 4 : 1.5;
        ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    build();
    frame = requestAnimationFrame(draw);
    observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      build();
      frame = requestAnimationFrame(draw);
    });
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return (
    <div className="star-text-wrap" role="img" aria-label="Polaris. Listen beyond what you can see. An exploration of our planet through data, patterns and sound.">
      <canvas ref={canvasRef} className="star-text-canvas" />
      <div className="sr-only">
        <p>Polaris · Earth Information Jukebox</p>
        <h1>Listen beyond what you can see.</h1>
        <p>An exploration of our planet through data, patterns and sound.</p>
      </div>
    </div>
  );
}
