// app/page.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import StarText from './components/StarText';
import StarHeading from './components/StarHeading';
import DotMatrixText from './components/DotMatrixText';
import EarthViewport from './components/EarthViewport';
import SonificationWorkstation from './components/SonificationWorkstation';
import {
  EIC_DATASETS,
  ReticleFeatures,
  SlmSonificationInput,
  SlmSonificationOutput,
} from './lib/datasets';
import {
  extractReticleFeaturesFromGibs,
  requestSlmSonification,
  buildSlmInputPayload,
} from './lib/smlPipeline';
import { ArrowDownRight } from 'lucide-react';

export default function PolarisDashboard() {
  const [activeDatasetId, setActiveDatasetId] = useState<string>(EIC_DATASETS[0].id);
  const [latestFeatures, setLatestFeatures] = useState<ReticleFeatures | null>(null);
  const [sonificationOutput, setSonificationOutput] = useState<SlmSonificationOutput | null>(null);
  const [activeSlmInput, setActiveSlmInput] = useState<SlmSonificationInput | null>(null);
  const [isInferring, setIsInferring] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const requestCounterRef = useRef<number>(0);

  const activeDataset =
    EIC_DATASETS.find((d) => d.id === activeDatasetId) || EIC_DATASETS[0];

  // Subtle 60fps scroll parallax and fade for the hero Earth image into Section 2
  useEffect(() => {
    let raf = 0;
    const handleScroll = () => {
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight || 800;
        const y = window.scrollY || 0;
        const progress = Math.min(1, Math.max(0, y / (vh * 0.85)));
        setScrollProgress(progress);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const handleCancelTrack = useCallback(() => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setIsInferring(false);
  }, []);

  const handleGenerateTrack = useCallback(async () => {
    if (!latestFeatures || isInferring) return;

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    const currentRequestId = ++requestCounterRef.current;

    const zoom = latestFeatures.zoom || 1.0;
    const initialPayload = buildSlmInputPayload(
      activeDataset,
      latestFeatures.lat,
      latestFeatures.lon,
      zoom
    );
    setActiveSlmInput(initialPayload);
    setIsInferring(true);

    try {
      const { features: gibsFeatures, slmInput } = await extractReticleFeaturesFromGibs(
        activeDataset,
        latestFeatures.lat,
        latestFeatures.lon,
        zoom
      );

      if (requestCounterRef.current !== currentRequestId || controller.signal.aborted) {
        return;
      }

      setLatestFeatures(gibsFeatures);
      setActiveSlmInput(slmInput);

      // Query our hosted polaris-slm on GCP Ollama
      const result = await requestSlmSonification(slmInput, controller.signal);

      if (requestCounterRef.current === currentRequestId && !controller.signal.aborted) {
        setSonificationOutput(result);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
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
    <div className="min-h-screen w-full overflow-x-clip bg-black text-white flex flex-col selection:bg-[#e56d36]/30">
      {/* Cinematic Earth landing section (Preserved) */}
      <section className="relative isolate flex min-h-[100svh] items-start overflow-hidden bg-black px-7 pb-20 pt-[22svh] sm:px-12 lg:px-[9vw]">
        <div
          className="pointer-events-none absolute inset-0 will-change-transform"
          aria-hidden="true"
          style={{
            transform: `translate3d(0, ${scrollProgress * 80}px, 0) scale(${1 + scrollProgress * 0.06})`,
            opacity: 1 - scrollProgress * 0.7,
          }}
        >
          <img
            src="/earth.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/60" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-b from-transparent via-black/80 to-black" />
          <div className="absolute inset-x-0 -bottom-1 h-48 bg-gradient-to-b from-transparent via-black to-black" />
        </div>

        <StarText />

        <div className="absolute left-7 top-[73%] z-10 sm:left-12 lg:left-[9vw]">
          <a
            href="#workspace"
            onClick={(e) => {
              e.preventDefault();
              const target = document.getElementById('workspace');
              if (!target) return;

              const scroller = document.scrollingElement || document.documentElement;
              const startY = scroller.scrollTop;
              const distance = target.offsetTop - startY;

              if (Math.abs(distance) < 2) return;

              const duration = 1600;
              const startTime = performance.now();
              const easeInOutCubic = (progress: number) =>
                progress < 0.5
                  ? 4 * progress * progress * progress
                  : 1 - Math.pow(-2 * progress + 2, 3) / 2;

              const animateScroll = (now: number) => {
                const progress = Math.min((now - startTime) / duration, 1);
                const nextY = startY + distance * easeInOutCubic(progress);
                scroller.scrollTop = nextY;

                if (progress < 1) requestAnimationFrame(animateScroll);
              };

              requestAnimationFrame(animateScroll);
            }}
            className="group inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.24em] text-white/55 transition-colors duration-300 hover:text-white"
          >
            <span className="border-b border-white/20 pb-0.5 uppercase transition-colors duration-300 group-hover:border-white">
              Explore the experience
            </span>
            <ArrowDownRight className="h-3.5 w-3.5 text-white/40 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:text-white" />
          </a>
        </div>
      </section>

      {/* SECTION 2: ONE CONTINUOUS CINEMATIC SCENE */}
      <main
        id="workspace"
        className="relative min-h-[100svh] scroll-mt-0 overflow-visible bg-[#07080b] px-7 py-10 text-white sm:px-12 lg:min-h-screen lg:px-[9vw] lg:py-12 flex flex-col justify-between"
      >
        {/* Subtle celestial ambient light */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" aria-hidden="true">
          <div className="absolute -right-32 top-10 h-[600px] w-[600px] rounded-full bg-[#e56d36]/[0.06] blur-[140px]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-[1700px] flex-col flex-1 justify-between gap-y-8">
          {/* Section Header: Dot-Matrix Title only (redundant subtitle removed) */}
          <header className="flex shrink-0 items-start justify-start pt-2">
            <StarHeading text="Earth, in another language." className="h-12 sm:h-16 w-full max-w-2xl" />
          </header>

          {/* Core Scene: Globe + Minimal Overlay Dataset Registry */}
          <div className="flex flex-col lg:grid lg:grid-cols-[260px_1fr] xl:grid-cols-[290px_1fr] gap-x-12 gap-y-6 min-h-0 flex-1 items-center">
            {/* Left: Minimalist Dataset Registry */}
            <aside aria-label="Dataset selection" className="flex flex-col justify-center w-full z-10 order-2 lg:order-1">
              {/* Active dataset display headline in dot-matrix font */}
              <div className="mb-6 space-y-1">
                <span className="block font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase">
                  Observation
                </span>
                <div className="h-12 sm:h-14 w-full">
                  <DotMatrixText
                    text={activeDataset.name.toUpperCase()}
                    size={22}
                    weight={700}
                    lineHeight={1.2}
                    className="w-full h-full"
                  />
                </div>
                <div className="font-mono text-[10px] tracking-wider text-[#e56d36]">
                  {activeDataset.shortCode} · {activeDataset.unit}
                </div>
              </div>

              {/* Minimal Dataset List: No cards, no dots, pure mono type with accent indicator */}
              <div
                role="radiogroup"
                aria-label="Select an Earth observation dataset"
                className="flex flex-row lg:flex-col gap-y-3 gap-x-5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 polaris-scroll"
              >
                {EIC_DATASETS.map((ds) => {
                  const isSelected = ds.id === activeDatasetId;
                  return (
                    <button
                      key={ds.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => {
                        if (ds.id !== activeDatasetId) {
                          setActiveDatasetId(ds.id);
                          setSonificationOutput(null);
                        }
                      }}
                      className="group flex items-start gap-2 text-left cursor-pointer transition shrink-0"
                    >
                      {/* Active indicator bar */}
                      <span
                        className={`mt-1.5 h-px transition-all duration-300 ${
                          isSelected
                            ? 'w-3.5 bg-[#e56d36]'
                            : 'w-0 bg-transparent group-hover:w-2 group-hover:bg-white/30'
                        }`}
                      />
                      <div>
                        <span
                          className={`block font-mono text-[11px] sm:text-xs tracking-wide transition-colors ${
                            isSelected
                              ? 'text-white font-medium'
                              : 'text-white/35 group-hover:text-white/70'
                          }`}
                        >
                          {ds.name}
                        </span>
                        {isSelected && (
                          <span className="mt-0.5 block font-mono text-[9px] text-white/40 tracking-wider">
                            {ds.shortCode} · {ds.unit}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right / Center: Friend's Globe Viewport */}
            <div className="relative h-[90vw] sm:h-[480px] lg:h-[76vh] lg:min-h-[580px] lg:max-h-[820px] w-full min-w-0 shrink-0 lg:flex-1 order-1 lg:order-2 flex items-center justify-center">
              <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
            </div>
          </div>

          {/* Bottom: Sonic Studio as an Instrument */}
          <div className="w-full shrink-0 pt-2 pb-4">
            <SonificationWorkstation
              output={sonificationOutput}
              onGenerate={handleGenerateTrack}
              onCancel={handleCancelTrack}
              isInferring={isInferring}
              activeInput={activeSlmInput}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
