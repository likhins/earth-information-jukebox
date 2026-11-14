// app/components/SonificationWorkstation.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SmlSonificationOutput } from '../lib/datasets';
import { Play, Square, Sparkles, Volume2 } from 'lucide-react';

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

        // Lead
        const noteIdx = output.leadSteps[step];
        if (noteIdx >= 0 && SCALE_NOTES[noteIdx]) {
          leadSynth.triggerAttackRelease(SCALE_NOTES[noteIdx], '16n', time);
        }

        // Pad on beat 0 & 8
        if (step === 0 || step === 8) {
          padSynth.triggerAttackRelease(output.padChord, '2n', time);
        }

        // Bass on quarter notes
        if (step % 4 === 0) {
          bassSynth.triggerAttackRelease(output.bassRoot, '8n', time);
        }

        // Pulse on spatial gradient hits
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
      className="flex flex-col gap-4 bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono"
    >
      {/* Transport Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Sonification Workstation // SML Engine
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerate}
            disabled={isInferring}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isInferring ? 'Running SML...' : 'Generate Track'}
          </button>

          <button
            type="button"
            onClick={togglePlay}
            disabled={!output}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              isPlaying
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 disabled:opacity-40'
            }`}
          >
            {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      </div>

      {/* Telemetry Readouts */}
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <dt className="text-[10px] text-slate-400">TEMPO</dt>
          <dd className="text-sm font-bold text-white mt-0.5">
            {output ? `${output.tempo} BPM` : '—'}
          </dd>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <dt className="text-[10px] text-slate-400">HARMONIC MODE</dt>
          <dd className="text-sm font-bold text-sky-300 mt-0.5">
            {output ? output.scaleMode : '—'}
          </dd>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
          <dt className="text-[10px] text-slate-400">ENGINE STATE</dt>
          <dd className="text-sm font-bold text-emerald-400 mt-0.5 uppercase">
            {isPlaying ? 'Streaming' : output ? 'Ready' : 'Idle'}
          </dd>
        </div>
      </dl>

      {/* 16-Step Sequencer Grid */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 overflow-x-auto">
        <div className="min-w-[480px] space-y-2">
          {/* Step Numbers */}
          <div className="grid grid-cols-[120px_repeat(16,minmax(0,1fr))] gap-1 text-[10px] text-slate-500 text-center">
            <span className="text-left">STEM // MAPPING</span>
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className={currentStep === i ? 'text-sky-400 font-bold' : ''}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
            ))}
          </div>

          {/* 4 Stems */}
          {[
            { name: 'Lead', desc: 'col → pitch', active: (i: number) => (output?.leadSteps[i] ?? -1) >= 0, color: 'bg-sky-400' },
            { name: 'Pad', desc: 'mean → chord', active: (i: number) => Boolean(output && (i === 0 || i === 8)), color: 'bg-indigo-400' },
            { name: 'Bass', desc: 'quad → root', active: (i: number) => Boolean(output && i % 4 === 0), color: 'bg-emerald-400' },
            { name: 'Pulse', desc: 'grad → hit', active: (i: number) => Boolean(output?.pulsePattern[i]), color: 'bg-amber-400' },
          ].map((stem) => (
            <div
              key={stem.name}
              className="grid grid-cols-[120px_repeat(16,minmax(0,1fr))] gap-1 items-center"
            >
              <div className="truncate">
                <span className="text-xs font-semibold text-slate-200">{stem.name}</span>
                <span className="block text-[9px] text-slate-500">{stem.desc}</span>
              </div>
              {Array.from({ length: 16 }, (_, i) => {
                const isOn = stem.active(i);
                const isCurrent = currentStep === i;
                return (
                  <div
                    key={i}
                    className={`h-5 rounded-sm transition-all ${
                      isOn ? stem.color : 'bg-slate-800/80'
                    } ${isCurrent ? 'ring-2 ring-white scale-105' : 'opacity-85'}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Scientific Narration (Accessibility & Storytelling) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
        <h3 className="text-[10px] uppercase tracking-wider text-sky-400 mb-1">
          Scientific Narration // Live Translation
        </h3>
        <p aria-live="polite" className="text-xs leading-relaxed text-slate-300 font-sans">
          {output
            ? output.narration
            : 'Position the reticle over a region of interest or select a Climate Preset, then press Generate Track.'}
        </p>
      </div>
    </section>
  );
}