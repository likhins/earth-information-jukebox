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
import { Database, Radio, Globe2 } from 'lucide-react';

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
    const updateClock = () => {
      setUtcTime(new Date().toISOString().slice(11, 19));
    };
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
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col">
      {/* Top Mission Control Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 bg-slate-950 border-b border-slate-800/90 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-bold">
            <Globe2 className="w-4 h-4" />
            <span>NASA SPACE APPS 2026</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold tracking-wide">
            <span className="text-white">POLARIS</span>
            <span className="text-slate-600 mx-2">//</span>
            <span className="text-slate-300 font-normal">Earth Information Jukebox</span>
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-400">
            UTC <strong className="text-slate-200">{utcTime}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SML CLIENT READY
          </span>
        </div>
      </header>

      {/* Main 3-Zone Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-4 p-4 max-w-[1600px] w-full mx-auto">
        {/* Left Sidebar: 9-Dataset Registry */}
        <aside
          aria-label="Dataset registry"
          className="flex flex-col bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                EIC Dataset Registry
              </h2>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300">
              {EIC_DATASETS.length} STREAMS
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5 my-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-1 rounded text-[11px] transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Dataset Radio List */}
          <div role="radiogroup" aria-label="Select a dataset" className="space-y-2 overflow-y-auto flex-1 pr-1">
            {filteredDatasets.map((ds) => {
              const selected = ds.id === activeDatasetId;
              return (
                <button
                  key={ds.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setActiveDatasetId(ds.id)}
                  className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${
                    selected
                      ? 'bg-sky-500/10 border-sky-500/60 shadow-[0_0_15px_rgba(56,189,248,0.12)]'
                      : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-sky-400 font-semibold">{ds.shortCode}</span>
                    <span className="text-slate-500">{ds.category}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-100">{ds.name}</div>
                  <p className="text-[11px] text-slate-400 font-sans mt-1 line-clamp-2">
                    {ds.description}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Column: Viewport + Sonification Workstation */}
        <div className="flex flex-col gap-4">
          <EarthViewport dataset={activeDataset} onSampleUpdate={setLatestFeatures} />
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