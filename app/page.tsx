// app/page.tsx
'use client';
import StarText from "./components/StarText";
import StarHeading from "./components/StarHeading";
import React, { useState, useCallback, useRef } from 'react';
import {
  EIC_DATASETS,
  DatasetCategory,
  ReticleFeatures,
  SlmSonificationInput,
  SlmSonificationOutput,
} from './lib/datasets';
import {
  extractReticleFeaturesFromGibs,
  requestSlmSonification,
  buildSlmInputPayload,
} from './lib/smlPipeline';
import EarthViewport from './components/EarthViewport';
import SonificationWorkstation from './components/SonificationWorkstation';
import { ArrowDownRight, Layers } from 'lucide-react';

const CATEGORIES: ('All' | DatasetCategory)[] = [
  'All',
  'Oceans',
  'Atmosphere',
  'Cryosphere',
  'Land & Human',
];

export default function PolarisDashboard() {
  const [selectedCategory, setSelectedCategory] = useState<'All' | DatasetCategory>('All');
  const [activeDatasetId, setActiveDatasetId] = useState<string>(EIC_DATASETS[0].id);
  const [latestFeatures, setLatestFeatures] = useState<ReticleFeatures | null>(null);
  const [sonificationOutput, setSonificationOutput] = useState<SlmSonificationOutput | null>(null);
  const [activeSlmInput, setActiveSlmInput] = useState<SlmSonificationInput | null>(null);
  const [isInferring, setIsInferring] = useState(false);

  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const requestCounterRef = useRef<number>(0);

  const activeDataset =
    EIC_DATASETS.find((d) => d.id === activeDatasetId) || EIC_DATASETS[0];

  const filteredDatasets =
    selectedCategory === 'All'
      ? EIC_DATASETS
      : EIC_DATASETS.filter((d) => d.category === selectedCategory);

  const handleCancelTrack = useCallback(() => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setIsInferring(false);
  }, []);

  const handleGenerateTrack = useCallback(async () => {
    // Prevent accidental double-queueing while an SLM job is already executing
    if (!latestFeatures || isInferring) return;

    // Abort any existing in-flight SLM request to prevent race conditions
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    const currentRequestId = ++requestCounterRef.current;

    const zoom = latestFeatures.zoom || 1.0;
    // Provide immediate telemetry payload so the loading screen visualizes live reticle data from millisecond 0
    const initialPayload = buildSlmInputPayload(
      activeDataset,
      latestFeatures.lat,
      latestFeatures.lon,
      zoom
    );
    setActiveSlmInput(initialPayload);
    setIsInferring(true);

    try {
      // 1. Sample real NASA GIBS tile pixels at the reticle's (lat, lon) and build finalized SLM payload
      const { features: gibsFeatures, slmInput } = await extractReticleFeaturesFromGibs(
        activeDataset,
        latestFeatures.lat,
        latestFeatures.lon,
        zoom
      );

      // Check if this request was aborted while sampling GIBS tiles
      if (requestCounterRef.current !== currentRequestId || controller.signal.aborted) {
        return;
      }

      setLatestFeatures(gibsFeatures);
      setActiveSlmInput(slmInput);

      // 2. Query our hosted polaris-slm on GCP Ollama (~47 seconds inference)
      const result = await requestSlmSonification(slmInput, controller.signal);

      // Ensure this request wasn't superseded by a newer click or cancelled
      if (requestCounterRef.current === currentRequestId && !controller.signal.aborted) {
        setSonificationOutput(result);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Silently ignore aborted request from a subsequent "Sonify region" click or manual abort
        return;
      }
      console.warn('POLARIS SLM inference error/fallback:', err);
    } finally {
      if (requestCounterRef.current === currentRequestId) {
        setIsInferring(false);
      }
    }
  }, [activeDataset, latestFeatures, isInferring]);

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-black text-white flex flex-col selection:bg-white/20">
      {/* Cinematic Earth landing section */}
      <section className="relative isolate flex min-h-[100svh] items-start overflow-hidden bg-black px-7 pb-20 pt-[22svh] sm:px-12 lg:px-[9vw]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img src="/earth.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-b from-transparent via-black/75 to-[#070808]" />
          <div className="absolute inset-x-0 -bottom-1 h-48 bg-gradient-to-b from-transparent via-[#070808]/75 to-[#070808]" />
        </div>
        <StarText />
        <div className="absolute left-7 top-[73%] z-10 sm:left-12 lg:left-[9vw]">
          <a
            href="#workspace"
            onClick={(event) => {
              event.preventDefault();
              const target = document.getElementById("workspace");
              if (!target) return;

              const scroller = document.scrollingElement ?? document.documentElement;
              const startY = scroller.scrollTop;
              const targetY = target.getBoundingClientRect().top + startY;
              const distance = targetY - startY;

              if (Math.abs(distance) < 2) return;

              // This is an explicit user-triggered cinematic navigation.
              // Do not short-circuit it based on the OS reduced-motion preference.
              const duration = 1800;
              const startTime = performance.now();
              const easeInOutCubic = (progress: number) =>
                progress < 0.5
                  ? 4 * progress * progress * progress
                  : 1 - Math.pow(-2 * progress + 2, 3) / 2;

              const animateScroll = (now: number) => {
                const progress = Math.min((now - startTime) / duration, 1);
                const nextY = startY + distance * easeInOutCubic(progress);

                // Set the scroll position directly. window.scrollTo() would inherit
                // the global smooth-scroll rule and interpolate every animation frame.
                scroller.scrollTop = nextY;

                if (progress < 1) requestAnimationFrame(animateScroll);
              };

              requestAnimationFrame(animateScroll);
            }}
            className="inline-flex items-center gap-2 border-b border-white/55 pb-2 font-mono text-[10px] tracking-[0.16em] text-white/85 uppercase transition hover:border-white hover:text-white"
          >
            Explore the experience <ArrowDownRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="polaris-shooting-stars pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="polaris-shooting-star polaris-shooting-star-one" />
          <span className="polaris-shooting-star polaris-shooting-star-two" />
          <span className="polaris-shooting-star polaris-shooting-star-three" />
        </div>
      </section>

      {/* Interactive workspace */}
      <main id="workspace" className="relative min-h-[100svh] scroll-mt-0 overflow-visible bg-[#070808] px-3 py-4 text-white sm:px-5 lg:h-[100svh] lg:min-h-0 lg:overflow-hidden lg:px-[3vw] lg:py-3">
        <div className="pointer-events-none absolute inset-x-0 -top-32 z-0 h-64 bg-gradient-to-b from-transparent via-[#070808]/90 to-[#070808]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.045]" aria-hidden="true">
          <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:64px_64px]" />
          <div className="absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-[#e56d36]/[0.045] blur-[120px]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-[1800px] flex-col lg:h-full lg:min-h-0">
          <header className="polaris-dashboard-title mb-[clamp(24px,3vh,34px)] flex shrink-0 items-start justify-start overflow-visible">
            <div className="flex w-full min-w-0 flex-col">
              <StarHeading text="Earth, in another language." />
              <svg className="mt-1 block h-9 w-full overflow-visible" viewBox="0 0 1400 64" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 32 C95 32 110 22 205 22 S300 43 395 32 S490 15 585 24 S680 44 775 32 S870 15 965 25 S1060 43 1155 32 S1250 18 1400 32" fill="none" stroke="rgba(205,225,255,.78)" strokeWidth="2" strokeDasharray="0.1 10" strokeLinecap="round" />
              </svg>
              <p className="mt-1 font-sans text-[13px] font-semibold tracking-[-0.035em] text-white/45">
                Listen beyond what you can see.
              </p>
            </div>
          </header>
          <div className="grid min-h-[620px] grid-cols-1 overflow-hidden rounded-[20px] border border-white/[0.13] bg-[#0a0b0b] shadow-[0_28px_90px_rgba(0,0,0,0.32)] lg:min-h-0 lg:flex-1 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)]">

            {/* Dataset registry */}
            <aside id="dataset-registry" aria-label="Dataset registry" className="order-1 min-h-0 scroll-mt-6 overflow-hidden border-b border-white/[0.11] bg-[#0d0e0e] lg:flex lg:flex-col lg:border-b-0 lg:border-r lg:border-white/[0.11]">
              <div className="flex items-center justify-between border-b border-white/[0.1] px-4 py-4 lg:px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.035] text-[#e58a56]">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-200">Data streams</h3>
                    <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-zinc-400">Dataset registry</p>
                  </div>
                </div>
                <span className="font-mono text-xs tabular-nums text-zinc-400">{String(filteredDatasets.length).padStart(2, '0')} / {String(EIC_DATASETS.length).padStart(2, '0')}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 border-b border-white/[0.08] px-3 py-3 lg:px-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs font-medium uppercase tracking-wider transition-colors ${
                      selectedCategory === cat
                        ? 'border-[#d77b4d]/60 bg-[#d77b4d]/20 text-[#f0a078]'
                        : 'border-transparent bg-white/[0.04] text-zinc-300 hover:border-white/10 hover:text-white'
                    }`}
                  >
                    {cat === 'Land & Human' ? 'Land' : cat}
                  </button>
                ))}
              </div>

              <div role="radiogroup" aria-label="Select a dataset" className="max-h-80 space-y-1 overflow-y-auto px-2 py-2.5 pr-2 polaris-scroll lg:max-h-none lg:min-h-0 lg:flex-1">
                {filteredDatasets.map((ds, index) => {
                  const selected = ds.id === activeDatasetId;
                  return (
                    <button
                      key={ds.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setActiveDatasetId(ds.id)}
                      className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent border-l-2 px-2.5 py-2.5 text-left transition-all ${
                        selected
                          ? 'border-y-white/[0.1] border-r-white/[0.1] border-l-[#ef8450] bg-[#1a1917] text-white'
                          : 'border-l-transparent text-zinc-200 hover:bg-white/[0.035] hover:text-white'
                      }`}
                    >
                      <span className={`font-mono text-xs tabular-nums ${selected ? 'text-[#f0a078] font-semibold' : 'text-zinc-400'}`}>{String(index + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-sans text-sm ${selected ? 'font-semibold text-white' : 'font-medium text-zinc-200 group-hover:text-white'}`}>{ds.name}</span>
                        <span className="mt-0.5 block font-mono text-xs tracking-wider text-zinc-400">
                          {ds.shortCode}<span className="px-1.5 text-zinc-500">/</span>{ds.unit}
                        </span>
                      </span>
                      <span className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_9px_currentColor]" style={{ backgroundColor: ds.fallbackColors[2], color: ds.fallbackColors[2] }} />
                    </button>
                  );
                })}
              </div>

            </aside>

            {/* Spatial instrument and sound processor */}
            <div className="order-2 flex min-h-0 min-w-0 flex-col gap-2 bg-[#090a0a] p-2 sm:p-2.5 lg:p-2.5">
              <section id="field-explorer" className="flex min-h-0 flex-1 flex-col scroll-mt-6">
                <div className="mt-1 min-h-[380px] flex-1 lg:min-h-0">
                  <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
                </div>
              </section>

              <div id="sonic-studio" className="shrink-0 scroll-mt-6">
                <div className="mb-1 flex items-center justify-between">
                  <div>
                    <p className="mb-0.5 font-mono text-xs uppercase tracking-wider text-[#e58a56] font-medium">02 / Signal synthesis</p>
                    <h3 className="font-sans text-[15px] font-semibold tracking-[-0.025em] text-white">Sonic studio</h3>
                  </div>
                  <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">Instrument output</span>
                </div>
                <SonificationWorkstation
                  output={sonificationOutput}
                  onGenerate={handleGenerateTrack}
                  onCancel={handleCancelTrack}
                  isInferring={isInferring}
                  activeInput={activeSlmInput}
                />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
