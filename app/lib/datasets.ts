// app/lib/datasets.ts

export type DatasetCategory = 'Atmosphere' | 'Oceans' | 'Cryosphere' | 'Land & Human';

export interface GibsConfig {
  layerId: string;
  matrixSet: string;
  date: string;
  zoom: number; // Safe zoom <= matrixSet max level
  ext: 'png' | 'jpg';
}

export interface DatasetContext {
  variable: string;
  unit: string;
  warm_color_meaning: string;
  cool_color_meaning: string;
}

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
  textureUrl: string;
  gibs: GibsConfig;
  fallbackColors: [string, string, string];
  context?: DatasetContext;
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
  zoom?: number;
  windowMean: number;
  quadrantMeans: [number, number, number, number];
  spatialGradient: number;
}

export interface SlmSonificationInput {
  dataset_id: string;
  dataset_context: DatasetContext;
  features: {
    zoom_ratio: number;
    zoom_class: string;
    warm_ratio: number;
    cool_ratio: number;
    spatial_variance: number;
    slices_16: number[];
  };
}

export interface SlmSequenceStep {
  step: number;
  note: string;
  velocity: number;
  gate: string;
  intensity: number;
}

export interface SlmMusicalParams {
  bpm: number;
  scale: string;
  root_note: string;
  pad_chord: string[];
  oscillator: string;
  filter_cutoff_hz: number;
  reverb_wet: number;
}

export interface SlmSonificationOutput {
  source: 'slm' | 'fallback' | string;
  narration: string;
  musical_params: SlmMusicalParams;
  sequence_16: SlmSequenceStep[];
  fallback_reason?: string;
  // Compatibility getters/fields for older components if needed
  tempo?: number;
  scaleMode?: string;
  leadSteps?: number[];
  padChord?: string[];
  bassRoot?: string;
  pulsePattern?: boolean[];
}

// Backward compatibility alias
export type SmlSonificationOutput = SlmSonificationOutput;

export function getDatasetContext(dataset: EicDataset): DatasetContext {
  if (dataset.context) return dataset.context;
  const contextMap: Record<string, DatasetContext> = {
    sst_anomaly: {
      variable: 'Sea Surface Temperature and Current Velocity',
      unit: 'degC_and_m_s',
      warm_color_meaning: 'high-temperature tropical surface waters and fast thermal currents',
      cool_color_meaning: 'cold polar waters and deep upwelling zones',
    },
    nightlights_change: {
      variable: 'Global Nightlights & Radiant Intensity',
      unit: 'nW/cm²/sr',
      warm_color_meaning: 'high-density urban settlements and electrified infrastructure',
      cool_color_meaning: 'unlit rural regions, oceans, and protected preserves',
    },
    co2_concentration: {
      variable: 'Atmospheric CO₂ Mole Fraction',
      unit: 'ppm',
      warm_color_meaning: 'concentrated industrial greenhouse gas plumes and seasonal peaks',
      cool_color_meaning: 'vegetative carbon sinks and clean baseline air masses',
    },
    sea_ice_extent: {
      variable: 'Polar Sea Ice Concentration',
      unit: '% conc',
      warm_color_meaning: 'perennial multi-year sea ice pack and high reflectivity',
      cool_color_meaning: 'open lead channels and accelerated melt zones',
    },
    soil_moisture: {
      variable: 'Root-Zone Soil Moisture',
      unit: 'm³/m³',
      warm_color_meaning: 'saturated fertile soil horizons and flood basins',
      cool_color_meaning: 'severe agricultural drought and arid desiccation',
    },
    aerosol_optical: {
      variable: 'Aerosol Optical Depth',
      unit: 'AOD',
      warm_color_meaning: 'thick particulate plumes from biomass burning and mineral dust',
      cool_color_meaning: 'pristine troposphere and clear maritime air columns',
    },
    chlorophyll_a: {
      variable: 'Ocean Chlorophyll-a Biomass',
      unit: 'mg/m³',
      warm_color_meaning: 'dense phytoplankton blooms and high marine primary productivity',
      cool_color_meaning: 'nutrient-depleted oligotrophic oceanic gyres',
    },
    land_surface_temp: {
      variable: 'Land Surface Thermal Anomaly',
      unit: '°C',
      warm_color_meaning: 'severe land heatwaves and urban thermal heat islands',
      cool_color_meaning: 'vegetation-buffered cool microclimates and highland snow',
    },
    greenland_mass: {
      variable: 'Ice Sheet Gravimetric Mass Anomaly',
      unit: 'cm w.e.',
      warm_color_meaning: 'stable firn accumulation sectors',
      cool_color_meaning: 'accelerated peripheral outlet glacier discharge and mass deficit',
    },
  };

  return (
    contextMap[dataset.id] || {
      variable: dataset.name,
      unit: dataset.unit,
      warm_color_meaning: `high-value regions exceeding median ${dataset.unit}`,
      cool_color_meaning: `low-value regions below baseline ${dataset.unit}`,
    }
  );
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
    textureUrl: '',
    gibs: {
      layerId: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies',
      matrixSet: 'GoogleMapsCompatible_Level7',
      date: '2025-10-15',
      zoom: 4,
      ext: 'png',
    },
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
    gibs: {
      layerId: 'VIIRS_Black_Marble',
      matrixSet: 'GoogleMapsCompatible_Level8',
      date: '2016-01-01', // Static composite layer date
      zoom: 5,
      ext: 'png',
    },
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
    // Inside co2_concentration in app/lib/datasets.ts
  gibs: {
    layerId: 'AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Monthly_Day',
    matrixSet: 'GoogleMapsCompatible_Level6',
    date: '2025-10-01',
    zoom: 3,
    ext: 'png',
  },
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
    gibs: {
      layerId: 'GHRSST_L4_MUR_Sea_Ice_Concentration',
      matrixSet: 'GoogleMapsCompatible_Level7',
      date: '2025-10-15',
      zoom: 4,
      ext: 'png',
    },
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
    gibs: {
      layerId: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture',
      matrixSet: 'GoogleMapsCompatible_Level6',
      date: '2024-06-15',
      zoom: 4,
      ext: 'png',
    },
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
    // Inside aerosol_optical in app/lib/datasets.ts
  gibs: {
    layerId: 'MODIS_Combined_Value_Added_AOD',
    matrixSet: 'GoogleMapsCompatible_Level6',
    date: '2025-10-15',
    zoom: 4,
    ext: 'png',
  },
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
    // In chlorophyll_a
  gibs: {
    layerId: 'OCI_PACE_Chlorophyll_a',
    matrixSet: 'GoogleMapsCompatible_Level7',
    date: '2026-11-14',
    zoom: 4,
    ext: 'png',
  },
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
    gibs: {
      layerId: 'MODIS_Terra_Land_Surface_Temp_Day',
      matrixSet: 'GoogleMapsCompatible_Level7',
      date: '2025-10-15',
      zoom: 4,
      ext: 'png',
    },
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
    gibs: {
      layerId: 'MODIS_Terra_NDSI_Snow_Cover',
      matrixSet: 'GoogleMapsCompatible_Level8',
      date: '2025-10-15',
      zoom: 4,
      ext: 'png',
    },
    fallbackColors: ['#9f1239', '#e11d48', '#0284c7'],
    hotspots: [
      { id: 'jakobshavn', label: 'Jakobshavn Glacier', lat: 69.2, lon: -49.8, summary: 'Rapid mass loss driving deep sub-bass drone modulation.' },
    ],
  },
];