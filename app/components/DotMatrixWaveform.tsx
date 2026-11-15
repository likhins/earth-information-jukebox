"use client";

import React, { useEffect, useRef } from "react";
import * as Tone from "tone";

interface DotMatrixWaveformProps {
  isPlaying: boolean;
  className?: string;
}

export default function DotMatrixWaveform({ isPlaying, className = "" }: DotMatrixWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Setup AnalyserNode connected to Tone destination
  useEffect(() => {
    try {
      const rawContext = Tone.getContext().rawContext;
      if (!rawContext) return;

      const analyser = rawContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      Tone.getDestination().connect(analyser);

      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch (e) {
      console.warn("Could not attach Web Audio analyser:", e);
    }

    return () => {
      // destination connection can stay or disconnect
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let frame = 0;
    let lastDraw = 0;
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

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (time - lastDraw < 16) return;
      lastDraw = time;
      frame += 0.035;

      ctx.clearRect(0, 0, width, height);

      const mobile = width < 640;
      const count = mobile ? 64 : 112;
      const centerY = height / 2;
      const spacing = width / (count - 1);

      let audioData: Uint8Array | null = null;
      let hasSignal = false;

      if (isPlaying && analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        audioData = dataArrayRef.current;
        // Check if there is actual audio displacement
        for (let j = 0; j < audioData.length; j += 4) {
          if (Math.abs(audioData[j] - 128) > 3) {
            hasSignal = true;
            break;
          }
        }
      }

      for (let i = 0; i < count; i++) {
        const x = i * spacing;
        const normX = i / (count - 1);
        // Taper edges with sine envelope
        const envelope = Math.pow(Math.sin(Math.PI * normX), 0.6);

        let displacement = 0;
        let intensity = 0;

        if (isPlaying && hasSignal && audioData) {
          // Map index to audio buffer
          const dataIdx = Math.floor(normX * (audioData.length - 1));
          const val = (audioData[dataIdx] - 128) / 128; // -1 to 1
          displacement = val * (height * 0.42) * envelope;
          intensity = Math.min(1, Math.abs(val) * 2.2);
        } else {
          // Idle calm starlight wave, like in the hero
          const signal =
            Math.sin(i * 0.18 + frame) * 0.55 +
            Math.sin(i * 0.08 - frame * 1.2) * 0.3 +
            Math.sin(i * 0.32 + frame * 0.6) * 0.15;
          const idleAmp = mobile ? 3 : 5;
          displacement = signal * idleAmp * envelope;
          intensity = 0;
        }

        const y = centerY + displacement;
        const pulse = 0.5 + 0.5 * Math.sin(i * 0.15 - frame * 1.6);
        const radius = isPlaying && intensity > 0.4 ? 1.6 + intensity * 0.8 : 0.75 + pulse * 0.55;

        ctx.beginPath();
        if (isPlaying && intensity > 0.35) {
          // Warm orange accent on dynamic audio transients
          const orangeAlpha = 0.5 + intensity * 0.5;
          ctx.fillStyle = `rgba(229,109,54,${orangeAlpha})`;
        } else {
          // Cool delicate starlight dots
          const baseAlpha = isPlaying ? 0.35 + intensity * 0.5 : 0.2 + pulse * 0.35;
          ctx.fillStyle = `rgba(215,230,255,${baseAlpha * (0.3 + envelope * 0.7)})`;
        }

        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
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
  }, [isPlaying]);

  return (
    <div className={`relative w-full h-8 overflow-visible pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" aria-hidden="true" />
    </div>
  );
}
