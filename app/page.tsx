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
import { Globe2, Layers } from 'lucide-react';

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
    <div className="h-screen w-screen overflow-hidden bg-[#030712] text-slate-100 flex flex-col selection:bg-sky-500/30">
      {/* Minimalist Top Bar */}
      <header className="h-12 shrink-0 flex items-center justify-between px-5 bg-slate-950/90 border-b border-white/[0.07] font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sky-400">
            <Globe2 className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest uppercase">POLARIS</span>
          </div>
          <span className="text-slate-700">/</span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            NASA Space Apps 2026 · Earth Information Jukebox
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-slate-500">
            UTC <span className="text-slate-300">{utcTime}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SML ONLINE
          </span>
        </div>
      </header>

      {/* Main Bento Grid Fitting 100% Remaining Viewport */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[270px_1fr] gap-3 p-3">
        {/* Left Stream Rail */}
        <aside
          aria-label="Dataset registry"
          className="min-h-0 flex flex-col bg-slate-950/70 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-3 font-mono"
        >
          <div className="flex items-center justify-between px-1 pb-2.5">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <h2 className="text-[11px] font-semibold tracking-wider uppercase">
                Data Streams
              </h2>
            </div>
            <span className="text-[10px] text-slate-500">{EIC_DATASETS.length} EIC</span>
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
            className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin"
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
            <p className="text-[11px] leading-relaxed text-slate-400 font-sans line-clamp-2">
              {activeDataset.description}
            </p>
          </div>
        </aside>

        {/* Right Column: Flexible Globe Canvas + Compact Bottom Audio Deck */}
        <div className="min-h-0 flex flex-col gap-3">
          <div className="flex-1 min-h-0">
            <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
          </div>
          <SonificationWorkstation
            output={sonificationOutput}
            onGenerate={handleGenerateTrack}
            isInferring={isInferring}
          />
        </div>
      </main>
    </div>
  );
}