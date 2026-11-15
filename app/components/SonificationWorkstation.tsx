// app/components/SonificationWorkstation.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SlmSonificationInput, SlmSonificationOutput } from '../lib/datasets';
import { Play, Square } from 'lucide-react';
import DotMatrixText from './DotMatrixText';
import DotMatrixWaveform from './DotMatrixWaveform';
import DotMatrixSequencer from './DotMatrixSequencer';

interface SonificationWorkstationProps {
  output: SlmSonificationOutput | null;
  onGenerate: () => void;
  onCancel?: () => void;
  isInferring?: boolean;
  activeInput?: SlmSonificationInput | null;
}

const SCALE_NOTES_FALLBACK = ['C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4', 'C5'];

type AllowedOscillator = 'fatsawtooth' | 'triangle' | 'sine' | 'sawtooth' | 'square';
const ALLOWED_OSCILLATORS: readonly AllowedOscillator[] = [
  'fatsawtooth',
  'triangle',
  'sine',
  'sawtooth',
  'square',
];

function getValidOscillator(osc?: string): AllowedOscillator {
  if (osc && ALLOWED_OSCILLATORS.includes(osc as AllowedOscillator)) {
    return osc as AllowedOscillator;
  }
  return 'triangle';
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const VALID_GATES: readonly string[] = ['1n', '2n', '4n', '8n', '16n', '32n', '4n.', '8n.'];

export function sanitizeGate(gate?: string | null): string {
  if (gate && VALID_GATES.includes(gate)) {
    return gate;
  }
  return '8n';
}

export function sanitizeVelocity(velocity: unknown): number {
  const num = Number(velocity);
  return Math.max(0.05, Math.min(1.0, isNaN(num) ? 0.5 : num));
}

export function sanitizeToneNote(
  rawNote?: string | null,
  fallback: string | null = 'A3'
): string | null {
  if (!rawNote || typeof rawNote !== 'string') return null;

  const trimmed = rawNote.trim();
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'rest') {
    return null;
  }

  let note = trimmed;

  // 1. Normalize common SLM pitch typos before regex validation:
  note = note.replace(/^([A-G])[Ff]([0-7]?)$/, '$1b$2');

  // 2. Convert uppercase 'B' flat suffixes like 'EB4' -> 'Eb4', etc.
  note = note.replace(/^([A-G])B([0-7]?)$/, '$1b$2');

  // 3. Convert enharmonic equivalents
  note = note.replace(/^E#([0-7]?)$/, 'F$1');
  note = note.replace(/^B#([0-7]?)$/, 'C$1');
  note = note.replace(/^Cb([0-7]?)$/, 'B$1');
  note = note.replace(/^Fb([0-7]?)$/, 'E$1');

  if (/^[a-g]/i.test(note)) {
    note = note.charAt(0).toUpperCase() + note.slice(1);
  }

  if (/^[A-G][#b]?$/.test(note)) {
    note = `${note}4`;
  }

  if (/^[A-G][#b]?[0-7]$/.test(note)) {
    return note;
  }

  return fallback;
}

function getStatusMessage(elapsedSec: number): string {
  if (elapsedSec >= 38) return 'Preparing audio stems...';
  if (elapsedSec >= 20) return 'Composing 16-step sequence...';
  if (elapsedSec >= 8) return 'Mapping spatial anomalies...';
  return 'Sampling satellite raster...';
}

export default function SonificationWorkstation({
  output,
  onGenerate,
  onCancel,
  isInferring = false,
  activeInput = null,
}: SonificationWorkstationProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const seqRef = useRef<Tone.Sequence | null>(null);
  const leadSynthRef = useRef<Tone.PolySynth | null>(null);
  const padSynthRef = useRef<Tone.PolySynth | null>(null);
  const bassSynthRef = useRef<Tone.MonoSynth | null>(null);
  const pulseSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const outputRef = useRef<SlmSonificationOutput | null>(output);

  useEffect(() => {
    if (!isInferring) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);

    return () => {
      clearInterval(interval);
      setElapsedMs(0);
    };
  }, [isInferring]);

  const stopAudio = () => {
    try {
      Tone.getTransport().stop();
    } catch {
      // Ignored
    }
    if (seqRef.current) {
      seqRef.current.dispose();
      seqRef.current = null;
    }
    if (leadSynthRef.current) {
      leadSynthRef.current.dispose();
      leadSynthRef.current = null;
    }
    if (padSynthRef.current) {
      padSynthRef.current.dispose();
      padSynthRef.current = null;
    }
    if (bassSynthRef.current) {
      bassSynthRef.current.dispose();
      bassSynthRef.current = null;
    }
    if (pulseSynthRef.current) {
      pulseSynthRef.current.dispose();
      pulseSynthRef.current = null;
    }
    if (filterRef.current) {
      filterRef.current.dispose();
      filterRef.current = null;
    }
    if (reverbRef.current) {
      reverbRef.current.dispose();
      reverbRef.current = null;
    }

    setIsPlaying(false);
    setCurrentStep(-1);
  };

  useEffect(() => {
    return () => stopAudio();
  }, []);

  useEffect(() => {
    if (isInferring && isPlaying) {
      queueMicrotask(() => stopAudio());
    }
  }, [isInferring, isPlaying]);

  useEffect(() => {
    outputRef.current = output;
  }, [output]);

  const handleSonifyClick = () => {
    if (isInferring) return;
    if (isPlaying) {
      stopAudio();
    }
    onGenerate();
  };

  const togglePlay = async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }
    if (!output) return;
    await Tone.start();

    stopAudio();

    const bpm = output.musical_params?.bpm || output.tempo || 88;
    const filterCutoff = output.musical_params?.filter_cutoff_hz || 1600;
    const oscType = getValidOscillator(output.musical_params?.oscillator);
    const rawWet = output.musical_params?.reverb_wet ?? 0.35;
    const reverbWet = clamp(rawWet, 0.1, 0.75);

    const reverbNode = new Tone.Reverb({
      decay: 2.8,
      wet: reverbWet,
    }).toDestination();
    reverbRef.current = reverbNode;

    const filterNode = new Tone.Filter(filterCutoff, 'lowpass').connect(reverbNode);
    filterRef.current = filterNode;

    const leadSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 16,
      oscillator: { type: oscType },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.4 },
    } as unknown as Partial<Tone.SynthOptions>).connect(filterNode);
    leadSynth.maxPolyphony = 16;
    leadSynth.volume.value = -7;
    leadSynthRef.current = leadSynth;

    const padSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 16,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.4, decay: 0.5, sustain: 0.6, release: 1.2 },
    } as unknown as Partial<Tone.SynthOptions>).connect(filterNode);
    padSynth.maxPolyphony = 16;
    padSynth.volume.value = -14;
    padSynthRef.current = padSynth;

    const bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    }).toDestination();
    bassSynth.volume.value = -10;
    bassSynthRef.current = bassSynth;

    const pulseSynth = new Tone.MembraneSynth().toDestination();
    pulseSynth.volume.value = -12;
    pulseSynthRef.current = pulseSynth;

    Tone.getTransport().bpm.value = bpm;

    const steps = Array.from({ length: 16 }, (_, i) => i);
    seqRef.current = new Tone.Sequence(
      (time, step) => {
        setCurrentStep(step);
        const currentOutput = outputRef.current;
        if (!currentOutput) return;

        const rawPadChord =
          currentOutput.musical_params?.pad_chord ||
          currentOutput.padChord ||
          ['A3', 'E4', 'A4', 'C5'];
        const padChord = Array.from(
          new Set(
            rawPadChord
              .map((n) => sanitizeToneNote(n, 'A3'))
              .filter((n): n is string => Boolean(n))
          )
        );
        const validPadChord = padChord.length > 0 ? padChord : ['A3', 'E4', 'A4', 'C5'];

        const rawRootNote =
          currentOutput.musical_params?.root_note ||
          currentOutput.bassRoot ||
          'A2';
        const rootNote = sanitizeToneNote(rawRootNote, 'A2') || 'A2';

        // 1. Sequenced lead note
        if (currentOutput.sequence_16 && currentOutput.sequence_16[step]) {
          const stepItem = currentOutput.sequence_16[step];
          const leadNote = sanitizeToneNote(stepItem.note, 'A3');
          const leadGate = sanitizeGate(stepItem.gate);
          const leadVel = sanitizeVelocity(stepItem.velocity);

          if (leadNote) {
            try {
              leadSynth.triggerAttackRelease(leadNote, leadGate, time, leadVel);
            } catch (err) {
              console.warn(`Tone.js lead step ${step} error:`, err);
            }
          }
          if (stepItem.intensity > 0.35) {
            try {
              pulseSynth.triggerAttackRelease('C1', '32n', time);
            } catch (err) {
              console.warn(`Tone.js pulse step ${step} error:`, err);
            }
          }
        } else if (currentOutput.leadSteps) {
          const noteIdx = currentOutput.leadSteps[step];
          if (noteIdx >= 0 && SCALE_NOTES_FALLBACK[noteIdx]) {
            const fallbackNote = sanitizeToneNote(SCALE_NOTES_FALLBACK[noteIdx], 'A3');
            if (fallbackNote) {
              try {
                leadSynth.triggerAttackRelease(fallbackNote, '16n', time);
              } catch (err) {
                console.warn(`Tone.js fallback lead step ${step} error:`, err);
              }
            }
          }
          if (currentOutput.pulsePattern?.[step]) {
            try {
              pulseSynth.triggerAttackRelease('C1', '32n', time);
            } catch {}
          }
        }

        // 2. Pad chord on bars 1 & 3 (steps 0, 8)
        if (step === 0 || step === 8) {
          try {
            padSynth.triggerAttackRelease(validPadChord, '2n', time);
          } catch (err) {
            console.warn('Tone.js pad trigger error:', err);
          }
        }

        // 3. Bass root drone on beat 1 of measure
        if (step % 4 === 0) {
          try {
            bassSynth.triggerAttackRelease(rootNote, '8n', time);
          } catch (err) {
            console.warn('Tone.js bass trigger error:', err);
          }
        }
      },
      steps,
      '16n'
    );

    seqRef.current.start(0);
    Tone.getTransport().start();
    setIsPlaying(true);
  };

  const bpmDisplay = output?.musical_params?.bpm ?? output?.tempo ?? 88;
  const scaleDisplay = output?.musical_params?.scale ?? output?.scaleMode ?? 'A Aeolian';
  const oscDisplay = output?.musical_params?.oscillator ?? 'triangle';

  const elapsedFraction = elapsedMs / 1000;
  const elapsedSec = Math.floor(elapsedFraction);
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent = Math.min(
    98,
    elapsedFraction < 46
      ? (elapsedFraction / 46) * 95
      : 95 + ((elapsedFraction - 46) / 10) * 3
  );
  const statusMessage = getStatusMessage(elapsedSec);

  const slices =
    activeInput?.features?.slices_16 && activeInput.features.slices_16.length === 16
      ? activeInput.features.slices_16
      : [0.42, 0.48, 0.55, 0.61, 0.58, 0.49, 0.38, 0.32, 0.41, 0.53, 0.67, 0.72, 0.64, 0.51, 0.44, 0.39];

  return (
    <div
      aria-label="Sonic studio instrument"
      className="relative w-full font-mono select-none"
    >
      {/* Live dot-matrix waveform visualizer spanning across */}
      <div className="mb-3 w-full">
        <DotMatrixWaveform isPlaying={isPlaying} />
      </div>

      {isInferring ? (
        /* MINIMALIST EDITORIAL LOADER WITH TELEMETRY EQUALIZER */
        <div className="flex min-h-[120px] flex-col justify-between gap-4 py-2">
          {/* Top Status Line */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-[#e56d36] animate-pulse" />
              <span className="font-mono text-xs text-white/85 tracking-wide">
                {statusMessage}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-white/45">
                {formattedTime}
              </span>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="cursor-pointer border-b border-white/20 pb-0.5 font-mono text-[10px] tracking-widest uppercase text-white/40 transition hover:border-white hover:text-white"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Minimal 16-Step Equalizer Line */}
          <div className="flex h-14 items-end justify-center gap-1.5 py-1">
            {slices.map((val, idx) => {
              const heightPercent = Math.max(14, Math.min(100, Math.round(val * 100)));
              return (
                <div
                  key={idx}
                  className="w-1 sm:w-1.5 rounded-full bg-white/35 transition-all duration-300 animate-pulse"
                  style={{
                    height: `${heightPercent}%`,
                    animationDelay: `${idx * 80}ms`,
                    animationDuration: '2s',
                  }}
                />
              );
            })}
          </div>

          {/* Hairline Progress Track */}
          <div className="h-[1px] w-full overflow-hidden bg-white/10">
            <div
              className="h-full bg-[#e56d36] transition-all duration-200 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        /* ACTIVE INSTRUMENT VIEW */
        <div className="flex flex-col gap-3.5">
          {/* Dot-matrix 16x4 sequencer */}
          <div className="w-full">
            <DotMatrixSequencer
              output={output}
              currentStep={currentStep}
              isPlaying={isPlaying}
              slices={slices}
            />
          </div>

          {/* Inline Controls & Readouts Row: Pure typography, no cards */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            {/* Left: Primary Actions */}
            <div className="flex items-center gap-6">
              {/* Primary text CTA in hero style */}
              <button
                type="button"
                onClick={handleSonifyClick}
                disabled={isInferring}
                className="group inline-flex items-center gap-2 border-b border-white/55 pb-1 font-mono text-[10px] tracking-[0.16em] text-white/90 uppercase transition hover:border-[#e56d36] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              >
                Sonify Region
                <span className="inline-block transition-transform group-hover:translate-x-0.5 text-[#e56d36]">→</span>
              </button>

              {/* Minimal circular play/pause icon: only shown when sonification is ready */}
              {output && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Stop sonification' : 'Play sonification'}
                  title={isPlaying ? 'Stop' : 'Play'}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition cursor-pointer ${
                    isPlaying
                      ? 'border-[#e56d36] text-[#e56d36] shadow-[0_0_12px_rgba(229,109,54,0.35)]'
                      : 'border-white/30 text-white/80 hover:border-white hover:text-white'
                  }`}
                >
                  {isPlaying ? (
                    <Square className="h-3 w-3 fill-current" />
                  ) : (
                    <Play className="h-3 w-3 fill-current ml-0.5" />
                  )}
                </button>
              )}
            </div>

            {/* Center / Right: Inline Telemetry Readout */}
            <div className="flex flex-wrap items-center gap-5 font-mono text-[11px] tracking-wider text-white/50">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-white/35">TEMPO</span>
                {output ? (
                  <DotMatrixText
                    text={String(bpmDisplay)}
                    size={17}
                    weight={700}
                    step={1.9}
                    className="h-5 w-8 inline-block align-middle"
                  />
                ) : (
                  <span className="text-white/40 font-mono">—</span>
                )}
                <span className="text-[9px] text-white/40">BPM</span>
              </div>
              <span className="text-white/20">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-white/35">SCALE</span>
                <span className="text-white/80 uppercase font-mono">{output ? scaleDisplay : '—'}</span>
              </div>
              <span className="text-white/20">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-white/35">VOICE</span>
                <span className="text-white/80 uppercase font-mono">{output ? oscDisplay : '—'}</span>
              </div>
            </div>
          </div>

          {/* Quiet caption narration line */}
          <p
            aria-live="polite"
            className="font-mono text-[11px] leading-relaxed tracking-wide text-white/40"
          >
            {output?.narration || 'Select a region on the globe and click Sonify Region.'}
          </p>
        </div>
      )}
    </div>
  );
}
