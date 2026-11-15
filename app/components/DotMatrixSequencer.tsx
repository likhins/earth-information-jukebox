"use client";

import React, { useEffect, useRef } from "react";
import { SlmSonificationOutput } from "../lib/datasets";
import { sanitizeToneNote } from "./SonificationWorkstation";

interface DotMatrixSequencerProps {
  output: SlmSonificationOutput | null;
  currentStep: number;
  isPlaying: boolean;
  slices?: number[];
  className?: string;
}

const STEMS = ["LEAD", "PAD", "BASS", "PULSE"] as const;

export default function DotMatrixSequencer({
  output,
  currentStep,
  isPlaying,
  slices = [0.42, 0.48, 0.55, 0.61, 0.58, 0.49, 0.38, 0.32, 0.41, 0.53, 0.67, 0.72, 0.64, 0.51, 0.44, 0.39],
  className = "",
}: DotMatrixSequencerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const isStepActive = (stemIndex: number, stepIndex: number): { active: boolean; weight: number } => {
      const stem = STEMS[stemIndex];

      if (stem === "PAD") {
        // Pad chord on bars 1 and 3 (steps 0, 8)
        const active = stepIndex === 0 || stepIndex === 8;
        return { active, weight: active ? 1.0 : 0 };
      }

      if (stem === "BASS") {
        // Bass root drone on beat 1 of each measure (steps 0, 4, 8, 12)
        const active = stepIndex % 4 === 0;
        return { active, weight: active ? 0.95 : 0 };
      }

      if (stem === "PULSE") {
        // Dynamic rhythmic pulse — only accent hits
        if (output?.sequence_16?.[stepIndex]) {
          const intensity = output.sequence_16[stepIndex].intensity;
          const active = intensity > 0.54;
          return { active, weight: intensity };
        }
        if (output?.pulsePattern) {
          const active = Boolean(output.pulsePattern[stepIndex]) && stepIndex % 2 === 0;
          return { active, weight: active ? 0.85 : 0 };
        }
        const sliceVal = slices[stepIndex] ?? 0.5;
        const active = sliceVal > 0.60;
        return { active, weight: sliceVal };
      }

      // stem === 'LEAD'
      if (output?.sequence_16?.[stepIndex]) {
        const item = output.sequence_16[stepIndex];
        const hasNote = Boolean(sanitizeToneNote(item.note));
        const active = hasNote && item.velocity >= 0.46;
        return { active, weight: item.velocity };
      }
      if (output?.leadSteps) {
        const noteIdx = output.leadSteps[stepIndex];
        const active = noteIdx >= 0 && stepIndex % 2 === 0;
        return { active, weight: active ? 0.85 : 0 };
      }
      const sliceVal = slices[stepIndex] ?? 0.5;
      const active = sliceVal >= 0.48;
      return { active, weight: sliceVal };
    };

    const draw = () => {
      if (width < 4 || height < 4) return;
      ctx.clearRect(0, 0, width, height);

      const labelWidth = width < 500 ? 46 : 56;
      const gridWidth = width - labelWidth - 8;
      const stepWidth = gridWidth / 15;
      const rowHeight = height / 4;

      // Draw 4 track rows
      for (let r = 0; r < 4; r++) {
        const y = r * rowHeight + rowHeight / 2;
        const stemName = STEMS[r];

        // Track label
        ctx.font = "500 10px SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(stemName, 2, y);

        // 16 Step dots
        for (let s = 0; s < 16; s++) {
          const x = labelWidth + s * stepWidth;
          const { active, weight } = isStepActive(r, s);
          const isCurrent = isPlaying && currentStep === s;

          ctx.beginPath();

          if (isCurrent) {
            // Playing step lights up in warm orange
            const radius = active ? 4.0 : 2.5;
            ctx.fillStyle = "#e56d36";
            ctx.shadowColor = "rgba(229, 109, 54, 0.8)";
            ctx.shadowBlur = 8;
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          } else if (active) {
            // Active step luminous starlight dot
            const radius = 2.4 + weight * 1.5;
            const alpha = 0.78 + weight * 0.22;
            ctx.fillStyle = `rgba(235, 245, 255, ${alpha})`;
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Inactive step: tiny faint starlight dot
            ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
            ctx.arc(x, y, 1.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Playhead vertical scanline if playing
      if (isPlaying && currentStep >= 0 && currentStep < 16) {
        const playheadX = labelWidth + currentStep * stepWidth;

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, "rgba(229, 109, 54, 0)");
        grad.addColorStop(0.2, "rgba(229, 109, 54, 0.5)");
        grad.addColorStop(0.8, "rgba(229, 109, 54, 0.5)");
        grad.addColorStop(1, "rgba(229, 109, 54, 0)");

        ctx.fillStyle = grad;
        ctx.fillRect(playheadX - 1, 0, 2, height);
      }
    };

    resize();
    draw();

    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(canvas);

    if (isPlaying) {
      const animate = () => {
        draw();
        raf = requestAnimationFrame(animate);
      };
      raf = requestAnimationFrame(animate);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [output, currentStep, isPlaying, slices]);

  return (
    <div className={`relative w-full h-[88px] sm:h-[96px] select-none ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" aria-hidden="true" />
    </div>
  );
}
