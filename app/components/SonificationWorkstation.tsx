// app/components/SonificationWorkstation.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { SlmSonificationInput, SlmSonificationOutput } from '../lib/datasets';
import { Play, Square, Sparkles } from 'lucide-react';

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
  // Replace 'EF'/'Ef', 'AF'/'Af', 'BF'/'Bf', 'DF'/'Df', 'GF'/'Gf' with 'Eb', 'Ab', etc.
  note = note.replace(/^([A-G])[Ff]([0-7]?)$/, '$1b$2');

  // 2. Convert uppercase 'B' flat suffixes like 'EB4' -> 'Eb4', 'AB3' -> 'Ab3', 'BB3' -> 'Bb3', 'EB' -> 'Eb', etc.
  note = note.replace(/^([A-G])B([0-7]?)$/, '$1b$2');

  // 3. Convert enharmonic equivalents: 'E#' -> 'F', 'B#' -> 'C', 'Cb' -> 'B', 'Fb' -> 'E'
  note = note.replace(/^E#([0-7]?)$/, 'F$1');
  note = note.replace(/^B#([0-7]?)$/, 'C$1');
  note = note.replace(/^Cb([0-7]?)$/, 'B$1');
  note = note.replace(/^Fb([0-7]?)$/, 'E$1');

  // Ensure uppercase base note letter
  if (/^[a-g]/i.test(note)) {
    note = note.charAt(0).toUpperCase() + note.slice(1);
  }

  // If octave is missing (e.g. 'Eb'), default to octave 4: 'Eb4'
  if (/^[A-G][#b]?$/.test(note)) {
    note = `${note}4`;
  }

  // 4. Validate against strict scientific pitch notation: /^[A-G][#b]?[0-7]$/
  if (/^[A-G][#b]?[0-7]$/.test(note)) {
    return note;
  }

  // 5. If it still does not match, return fallback
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

  // Dedicated refs to prevent Web Audio memory leaks and enable clean disposal
  const seqRef = useRef<Tone.Sequence | null>(null);
  const leadSynthRef = useRef<Tone.PolySynth | null>(null);
  const padSynthRef = useRef<Tone.PolySynth | null>(null);
  const bassSynthRef = useRef<Tone.MonoSynth | null>(null);
  const pulseSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const outputRef = useRef<SlmSonificationOutput | null>(output);

  // Timer interval calibrated to the ~47-second inference cycle
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
      // In case Transport was not started or already stopped
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

  // Dispose all Tone.js audio nodes on component unmount
  useEffect(() => {
    return () => stopAudio();
  }, []);

  // If the user triggers inference while audio is playing, stop immediately
  useEffect(() => {
    if (isInferring && isPlaying) {
      queueMicrotask(() => stopAudio());
    }
  }, [isInferring, isPlaying]);

  // Keep outputRef current for 16-step sequence callback
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

    // Ensure any previously allocated nodes are cleaned up before creating new ones
    stopAudio();

    const bpm = output.musical_params?.bpm || output.tempo || 88;
    const filterCutoff = output.musical_params?.filter_cutoff_hz || 1600;
    const oscType = getValidOscillator(output.musical_params?.oscillator);
    const rawWet = output.musical_params?.reverb_wet ?? 0.35;
    const reverbWet = clamp(rawWet, 0.1, 0.75);

    // 1. Reverb node connected to destination
    const reverbNode = new Tone.Reverb({
      decay: 2.8,
      wet: reverbWet,
    }).toDestination();
    reverbRef.current = reverbNode;

    // 2. Filter node routed into Reverb
    const filterNode = new Tone.Filter(filterCutoff, 'lowpass').connect(reverbNode);
    filterRef.current = filterNode;

    // 3. Lead synth connected through filter -> reverb chain with maxPolyphony 16
    const leadSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 16,
      oscillator: { type: oscType },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.4 },
    } as unknown as Partial<Tone.SynthOptions>).connect(filterNode);
    leadSynth.maxPolyphony = 16;
    leadSynth.volume.value = -7;
    leadSynthRef.current = leadSynth;

    // 4. Pad synth connected through filter -> reverb chain with maxPolyphony 16
    const padSynth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 16,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.4, decay: 0.5, sustain: 0.6, release: 1.2 },
    } as unknown as Partial<Tone.SynthOptions>).connect(filterNode);
    padSynth.maxPolyphony = 16;
    padSynth.volume.value = -14;
    padSynthRef.current = padSynth;

    // 5. Bass synth to destination
    const bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    }).toDestination();
    bassSynth.volume.value = -10;
    bassSynthRef.current = bassSynth;

    // 6. Pulse kick synth to destination
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

        // Sanitize and deduplicate pad chord notes to prevent polyphony explosion
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

        // Sanitize bass root note
        const rawRootNote =
          currentOutput.musical_params?.root_note ||
          currentOutput.bassRoot ||
          'A2';
        const rootNote = sanitizeToneNote(rawRootNote, 'A2') || 'A2';

        // 1. Play sequenced lead note
        if (currentOutput.sequence_16 && currentOutput.sequence_16[step]) {
          const stepItem = currentOutput.sequence_16[step];
          const leadNote = sanitizeToneNote(stepItem.note, 'A3');
          const leadGate = sanitizeGate(stepItem.gate);
          const leadVel = sanitizeVelocity(stepItem.velocity);

          if (leadNote) {
            try {
              leadSynth.triggerAttackRelease(
                leadNote,
                leadGate,
                time,
                leadVel
              );
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

        // 2. Play harmonic pad chord on bars 1 and 3 (steps 0 and 8)
        if (step === 0 || step === 8) {
          try {
            padSynth.triggerAttackRelease(validPadChord, '2n', time);
          } catch (err) {
            console.warn('Tone.js pad trigger error:', err);
          }
        }

        // 3. Play bass root drone on 1st beat of each measure (steps 0, 4, 8, 12)
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

  const bpmDisplay = output?.musical_params?.bpm ?? output?.tempo ?? '—';
  const scaleDisplay = output?.musical_params?.scale ?? output?.scaleMode ?? '—';
  const oscDisplay = output?.musical_params?.oscillator ?? 'triangle';

  // Metrics for timer during inference
  const elapsedFraction = elapsedMs / 1000;
  const elapsedSec = Math.floor(elapsedFraction);
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = elapsedSec % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const statusMessage = getStatusMessage(elapsedSec);

  // Hairline progress bar calibrated to ~48 seconds: advances to 95% over 46s, then slowly to 98%
  const progressPercent = Math.min(
    98,
    elapsedFraction < 46
      ? (elapsedFraction / 46) * 95
      : 95 + ((elapsedFraction - 46) / 10) * 3
  );

  const slices =
    activeInput?.features?.slices_16 && activeInput.features.slices_16.length === 16
      ? activeInput.features.slices_16
      : [0.42, 0.48, 0.55, 0.61, 0.58, 0.49, 0.38, 0.32, 0.41, 0.53, 0.67, 0.72, 0.64, 0.51, 0.44, 0.39];

  return (
    <section
      aria-label="Sonification workstation"
      className="overflow-hidden rounded-[14px] border border-[#2a2c2b] bg-[#0c0d0d] px-3.5 py-3 font-mono shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_16px_42px_rgba(0,0,0,0.22)] sm:px-4 sm:py-3.5"
    >
      {isInferring ? (
        /* MINIMALIST EDITORIAL LOADER */
        <div className="flex flex-col justify-between gap-4 py-1.5">
          {/* Top Status Line */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="font-sans text-xs text-zinc-300 font-normal">
                {statusMessage}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-zinc-400">
                {formattedTime}
              </span>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="cursor-pointer text-xs text-zinc-400 transition hover:text-white"
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
                  className="w-1 sm:w-1.5 rounded-full bg-zinc-700 transition-all duration-300 animate-pulse"
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
          <div className="h-[1px] w-full overflow-hidden bg-zinc-800">
            <div
              className="h-full bg-orange-500 transition-all duration-200 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : (
        /* ACTIVE PLAYER VIEW */
        <>
          {output && (
            <div className="mb-2.5 flex items-center justify-between border-b border-white/[0.06] pb-2">
              <span className="font-mono text-xs text-zinc-500">16-Step Pattern</span>
              {output.source === 'slm' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  SLM Live
                </span>
              ) : (
                <span
                  title={output.fallback_reason || 'Procedural mathematical synthesis'}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-zinc-400"
                >
                  Procedural
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 items-stretch gap-2.5 lg:grid-cols-[310px_minmax(0,1fr)] xl:gap-3">
            {/* Left Control Column */}
            <div className="flex w-full shrink-0 flex-col justify-between gap-3 border-b border-white/[0.08] p-3.5 lg:w-[310px] lg:border-b-0 lg:border-r lg:border-white/[0.08]">
              {/* Action Buttons Row */}
              <div className="grid grid-cols-[1.35fr_1fr] items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSonifyClick}
                  disabled={isInferring}
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#ef8450] px-3.5 font-mono text-[11px] font-semibold tracking-wide text-black transition hover:bg-[#f59666] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>{isInferring ? 'Synthesizing...' : 'Sonify Region'}</span>
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  disabled={!output}
                  className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-white/[0.12] bg-white/[0.03] px-3 font-mono text-[11px] font-medium text-zinc-200 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPlaying ? <Square className="h-3 w-3 shrink-0" /> : <Play className="h-3 w-3 shrink-0" />}
                  <span>{isPlaying ? 'Stop' : 'Play'}</span>
                </button>
              </div>

              {/* Tempo / Scale / Oscillator Metrics Row */}
              <div className="grid grid-cols-[78px_1fr_1fr] items-center border-t border-white/[0.07] pt-3">
                <div className="pr-2.5">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                    Tempo
                  </span>
                  <span className="mt-1 block whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-white">
                    {output ? `${bpmDisplay} BPM` : '— BPM'}
                  </span>
                </div>

                <div className="min-w-0 border-l border-white/[0.08] px-2.5">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                    Scale
                  </span>
                  <span
                    title={String(scaleDisplay)}
                    className="mt-1 block truncate font-mono text-xs font-semibold text-white"
                  >
                    {output ? scaleDisplay : '—'}
                  </span>
                </div>

                <div className="min-w-0 border-l border-white/[0.08] pl-2.5">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                    Oscillator
                  </span>
                  <span
                    title={String(oscDisplay)}
                    className="mt-1 block truncate font-mono text-xs font-semibold text-white"
                  >
                    {output ? oscDisplay : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Four-lane sequence matrix */}
            <div className="flex min-w-0 flex-col gap-2 overflow-x-auto polaris-sequencer-scroll">
              <div className="min-w-0 space-y-2 rounded-[10px] border border-white/[0.08] bg-[#080909] p-3">
                {[
                  {
                    name: 'Lead',
                    active: (i: number) => {
                      if (output?.sequence_16?.[i]) {
                        const note = sanitizeToneNote(output.sequence_16[i].note);
                        return Boolean(note);
                      }
                      return (output?.leadSteps?.[i] ?? -1) >= 0;
                    },
                    color: 'bg-[#f18a51]',
                  },
                  {
                    name: 'Pad',
                    active: (i: number) => Boolean(output && (i === 0 || i === 8)),
                    color: 'bg-[#d4d0c8]',
                  },
                  {
                    name: 'Bass',
                    active: (i: number) => Boolean(output && i % 4 === 0),
                    color: 'bg-[#78aaa0]',
                  },
                  {
                    name: 'Pulse',
                    active: (i: number) => {
                      if (output?.sequence_16?.[i]) {
                        return output.sequence_16[i].intensity > 0.35;
                      }
                      return Boolean(output?.pulsePattern?.[i]);
                    },
                    color: 'bg-[#9695d5]',
                  },
                ].map((stem) => (
                  <div
                    key={stem.name}
                    className="grid min-w-[500px] grid-cols-[56px_repeat(16,minmax(0,1fr))] items-center gap-1.5"
                  >
                    <span className="w-14 text-xs font-medium text-zinc-400">{stem.name}</span>
                    {Array.from({ length: 16 }, (_, i) => {
                      const isOn = stem.active(i);
                      const isCurrent = currentStep === i;
                      return (
                        <div
                          key={i}
                          className={`h-4 sm:h-5 rounded-[2px] transition-all duration-100 ${
                            isOn ? stem.color : 'bg-white/[0.05]'
                          } ${
                            isCurrent
                              ? 'outline outline-1 outline-[#f18a51] outline-offset-1 shadow-[0_0_8px_rgba(241,138,81,0.35)]'
                              : ''
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Clean Editorial Narration Caption */}
              <p
                aria-live="polite"
                className="mt-3 font-sans text-sm font-normal leading-relaxed text-zinc-300"
              >
                {output
                  ? output.narration
                  : 'Rotate the globe or pick a preset, then click Sonify Region to compose audio.'}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
