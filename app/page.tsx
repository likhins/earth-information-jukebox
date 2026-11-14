// app/page.tsx
'use client';

import StarText from "./components/StarText";
import StarHeading from "./components/StarHeading";
import React, { useState, useCallback } from 'react';
import {
  EIC_DATASETS,
  DatasetCategory,
  ReticleFeatures,
  SmlSonificationOutput,
} from './lib/datasets';
import { runSmlInference } from './lib/smlPipeline';
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
  const [sonificationOutput, setSonificationOutput] = useState<SmlSonificationOutput | null>(null);
  const [isInferring, setIsInferring] = useState(false);

  const activeDataset =
    EIC_DATASETS.find((d) => d.id === activeDatasetId) || EIC_DATASETS[0];

  const filteredDatasets =
    selectedCategory === 'All'
      ? EIC_DATASETS
      : EIC_DATASETS.filter((d) => d.category === selectedCategory);

  const handleGenerateTrack = useCallback(async () => {
    if (!latestFeatures) return;
    setIsInferring(true);
    try {
      const result = await runSmlInference(activeDataset, latestFeatures);
      setSonificationOutput(result);
    } finally {
      setIsInferring(false);
    }
  }, [activeDataset, latestFeatures]);

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
      <main id="workspace" className="relative min-h-[100svh] scroll-mt-0 overflow-visible bg-[#070808] px-3 py-4 text-white sm:px-5 lg:min-h-[100svh] lg:px-[3vw] lg:py-6">
        <div className="pointer-events-none absolute inset-x-0 -top-32 z-0 h-64 bg-gradient-to-b from-transparent via-[#070808]/90 to-[#070808]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.045]" aria-hidden="true">
          <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:64px_64px]" />
          <div className="absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-[#e56d36]/[0.045] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-[1800px]">
          <header className="polaris-dashboard-title mb-[clamp(120px,16vh,210px)] flex min-h-[76px] items-center justify-start overflow-visible">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="relative w-full max-w-[1400px]">
                <svg className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-16 w-full -translate-y-1/2 overflow-visible opacity-45" viewBox="0 0 1400 64" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M0 32 C90 32 100 25 180 25 S270 39 350 32 S440 18 520 25 S610 42 700 32 S790 18 880 26 S970 42 1060 32 S1150 18 1240 27 S1330 35 1400 32" fill="none" stroke="rgba(190,215,245,.55)" strokeWidth="1.2" strokeDasharray="1 8" strokeLinecap="round" />
                </svg>
                <div className="relative z-10"><StarHeading text="Earth, in another language." /></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="polaris-heading-wave" aria-hidden="true">
                  <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
                </span>
                <p className="font-sans text-[clamp(0.72rem,1vw,0.9rem)] font-semibold tracking-[-0.035em] text-white/45">
                  Listen beyond what you can see.
                </p>
              </div>
            </div>
          </header>
          <div className="grid min-h-[760px] grid-cols-1 overflow-hidden rounded-[20px] border border-white/[0.13] bg-[#0a0b0b] shadow-[0_28px_90px_rgba(0,0,0,0.32)] lg:min-h-[calc(100svh-180px)] lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">

            {/* Dataset registry */}
            <aside id="dataset-registry" aria-label="Dataset registry" className="order-1 min-h-0 scroll-mt-6 overflow-hidden border-b border-white/[0.11] bg-[#0d0e0e] lg:flex lg:flex-col lg:border-b-0 lg:border-r lg:border-white/[0.11]">
              <div className="flex items-center justify-between border-b border-white/[0.1] px-4 py-4 lg:px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.035] text-[#e58a56]">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/80">Data streams</h3>
                    <p className="mt-1 font-mono text-[7px] uppercase tracking-[0.13em] text-white/30">Dataset registry</p>
                  </div>
                </div>
                <span className="font-mono text-[9px] tabular-nums text-white/35">{String(filteredDatasets.length).padStart(2, '0')} / {String(EIC_DATASETS.length).padStart(2, '0')}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 border-b border-white/[0.08] px-3 py-3 lg:px-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer rounded-md border px-2 py-1.5 font-mono text-[7px] uppercase tracking-[0.1em] transition-colors ${
                      selectedCategory === cat
                        ? 'border-[#d77b4d]/45 bg-[#d77b4d]/[0.12] text-[#f0a078]'
                        : 'border-transparent bg-white/[0.025] text-white/35 hover:border-white/10 hover:text-white/75'
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
                      className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent border-l-2 px-2.5 py-3 text-left transition-all ${
                        selected
                          ? 'border-y-white/[0.1] border-r-white/[0.1] border-l-[#ef8450] bg-[#1a1917] text-white'
                          : 'border-l-transparent text-white/43 hover:bg-white/[0.035] hover:text-white/85'
                      }`}
                    >
                      <span className={`font-mono text-[8px] tabular-nums ${selected ? 'text-[#f0a078]' : 'text-white/22'}`}>{String(index + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-sans text-[11px] font-medium tracking-[-0.01em]">{ds.name}</span>
                        <span className="mt-1 block font-mono text-[8px] tracking-[0.07em] text-white/30">
                          {ds.shortCode}<span className="px-1.5 text-white/15">/</span>{ds.unit}
                        </span>
                      </span>
                      <span className="h-2 w-2 shrink-0 rounded-full shadow-[0_0_9px_currentColor]" style={{ backgroundColor: ds.fallbackColors[2], color: ds.fallbackColors[2] }} />
                    </button>
                  );
                })}
              </div>

            </aside>

            {/* Spatial instrument and sound processor */}
            <div className="order-2 flex min-h-0 min-w-0 flex-col gap-3 bg-[#090a0a] p-3 sm:p-4 lg:p-4">
              <section id="field-explorer" className="flex min-h-0 flex-[1.35] flex-col scroll-mt-6">
                <div className="mt-2 min-h-[480px] flex-1 lg:min-h-[500px]">
                  <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
                </div>
              </section>

              <div id="sonic-studio" className="shrink-0 scroll-mt-6">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="mb-0.5 font-mono text-[7px] uppercase tracking-[0.22em] text-[#e58a56]">02 / Signal synthesis</p>
                    <h3 className="font-sans text-[15px] font-medium tracking-[-0.025em] text-white/90">Sonic studio</h3>
                  </div>
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/30">Instrument output</span>
                </div>
                <SonificationWorkstation
                  output={sonificationOutput}
                  onGenerate={handleGenerateTrack}
                  isInferring={isInferring}
                />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
