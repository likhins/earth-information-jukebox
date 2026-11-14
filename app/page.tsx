// app/page.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  EIC_DATASETS,
  DatasetCategory,
  ReticleFeatures,
  SmlSonificationOutput,
} from './lib/datasets';
import { runSmlInference } from './lib/smlPipeline';
import EarthViewport from './components/EarthViewport';
import SonificationWorkstation from './components/SonificationWorkstation';
import { Activity, ArrowDown, ArrowRight, Globe2, Layers, ScanLine, Waves } from 'lucide-react';

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
  const [utcTime, setUtcTime] = useState<string>('--:--:--');

  const activeDataset =
    EIC_DATASETS.find((d) => d.id === activeDatasetId) || EIC_DATASETS[0];

  const filteredDatasets =
    selectedCategory === 'All'
      ? EIC_DATASETS
      : EIC_DATASETS.filter((d) => d.category === selectedCategory);

  useEffect(() => {
    const updateClock = () => setUtcTime(new Date().toISOString().slice(11, 19));
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

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
    <div className="min-h-screen w-full overflow-x-hidden bg-[#030712] text-slate-100 flex flex-col selection:bg-sky-500/30">
      {/* Minimalist Top Bar */}
      <header id="top" className="min-h-14 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 bg-slate-950/90 border-b border-white/[0.07] font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sky-400">
            <Globe2 className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest uppercase">POLARIS</span>
          </div>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-slate-400 hidden md:inline">
            NASA Space Apps 2026 · Earth Information Jukebox
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-[11px]">
          <span className="text-slate-500 hidden sm:inline">
            UTC <span className="text-slate-300">{utcTime}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SML ONLINE
          </span>
        </div>
      </header>

      <section className="relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-center overflow-hidden border-b border-white/[0.07] px-6 py-20 sm:px-10 lg:px-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_52%,rgba(14,165,233,0.16),transparent_38%),radial-gradient(ellipse_at_82%_78%,rgba(37,99,235,0.12),transparent_32%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-sky-300 uppercase">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" /> Earth, translated
            </div>
            <h1 className="max-w-3xl text-5xl leading-[0.98] font-semibold tracking-[-0.055em] text-white sm:text-7xl lg:text-[5.5rem]">
              Listen to the <span className="text-sky-300">living</span> planet.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
              Explore Earth observation data as sound. Move across a signal, find a pattern, and hear what the planet is telling us.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="#workspace" className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-5 py-3 font-mono text-sm font-bold text-slate-950 transition hover:bg-sky-300">
                Enter the workspace <ArrowRight className="h-4 w-4" />
              </a>
              <span className="font-mono text-[11px] text-slate-500">9 Earth data streams · 1 sonic instrument</span>
            </div>
            <a href="#workspace" className="mt-16 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-slate-500 uppercase transition hover:text-slate-300">
              Scroll to explore <ArrowDown className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="relative mx-auto flex aspect-square w-full max-w-[440px] items-center justify-center">
            <div className="absolute inset-[7%] rounded-full border border-sky-300/10" />
            <div className="absolute inset-[17%] rounded-full border border-sky-300/10" />
            <div className="absolute inset-[27%] rounded-full border border-sky-300/10" />
            <div className="absolute inset-[9%] animate-[spin_36s_linear_infinite] rounded-full border border-dashed border-sky-200/20" />
            <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(125,211,252,0.85),rgba(14,116,144,0.55)_24%,rgba(8,47,73,0.94)_62%,rgba(2,6,23,1)_78%)] shadow-[0_0_100px_rgba(14,165,233,0.22),inset_-24px_-20px_60px_rgba(2,6,23,0.9)]" />
            <div className="absolute inset-[16%] overflow-hidden rounded-full opacity-60">
              <div className="absolute inset-[-20%] rotate-[-22deg] space-y-7">
                {Array.from({ length: 10 }, (_, i) => <div key={i} className="h-5 rounded-[50%] border-t border-sky-100/30" />)}
              </div>
            </div>
            <div className="absolute left-[18%] top-[31%] h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_18px_5px_rgba(251,191,36,0.45)]" />
            <div className="absolute right-[24%] bottom-[31%] h-1.5 w-1.5 rounded-full bg-cyan-200 shadow-[0_0_16px_4px_rgba(103,232,249,0.5)]" />
            <div className="absolute bottom-[8%] right-[0%] hidden items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-2 font-mono text-[10px] text-slate-400 backdrop-blur sm:flex">
              <Waves className="h-3.5 w-3.5 text-sky-300" /> DATA IN / SOUND OUT
            </div>
          </div>
        </div>
      </section>

      {/* Scroll down to enter the interactive workspace */}
      <main id="workspace" className="min-h-screen scroll-mt-0 p-3 sm:p-5 lg:min-h-[calc(100svh-3.5rem)]">
        <div className="mx-auto flex min-h-12 max-w-[1800px] items-center justify-between px-1 pb-2 font-mono">
          <div>
            <p className="text-[10px] tracking-[0.2em] text-sky-300 uppercase">Interactive workspace</p>
            <p className="mt-1 text-xs text-slate-500">Choose a data stream, sample a region, then sonify it.</p>
          </div>
          <a href="#top" className="hidden text-[10px] text-slate-500 hover:text-slate-200 sm:block">Back to top ↑</a>
        </div>
        <div className="mx-auto grid min-h-0 max-w-[1800px] grid-cols-1 gap-3 lg:min-h-[calc(100svh-7.5rem)] lg:grid-cols-[280px_1fr]">
        {/* Left Stream Rail */}
        <aside
          aria-label="Dataset registry"
          className="min-h-0 flex flex-col bg-slate-950/70 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-3 font-mono lg:overflow-hidden"
        >
          <div className="flex items-center justify-between px-1 pb-2.5">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <h2 className="text-[11px] font-semibold tracking-wider uppercase">
                Data Streams
              </h2>
            </div>
            <span className="text-[10px] text-slate-500">{EIC_DATASETS.length} streams</span>
          </div>

          {/* Sleek Category Tabs */}
          <div className="flex flex-wrap gap-1 mb-2.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-0.5 rounded-md text-[10px] transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                {cat === 'Land & Human' ? 'Land' : cat}
              </button>
            ))}
          </div>

          {/* Compact Stream List */}
          <div
            role="radiogroup"
            aria-label="Select a dataset"
            className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin max-h-64 lg:max-h-none"
          >
            {filteredDatasets.map((ds) => {
              const selected = ds.id === activeDatasetId;
              return (
                <button
                  key={ds.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setActiveDatasetId(ds.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    selected
                      ? 'bg-gradient-to-r from-sky-500/15 to-transparent border border-sky-500/40 text-white'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] border border-transparent text-slate-400'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{ds.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span className={selected ? 'text-sky-400' : ''}>{ds.shortCode}</span>
                      <span>·</span>
                      <span>{ds.unit}</span>
                    </div>
                  </div>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: ds.fallbackColors[2] }}
                  />
                </button>
              );
            })}
          </div>

          {/* Active Dataset Summary Footer */}
          <div className="mt-2.5 pt-2.5 border-t border-white/[0.06] px-1">
            <div className="flex items-center gap-1.5 mb-1.5 text-[9px] tracking-[0.18em] uppercase text-slate-500">
              <ScanLine className="w-3 h-3 text-sky-400" /> Active observation
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400 font-sans line-clamp-2">
              {activeDataset.description}
            </p>
          </div>
        </aside>

        {/* Right Column: Flexible Globe Canvas + Compact Bottom Audio Deck */}
        <div className="min-h-0 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1 font-mono lg:hidden">
            <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] uppercase text-slate-400">
              <Activity className="w-3.5 h-3.5 text-sky-400" /> Live field explorer
            </span>
            <span className="text-[10px] text-slate-500">drag · zoom · sample</span>
          </div>
          <div className="h-[440px] min-h-0 sm:h-[520px] lg:h-auto lg:flex-1">
            <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
          </div>
          <SonificationWorkstation
            output={sonificationOutput}
            onGenerate={handleGenerateTrack}
            isInferring={isInferring}
          />
        </div>
        </div>
      </main>
    </div>
  );
}
