// app/page.tsx
'use client';

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
    <div className="min-h-screen w-full overflow-x-hidden bg-black text-white flex flex-col selection:bg-white/20">
      {/* Cinematic Earth landing section */}
      <section className="relative isolate flex min-h-[100svh] items-start overflow-hidden border-b border-white/[0.08] bg-black px-7 pb-20 pt-[22svh] sm:px-12 lg:px-[9vw]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img
            src="/earth.png"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            draggable={false}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-black" />
        </div>
        <div className="relative z-10 w-full max-w-[440px]">
          <p className="mb-4 font-mono text-[10px] tracking-[0.28em] text-white/55 uppercase">Polaris · Earth Information Jukebox</p>
          <h1 className="text-3xl font-medium leading-[1.08] tracking-[-0.045em] text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.7)] sm:text-5xl">Listen beyond<br />what you can see.</h1>
          <p className="mt-4 max-w-[320px] text-sm leading-6 text-white/65 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">An exploration of our planet through data, patterns and sound.</p>
          <a href="#workspace" className="mt-7 inline-flex items-center gap-2 border-b border-white/55 pb-2 font-mono text-[10px] tracking-[0.16em] text-white/85 uppercase transition hover:border-white hover:text-white">
            Explore the experience <ArrowDownRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* Interactive workspace */}
      <main id="workspace" className="relative min-h-screen scroll-mt-0 overflow-hidden bg-black px-4 py-16 sm:px-7 lg:px-[5vw]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035]" aria-hidden="true">
          <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:90px_90px]" />
        </div>
        <div className="relative mx-auto max-w-[1680px]">
          <header className="mb-8 flex flex-col justify-between gap-5 border-b border-white/[0.12] pb-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.3em] text-white/35">Polaris / Field interface</p>
              <h2 className="text-2xl font-medium tracking-[-0.045em] text-white sm:text-3xl">Earth, in another language.</h2>
              <p className="mt-2 max-w-xl text-xs leading-6 text-white/45">Move through the signal. Find a region. Listen to what the data reveals.</p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-white/40">
              <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-white/70" /> Interactive field</span>
              <span className="text-white/20">/</span>
              <span>01 — 09</span>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:gap-12">
            {/* Dataset index */}
            <aside aria-label="Dataset registry" className="min-h-0 font-mono lg:pt-1">
              <div className="mb-4 flex items-center justify-between border-b border-white/[0.12] pb-3">
                <div className="flex items-center gap-2 text-white/75">
                  <Layers className="h-3.5 w-3.5 text-white/55" />
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.2em]">Data streams</h3>
                </div>
                <span className="text-[9px] tabular-nums text-white/35">{EIC_DATASETS.length} available</span>
              </div>

              <div className="mb-5 flex flex-wrap gap-x-3 gap-y-2 border-b border-white/[0.08] pb-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`cursor-pointer text-[9px] uppercase tracking-[0.12em] transition-colors ${
                      selectedCategory === cat
                        ? 'text-white'
                        : 'text-white/35 hover:text-white/75'
                    }`}
                  >
                    {cat === 'Land & Human' ? 'Land' : cat}
                    {selectedCategory === cat && <span className="ml-1.5 text-white/45">↗</span>}
                  </button>
                ))}
              </div>

              <div role="radiogroup" aria-label="Select a dataset" className="max-h-72 space-y-0 overflow-y-auto pr-2 lg:max-h-[calc(100svh-340px)] polaris-scroll">
                {filteredDatasets.map((ds, index) => {
                  const selected = ds.id === activeDatasetId;
                  return (
                    <button
                      key={ds.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setActiveDatasetId(ds.id)}
                      className={`group flex w-full cursor-pointer items-start gap-3 border-b border-white/[0.08] py-3.5 text-left transition-colors ${
                        selected ? 'text-white' : 'text-white/40 hover:text-white/80'
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

              <div className="mt-6 border-t border-white/[0.12] pt-4">
                <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.2em] text-white/35">
                  <ScanLine className="h-3 w-3" /> Active observation
                </div>
                <p className="font-sans text-[11px] leading-5 text-white/55">{activeDataset.description}</p>
              </div>
            </aside>

            {/* Globe and sonic instrument */}
            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.17em] text-white/35">
                <span className="inline-flex items-center gap-2"><Activity className="h-3 w-3" /> Live field explorer</span>
                <span>Drag / rotate · Scroll / zoom</span>
              </div>
              <div className="h-[440px] min-h-0 sm:h-[540px] lg:h-[min(62vw,680px)] lg:max-h-[680px]">
                <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
              </div>
              <div className="mt-8">
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
