// app/lib/datasets.ts

export type DatasetCategory = 'Atmosphere' | 'Oceans' | 'Cryosphere' | 'Land & Human';

export interface EicDataset {
  id: string;
  name: string;
  shortCode: string;
  category: DatasetCategory;
  unit: string;
  minVal: number;
  maxVal: number;
  colorGradient: string;
  description: string;
  /** External CDN URL (e.g., Cloudflare R2 or GitHub Release) — never store raw heavy maps in Git */
  textureUrl: string;
  /** Fallback procedural palette colors for instant offline rendering before CDN texture loads */
  fallbackColors: [string, string, string];
  hotspots: {
    id: string;
    label: string;
    lat: number;
    lon: number;
    summary: string;
  }[];
}

export interface ReticleFeatures {
  datasetId: string;
  lat: number;
  lon: number;
  windowMean: number;
  quadrantMeans: [number, number, number, number];
  spatialGradient: number;
}

export interface SmlSonificationOutput {
  tempo: number;
  scaleMode: string;
  tension: number; // 0 to 1
  leadSteps: number[]; // 16 MIDI/scale degrees (-1 = rest)
  padChord: string[];
  bassRoot: string;
  pulsePattern: boolean[]; // 16 steps
  narration: string;
}

export const EIC_DATASETS: EicDataset[] = [
  {
    id: 'sst_anomaly',
    name: 'Sea Surface Temp Anomaly',
    shortCode: 'SST-ANOM',
    category: 'Oceans',
    unit: '°C',
    minVal: -3,
    maxVal: 3,
    colorGradient: 'linear-gradient(90deg, #1d4ed8, #e2e8f0, #dc2626)',
    description: 'Departure of ocean surface temperature from long-term climatological baseline.',
    textureUrl: '', // Plug external CDN WebP URL here
    fallbackColors: ['#0f294a', '#1e40af', '#ef4444'],
    hotspots: [
      { id: 'enso', label: 'El Niño Pacific Tongue', lat: -2.5, lon: -120.0, summary: 'Strong positive thermal anomaly driving harmonic tension.' },
      { id: 'natl', label: 'North Atlantic Warming', lat: 48.0, lon: -35.0, summary: 'Elevated sea surface warmth amplifying bass resonance.' },
    ],
  },
  {
    id: 'nightlights_change',
    name: 'Global Nightlights & Change',
    shortCode: 'VIIRS-DNB',
    category: 'Land & Human',
    unit: 'nW/cm²/sr',
    minVal: 0,
    maxVal: 100,
    colorGradient: 'linear-gradient(90deg, #020617, #f59e0b, #fef08a)',
    description: 'Human settlement intensity and multi-year urban/infrastructure radiance shifts.',
    textureUrl: '',
    fallbackColors: ['#050814', '#b45309', '#fde047'],
    hotspots: [
      { id: 'indo_gangetic', label: 'Indo-Gangetic Plain', lat: 26.8, lon: 80.9, summary: 'Dense urban corridor producing rapid melodic arpeggios.' },
      { id: 'nile_delta', label: 'Nile River & Delta', lat: 30.0, lon: 31.2, summary: 'Sharp spatial gradient between desert darkness and river corridor.' },
    ],
  },
  {
    id: 'co2_concentration',
    name: 'Atmospheric CO₂ Flux',
    shortCode: 'OCO2-CO2',
    category: 'Atmosphere',
    unit: 'ppm',
    minVal: 400,
    maxVal: 430,
    colorGradient: 'linear-gradient(90deg, #065f46, #facc15, #991b1b)',
    description: 'Column-averaged dry air mole fraction of carbon dioxide across hemispheres.',
    textureUrl: '',
    fallbackColors: ['#064e3b', '#eab308', '#991b1b'],
    hotspots: [
      { id: 'east_asia', label: 'East Asian Industrial Belt', lat: 35.0, lon: 114.0, summary: 'High seasonal emission plume elevating tempo and chord density.' },
    ],
  },
  {
    id: 'sea_ice_extent',
    name: 'Arctic & Antarctic Sea Ice',
    shortCode: 'NSIDC-ICE',
    category: 'Cryosphere',
    unit: '% conc',
    minVal: 0,
    maxVal: 100,
    colorGradient: 'linear-gradient(90deg, #0c4a6e, #38bdf8, #f8fafc)',
    description: 'Polar sea ice concentration and seasonal melt boundary dynamics.',
    textureUrl: '',
    fallbackColors: ['#082f49', '#0284c7', '#f8fafc'],
    hotspots: [
      { id: 'beaufort', label: 'Beaufort Sea Margin', lat: 73.5, lon: -145.0, summary: 'Fractured ice edge triggering high-contrast percussive pulses.' },
    ],
  },
  {
    id: 'soil_moisture',
    name: 'Root-Zone Soil Moisture',
    shortCode: 'SMAP-L4',
    category: 'Land & Human',
    unit: 'm³/m³',
    minVal: 0,
    maxVal: 0.5,
    colorGradient: 'linear-gradient(90deg, #78350f, #ca8a04, #0284c7)',
    description: 'Surface and root-zone water availability tracking drought and flood anomalies.',
    textureUrl: '',
    fallbackColors: ['#451a03', '#ca8a04', '#0369a1'],
    hotspots: [
      { id: 'amazon', label: 'Amazon Basin Drought Zone', lat: -6.0, lon: -62.0, summary: 'Severe moisture deficit shifting harmony into Dorian minor.' },
    ],
  },
  {
    id: 'aerosol_optical',
    name: 'Aerosol Optical Depth',
    shortCode: 'MODIS-AOD',
    category: 'Atmosphere',
    unit: 'AOD',
    minVal: 0,
    maxVal: 1.5,
    colorGradient: 'linear-gradient(90deg, #0f172a, #a855f7, #fb923c)',
    description: 'Atmospheric dust, wildfire smoke, and sulfate particulate density.',
    textureUrl: '',
    fallbackColors: ['#0f172a', '#7e22ce', '#f97316'],
    hotspots: [
      { id: 'sahara_plume', label: 'Saharan Dust Plume', lat: 16.5, lon: -22.0, summary: 'Trans-Atlantic mineral plume creating sweeping pad modulation.' },
    ],
  },
  {
    id: 'chlorophyll_a',
    name: 'Ocean Chlorophyll-a',
    shortCode: 'PACE-CHL',
    category: 'Oceans',
    unit: 'mg/m³',
    minVal: 0.01,
    maxVal: 10,
    colorGradient: 'linear-gradient(90deg, #1e1b4b, #0d9488, #84cc16)',
    description: 'Phytoplankton bloom density indicating marine primary productivity.',
    textureUrl: '',
    fallbackColors: ['#1e1b4b', '#0f766e', '#65a30d'],
    hotspots: [
      { id: 'humboldt', label: 'Humboldt Upwelling', lat: -14.0, lon: -78.0, summary: 'Nutrient-rich bloom generating bright Lydian lead intervals.' },
    ],
  },
  {
    id: 'land_surface_temp',
    name: 'Land Surface Temp Anomaly',
    shortCode: 'MODIS-LST',
    category: 'Land & Human',
    unit: '°C',
    minVal: -10,
    maxVal: 10,
    colorGradient: 'linear-gradient(90deg, #2563eb, #f1f5f9, #e11d48)',
    description: 'Thermal skin temperature anomalies highlighting heatwaves and urban heat islands.',
    textureUrl: '',
    fallbackColors: ['#1d4ed8', '#94a3b8', '#e11d48'],
    hotspots: [
      { id: 'mediterranean', label: 'Mediterranean Heat Dome', lat: 39.0, lon: 15.0, summary: 'Extreme positive thermal anomaly accelerating sequencer pulse.' },
    ],
  },
  {
    id: 'greenland_mass',
    name: 'Ice Sheet Mass Balance',
    shortCode: 'GRACE-FO',
    category: 'Cryosphere',
    unit: 'cm w.e.',
    minVal: -200,
    maxVal: 50,
    colorGradient: 'linear-gradient(90deg, #be123c, #f43f5e, #38bdf8)',
    description: 'Gravimetric ice mass loss across Greenland and West Antarctica.',
    textureUrl: '',
    fallbackColors: ['#9f1239', '#e11d48', '#0284c7'],
    hotspots: [
      { id: 'jakobshavn', label: 'Jakobshavn Glacier', lat: 69.2, lon: -49.8, summary: 'Rapid mass loss driving deep sub-bass drone modulation.' },
    ],
  },
];