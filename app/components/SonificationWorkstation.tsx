// app/components/SonificationWorkstation.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SmlSonificationOutput } from '../lib/datasets';
import { AudioLines, Play, Square, Sparkles } from 'lucide-react';

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
      className="border-y border-white/[0.16] bg-black py-5 font-mono sm:py-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.22em] text-white/55">
          <AudioLines className="h-3.5 w-3.5 text-white/65" />
          Sonic studio
          <span className="text-white/20">/</span>
          <span className="text-white/30">16-step sequence</span>
        </div>
        <span className={`inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] ${
          isInferring ? 'text-white/75' : output ? 'text-white/75' : 'text-white/30'
        }`}>
          <span className={`h-1 w-1 rounded-full ${
            isInferring ? 'bg-white animate-pulse' : output ? 'bg-white' : 'bg-white/25'
          }`} />
          {isInferring ? 'Mapping signal' : output ? 'Sequence ready' : 'Awaiting sample'}
        </span>
      </div>

      <div className="grid grid-cols-1 items-center gap-6 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-9">
        {/* Transport and signal readout */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isInferring}
              className="inline-flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 bg-white px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-black transition-colors hover:bg-white/80 disabled:cursor-wait disabled:opacity-45"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isInferring ? 'Mapping...' : 'Sonify region'}
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={!output}
              aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
              className={`inline-flex min-h-10 min-w-[82px] cursor-pointer items-center justify-center gap-2 border px-3 text-[10px] uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${
                isPlaying
                  ? 'border-white/60 bg-white text-black'
                  : 'border-white/25 text-white/75 hover:border-white hover:text-white'
              }`}
            >
              {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isPlaying ? 'Stop' : 'Play'}
            </button>
          </div>

          <div className="grid grid-cols-3 border-y border-white/[0.12] py-3">
            <div>
              <span className="block text-[8px] uppercase tracking-[0.16em] text-white/30">Tempo</span>
              <strong className="mt-1 block text-[12px] font-normal text-white/85">{output ? output.tempo : '—'} <span className="text-[8px] text-white/35">BPM</span></strong>
            </div>
            <div className="border-l border-white/[0.1] pl-3">
              <span className="block text-[8px] uppercase tracking-[0.16em] text-white/30">Mode</span>
              <strong className="mt-1 block truncate text-[11px] font-normal text-white/85">{output ? output.scaleMode : '—'}</strong>
            </div>
            <div className="border-l border-white/[0.1] pl-3">
              <span className="block text-[8px] uppercase tracking-[0.16em] text-white/30">State</span>
              <strong className="mt-1 block text-[10px] font-normal uppercase text-white/65">{isPlaying ? 'Live' : output ? 'Ready' : 'Idle'}</strong>
            </div>
          </div>
        </div>

        {/* Four-lane sequence matrix */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="space-y-2">
            {[
              { name: 'LEAD', active: (i: number) => (output?.leadSteps[i] ?? -1) >= 0, color: 'bg-white' },
              { name: 'PAD', active: (i: number) => Boolean(output && (i === 0 || i === 8)), color: 'bg-white/75' },
              { name: 'BASS', active: (i: number) => Boolean(output && i % 4 === 0), color: 'bg-white/55' },
              { name: 'PULSE', active: (i: number) => Boolean(output?.pulsePattern[i]), color: 'bg-white/35' },
            ].map((stem) => (
              <div
                key={stem.name}
                className="grid grid-cols-[43px_repeat(16,minmax(0,1fr))] items-center gap-1.5"
              >
                <span className="text-[8px] tracking-[0.14em] text-white/35">{stem.name}</span>
                {Array.from({ length: 16 }, (_, i) => {
                  const isOn = stem.active(i);
                  const isCurrent = currentStep === i;
                  return (
                    <div
                      key={i}
                      className={`h-2.5 transition-all duration-100 ${
                        isOn ? stem.color : 'bg-white/[0.07]'
                      } ${isCurrent ? 'outline outline-1 outline-white outline-offset-2' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <p
            aria-live="polite"
            className="border-t border-white/[0.12] pt-3 font-sans text-[11px] leading-5 text-white/45"
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
