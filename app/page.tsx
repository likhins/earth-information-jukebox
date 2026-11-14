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
import { Activity, Layers, ScanLine } from 'lucide-react';

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
  const [scrollOffset, setScrollOffset] = useState(0);

  const activeDataset =
    EIC_DATASETS.find((d) => d.id === activeDatasetId) || EIC_DATASETS[0];

  const filteredDatasets =
    selectedCategory === 'All'
      ? EIC_DATASETS
      : EIC_DATASETS.filter((d) => d.category === selectedCategory);

  useEffect(() => {
    const handleScroll = () => setScrollOffset(window.scrollY);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
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


      <section className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden border-b border-white/[0.07] px-0 py-0 sm:px-0 lg:px-0">
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#020712_0%,rgba(2,7,18,0.96)_24%,rgba(2,7,18,0.42)_56%,rgba(2,7,18,0.08)_100%)]" />
          <img
            src="/images/earth-backdrop.png"
            alt=""
            aria-hidden="true"
            className="absolute right-[-10%] top-[-13%] h-[94%] w-[88%] object-contain object-right-top opacity-95 will-change-transform sm:right-[-5%] sm:w-[82%] lg:right-[-2%] lg:top-[-18%] lg:h-[108%] lg:w-[78%]"
            style={{ transform: `translate3d(0, ${scrollOffset * -0.10}px, 0)` }}
          />
          <img
            src="/images/moon-foreground.png"
            alt=""
            aria-hidden="true"
            className="absolute bottom-[-1px] left-0 h-[31%] w-full object-cover object-center opacity-95 will-change-transform sm:h-[36%] lg:h-[39%]"
            style={{ transform: `translate3d(0, ${scrollOffset * -0.22}px, 0)` }}
          />
          <img
            src="/images/astronaut.png"
            alt=""
            aria-hidden="true"
            className="absolute right-[-10%] top-[13%] h-[75%] w-[68%] object-contain object-center animate-[astronaut-float_8s_ease-in-out_infinite] will-change-transform sm:right-[-3%] sm:w-[61%] lg:right-[1%] lg:top-[6%] lg:h-[88%] lg:w-[55%]"
            style={{ transform: `translate3d(0, ${scrollOffset * -0.35}px, 0)` }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-[#030712] via-[#030712]/45 to-transparent" />
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          {/* Space background is independent from the Earth artwork. */}
          <div className="absolute inset-0 polaris-space-bg" />
          <img
            src="/images/earth.png"
            alt=""
            className="absolute right-[-13%] top-[-12%] h-[88%] w-[88%] object-contain object-right-top opacity-95 will-change-transform sm:right-[-7%] sm:h-[98%] sm:w-[82%] lg:right-[-2%] lg:top-[-17%] lg:h-[112%] lg:w-[76%]"
            style={{ transform: `translate3d(0, ${scrollOffset * -0.10}px, 0)` }}
          />
          <img
            src="/images/moon-foreground.png"
            alt=""
            className="absolute bottom-[-1px] left-0 h-[31%] w-full object-cover object-center opacity-95 will-change-transform sm:h-[36%] lg:h-[39%]"
            style={{ transform: `translate3d(0, ${scrollOffset * -0.22}px, 0)` }}
          />
          <div
            className="absolute right-[-10%] top-[13%] h-[75%] w-[68%] will-change-transform sm:right-[-3%] sm:w-[61%] lg:right-[1%] lg:top-[6%] lg:h-[88%] lg:w-[55%]"
            style={{ transform: `translate3d(0, ${scrollOffset * -0.18}px, 0)` }}
          >
            <img
              src="/images/astronaut.png"
              alt=""
              className="h-full w-full object-contain object-center animate-[astronaut-drift_9s_ease-in-out_infinite]"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-t from-[#030712] to-transparent" />
        </div>      </section>

      {/* Scroll down to enter the interactive workspace */}
      <main id="workspace" className="min-h-screen scroll-mt-0 p-3 sm:p-5 lg:min-h-[calc(100svh-3.5rem)]">
        <div className="mx-auto flex min-h-2 max-w-[1800px] items-center justify-between px-1 pb-2 font-mono">


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
