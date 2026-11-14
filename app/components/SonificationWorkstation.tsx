// app/components/SonificationWorkstation.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SmlSonificationOutput } from '../lib/datasets';
import { Play, Square, Sparkles } from 'lucide-react';

interface SonificationWorkstationProps {
  output: SmlSonificationOutput | null;
  onGenerate: () => void;
  isInferring: boolean;
}

const SCALE_NOTES = ['C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4', 'C5'];

export default function SonificationWorkstation({
  output,
  onGenerate,
  isInferring,
}: SonificationWorkstationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const seqRef = useRef<Tone.Sequence | null>(null);

  const stopAudio = () => {
    Tone.getTransport().stop();
    if (seqRef.current) {
      seqRef.current.dispose();
      seqRef.current = null;
    }
    setIsPlaying(false);
    setCurrentStep(-1);
  };

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const togglePlay = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }
    if (!output) return;
    await Tone.start();

    const leadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.4 },
    }).toDestination();
    leadSynth.volume.value = -8;

    const padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.4, decay: 0.5, sustain: 0.6, release: 1.2 },
    }).toDestination();
    padSynth.volume.value = -14;

    const bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    }).toDestination();
    bassSynth.volume.value = -10;

    const pulseSynth = new Tone.MembraneSynth().toDestination();
    pulseSynth.volume.value = -12;

    Tone.getTransport().bpm.value = output.tempo;

    const steps = Array.from({ length: 16 }, (_, i) => i);
    seqRef.current = new Tone.Sequence(
      (time, step) => {
        setCurrentStep(step);
        const noteIdx = output.leadSteps[step];
        if (noteIdx >= 0 && SCALE_NOTES[noteIdx]) {
          leadSynth.triggerAttackRelease(SCALE_NOTES[noteIdx], '16n', time);
        }
        if (step === 0 || step === 8) {
          padSynth.triggerAttackRelease(output.padChord, '2n', time);
        }
        if (step % 4 === 0) {
          bassSynth.triggerAttackRelease(output.bassRoot, '8n', time);
        }
        if (output.pulsePattern[step]) {
          pulseSynth.triggerAttackRelease('C1', '32n', time);
        }
      },
      steps,
      '16n'
    );

    seqRef.current.start(0);
    Tone.getTransport().start();
    setIsPlaying(true);
  };

  return (
    <section
      aria-label="Sonification workstation"
      className="shrink-0 bg-slate-950/80 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-3.5 font-mono"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4 items-center">
        {/* Left: Transport & Telemetry */}
        <div className="flex flex-col justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isInferring}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.25)]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isInferring ? 'Inferring...' : 'Sonify Region'}
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={!output}
              aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                isPlaying
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 disabled:opacity-35'
              }`}
            >
              {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Stop' : 'Play'}
            </button>
          </div>

          {/* Compact Inline Metrics */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px]">
            <span className="text-slate-400">
              BPM <strong className="text-white">{output ? output.tempo : '—'}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-slate-400">
              MODE <strong className="text-sky-300">{output ? output.scaleMode : '—'}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-400 uppercase text-[10px]">
              {isPlaying ? 'Live' : output ? 'Ready' : 'Idle'}
            </span>
          </div>
        </div>

        {/* Right: Slim 16-Step Matrix + Narration */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="space-y-1">
            {[
              { name: 'LEAD', active: (i: number) => (output?.leadSteps[i] ?? -1) >= 0, color: 'bg-sky-400' },
              { name: 'PAD', active: (i: number) => Boolean(output && (i === 0 || i === 8)), color: 'bg-indigo-400' },
              { name: 'BASS', active: (i: number) => Boolean(output && i % 4 === 0), color: 'bg-emerald-400' },
              { name: 'PULSE', active: (i: number) => Boolean(output?.pulsePattern[i]), color: 'bg-amber-400' },
            ].map((stem) => (
              <div
                key={stem.name}
                className="grid grid-cols-[46px_repeat(16,minmax(0,1fr))] gap-1 items-center"
              >
                <span className="text-[9px] tracking-wider text-slate-500">{stem.name}</span>
                {Array.from({ length: 16 }, (_, i) => {
                  const isOn = stem.active(i);
                  const isCurrent = currentStep === i;
                  return (
                    <div
                      key={i}
                      className={`h-2.5 rounded-[3px] transition-all ${
                        isOn ? stem.color : 'bg-white/[0.05]'
                      } ${isCurrent ? 'ring-1 ring-white brightness-125 scale-y-125' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Single-Line Live Scientific Narration */}
          <p
            aria-live="polite"
            className="text-[11px] text-slate-400 font-sans truncate pt-1 border-t border-white/[0.06]"
          >
            {output
              ? output.narration
              : 'Rotate the globe or pick a preset, then click Sonify Region to translate Earth telemetry into sound.'}
          </p>
        </div>
      </div>
    </section>
  );
}