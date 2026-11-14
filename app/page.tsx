// app/page.tsx
'use client';

import StarText from "./components/StarText";
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
import { Activity, ArrowDownRight, Layers, ScanLine } from 'lucide-react';

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
      <section className="relative isolate flex min-h-[100svh] items-start overflow-hidden border-b border-white/[0.08] bg-black px-7 pb-20 pt-[22svh] sm:px-12 lg:px-[9vw]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img src="/earth.png" alt="" className="absolute inset-0 h-full w-full object-cover object-center" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent via-black/65 to-black" />
          <div className="absolute inset-x-0 -bottom-1 h-40 bg-gradient-to-b from-transparent to-black" />
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
      <main id="workspace" className="relative min-h-screen scroll-mt-0 overflow-hidden bg-[#030405] px-4 py-14 sm:px-7 lg:px-[5vw] lg:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035]" aria-hidden="true">
          <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:90px_90px]" />
        </div>
        <div className="relative mx-auto max-w-[1760px]">
          <header className="mb-8 flex flex-col justify-between gap-6 border-b border-white/[0.14] pb-7 sm:flex-row sm:items-end lg:mb-10">
            <div>
              <p className="mb-4 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.28em] text-white/40"><span className="h-px w-7 bg-white/40" /> Polaris <span className="text-white/20">/</span> Earth information jukebox</p>
              <h2 className="text-3xl font-medium tracking-[-0.055em] text-white sm:text-4xl lg:text-[3.25rem]">Earth, in another language.</h2>
              <p className="mt-3 max-w-xl text-[13px] leading-6 text-white/45 sm:text-sm">Move through the signal. Find a region. Listen to what the data reveals.</p>
            </div>
            <div className="flex items-center gap-3 self-start rounded-full border border-white/[0.12] bg-white/[0.025] px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45 sm:self-auto">
              <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white/70" /> Interactive field</span>
              <span className="text-white/20">/</span>
              <span>01 — 09</span>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-1 gap-6 lg:grid-cols-[290px_minmax(0,1fr)] xl:gap-8">
            {/* Dataset index */}
            <aside aria-label="Dataset registry" className="min-h-0 rounded-2xl border border-white/[0.11] bg-[#080a0d]/90 p-5 font-mono shadow-[0_24px_80px_rgba(0,0,0,0.22)] lg:p-6">
              <div className="mb-5 flex items-center justify-between border-b border-white/[0.12] pb-4">
                <div className="flex items-center gap-2 text-white/75">
                  <Layers className="h-3.5 w-3.5 text-white/55" />
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.2em]">Data streams</h3>
                </div>
                <span className="text-[9px] tabular-nums text-white/35">{EIC_DATASETS.length} available</span>
              </div>

              <div className="mb-5 flex flex-wrap gap-2 border-b border-white/[0.08] pb-5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer rounded-full border px-2.5 py-1.5 text-[8px] uppercase tracking-[0.12em] transition-colors ${
                      selectedCategory === cat
                        ? 'border-white/30 bg-white/[0.09] text-white'
                        : 'border-transparent text-white/35 hover:border-white/15 hover:bg-white/[0.04] hover:text-white/75'
                    }`}
                  >
                    {cat === 'Land & Human' ? 'Land' : cat}
                    {selectedCategory === cat && <span className="ml-1.5 text-white/45">↗</span>}
                  </button>
                ))}
              </div>

              <div role="radiogroup" aria-label="Select a dataset" className="max-h-80 space-y-1 overflow-y-auto pr-2 lg:max-h-[min(52vh,520px)] polaris-scroll">
                {filteredDatasets.map((ds, index) => {
                  const selected = ds.id === activeDatasetId;
                  return (
                    <button
                      key={ds.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setActiveDatasetId(ds.id)}
                      className={`group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-transparent px-2.5 py-3.5 text-left transition-all ${
                        selected ? 'border-white/[0.13] bg-white/[0.055] text-white' : 'text-white/40 hover:bg-white/[0.035] hover:text-white/80'
                      }`}
                    >
                      <span className={`pt-0.5 text-[9px] tabular-nums ${
                        selected ? 'text-white/70' : 'text-white/20'
                      }`}>{String(index + 1).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium tracking-[0.01em]">{ds.name}</span>
                        <span className="mt-1 block text-[9px] tracking-[0.08em] text-white/30">
                          {ds.shortCode}<span className="px-1.5 text-white/15">/</span>{ds.unit}
                        </span>
                      </span>
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full transition-opacity ${
                          selected ? 'opacity-100' : 'opacity-45 group-hover:opacity-80'
                        }`}
                        style={{ backgroundColor: ds.fallbackColors[2] }}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-white/[0.09] bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2 text-[8px] uppercase tracking-[0.2em] text-white/40">
                  <ScanLine className="h-3 w-3" /> Active observation
                </div>
                <p className="font-sans text-xs leading-5 text-white/60">{activeDataset.description}</p>
              </div>
            </aside>

            {/* Globe and sonic instrument */}
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-[0.17em] text-white/40">
                <span className="inline-flex items-center gap-2"><Activity className="h-3 w-3" /> Live field explorer</span>
                <span>Drag / rotate · Scroll / zoom</span>
              </div>
              <div className="h-[500px] min-h-0 sm:h-[590px] lg:h-[min(58vw,720px)] lg:max-h-[720px]">
                <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
              </div>
              <div className="mt-6">
                <SonificationWorkstation
                  output={sonificationOutput}
                  onGenerate={handleGenerateTrack}
                  isInferring={isInferring}
                />
              </div>
            </div>
          </div>
          <footer className="mt-12 flex flex-col justify-between gap-2 border-t border-white/[0.1] pt-4 font-mono text-[8px] uppercase tracking-[0.2em] text-white/25 sm:flex-row">
            <span>Polaris · Earth Information Jukebox</span>
            <span>Observe slowly. Listen closely.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
