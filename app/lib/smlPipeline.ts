// app/lib/smlPipeline.ts
import {
  EicDataset,
  ReticleFeatures,
  SlmSonificationInput,
  SlmSonificationOutput,
  getDatasetContext,
} from './datasets';
import { getGibsTilePixels, latLonToTilePixel } from './gibsOffscreen';

const SCALES_MAP: Record<string, string[]> = {
  'A Aeolian': ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'],
  'C Phrygian': ['C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
  'D Dorian': ['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'],
  'F Lydian': ['F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'],
};

/**
 * Builds the exact SLM input specification payload from sampled satellite or procedural features.
 */
export function buildSlmInputPayload(
  dataset: EicDataset,
  lat: number,
  lon: number,
  zoom: number = 1.0,
  sampledData?: {
    slices16: number[];
    warmRatio: number;
    coolRatio: number;
    spatialVariance: number;
  }
): SlmSonificationInput {
  const zoomRatio = +(Math.max(0.85, zoom)).toFixed(2);
  const zoomClass = zoomRatio >= 2.5 ? 'Micro' : zoomRatio >= 1.2 ? 'Macro' : 'Global';

  let slices16: number[];
  let warmRatio: number;
  let coolRatio: number;
  let spatialVariance: number;

  if (sampledData) {
    slices16 = sampledData.slices16;
    warmRatio = sampledData.warmRatio;
    coolRatio = sampledData.coolRatio;
    spatialVariance = sampledData.spatialVariance;
  } else {
    // Deterministic geometric harmonic approximation if raw pixel data is unavailable
    const radLat = (lat * Math.PI) / 180;
    const radLon = (lon * Math.PI) / 180;
    const base = 0.5 + 0.26 * Math.sin(radLon * 2 + dataset.id.length) * Math.cos(radLat * 1.5);

    slices16 = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      const v = base + 0.14 * Math.sin(angle + radLon) + 0.08 * Math.cos(angle * 2 - radLat);
      return +(Math.max(0.12, Math.min(0.88, v))).toFixed(2);
    });

    const warmCount = slices16.filter((v) => v >= 0.5).length;
    warmRatio = +(warmCount / 16).toFixed(2);
    coolRatio = +(1 - warmRatio).toFixed(2);

    const mean = slices16.reduce((acc, v) => acc + v, 0) / 16;
    const variance = slices16.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / 16;
    spatialVariance = +(Math.max(0.005, variance)).toFixed(3);
  }

  return {
    dataset_id: dataset.id,
    dataset_context: getDatasetContext(dataset),
    features: {
      zoom_ratio: zoomRatio,
      zoom_class: zoomClass,
      warm_ratio: warmRatio,
      cool_ratio: coolRatio,
      spatial_variance: spatialVariance,
      slices_16: slices16,
    },
  };
}

/**
 * Fetches the NASA GIBS WMTS tile for (lat, lon) via Offscreen Canvas,
 * samples a 16x16 pixel reticle window, and outputs both ReticleFeatures
 * and the structured SlmSonificationInput.
 */
export async function extractReticleFeaturesFromGibs(
  dataset: EicDataset,
  lat: number,
  lon: number,
  zoom: number = 1.0
): Promise<{ features: ReticleFeatures; slmInput: SlmSonificationInput }> {
  const { tileX, tileY, pixelX, pixelY } = latLonToTilePixel(lat, lon, dataset.gibs.zoom);
  const pixels = await getGibsTilePixels(dataset.gibs, tileX, tileY);

  const halfWin = 8; // 16x16 reticle window
  const qSums = [0, 0, 0, 0];
  const qCounts = [0, 0, 0, 0];
  const allNorms: number[] = [];
  const rowSums = new Array(16).fill(0);
  const rowCounts = new Array(16).fill(0);

  if (pixels) {
    for (let dy = -halfWin; dy < halfWin; dy++) {
      const rowIndex = dy + halfWin;
      for (let dx = -halfWin; dx < halfWin; dx++) {
        const px = Math.max(0, Math.min(255, pixelX + dx));
        const py = Math.max(0, Math.min(255, pixelY + dy));
        const idx = (py * 256 + px) * 4;

        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];

        // Transparent pixels (alpha === 0) represent no-data masks in GIBS layers
        const norm = a === 0 ? 0.15 : (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        allNorms.push(norm);

        // 16 horizontal spatial slices across the reticle
        rowSums[rowIndex] += norm;
        rowCounts[rowIndex]++;

        // Quadrant index: 0 = NW, 1 = NE, 2 = SW, 3 = SE
        const qIdx = (dy >= 0 ? 2 : 0) + (dx >= 0 ? 1 : 0);
        qSums[qIdx] += norm;
        qCounts[qIdx]++;
      }
    }
  }

  const mapToPhysical = (n: number) =>
    dataset.minVal + n * (dataset.maxVal - dataset.minVal);

  if (allNorms.length === 0) {
    const defaultPayload = buildSlmInputPayload(dataset, lat, lon, zoom);
    const mid = (dataset.minVal + dataset.maxVal) / 2;
    return {
      features: {
        datasetId: dataset.id,
        lat,
        lon,
        zoom,
        windowMean: mid,
        quadrantMeans: [mid, mid * 1.05, mid * 0.95, mid],
        spatialGradient: 0.3,
      },
      slmInput: defaultPayload,
    };
  }

  const quadrantMeans = [0, 1, 2, 3].map((i) =>
    mapToPhysical(qCounts[i] ? qSums[i] / qCounts[i] : 0.5)
  ) as [number, number, number, number];

  const meanNorm = allNorms.reduce((acc, v) => acc + v, 0) / allNorms.length;
  const variance =
    allNorms.reduce((acc, v) => acc + Math.pow(v - meanNorm, 2), 0) / allNorms.length;

  const slices16 = rowSums.map((sum, i) => +(sum / (rowCounts[i] || 1)).toFixed(2));
  const warmCount = allNorms.filter((v) => v >= 0.5).length;
  const warmRatio = +(warmCount / allNorms.length).toFixed(2);
  const coolRatio = +(1 - warmRatio).toFixed(2);
  const spatialVariance = +(Math.max(0.005, variance)).toFixed(3);

  const slmInput = buildSlmInputPayload(dataset, lat, lon, zoom, {
    slices16,
    warmRatio,
    coolRatio,
    spatialVariance,
  });

  const features: ReticleFeatures = {
    datasetId: dataset.id,
    lat,
    lon,
    zoom,
    windowMean: mapToPhysical(meanNorm),
    quadrantMeans,
    spatialGradient: Math.min(1, Math.sqrt(variance) * 3.5),
  };

  return { features, slmInput };
}

/**
 * Fallback to deterministic procedural sonification if VM is unreachable or inference fails.
 */
export function buildProceduralFallback(payload: SlmSonificationInput): SlmSonificationOutput {
  const { warm_ratio, cool_ratio, zoom_class, zoom_ratio, slices_16 } = payload.features;
  const variable = payload.dataset_context?.variable || payload.dataset_id;
  const meaning =
    warm_ratio >= cool_ratio
      ? payload.dataset_context?.warm_color_meaning || 'high-value anomalies'
      : payload.dataset_context?.cool_color_meaning || 'low-value anomalies';

  const scaleName = warm_ratio > 0.65 ? 'C Phrygian' : cool_ratio > 0.55 ? 'A Aeolian' : 'D Dorian';
  const scaleNotes = SCALES_MAP[scaleName] || SCALES_MAP['A Aeolian'];
  const bpm = Math.round(76 + warm_ratio * 38);
  const root_note = scaleName === 'C Phrygian' ? 'C2' : scaleName === 'D Dorian' ? 'D2' : 'A2';
  const pad_chord =
    scaleName === 'C Phrygian'
      ? ['C3', 'Db3', 'G3', 'Bb3']
      : scaleName === 'D Dorian'
      ? ['D3', 'F3', 'A3', 'C4']
      : ['A3', 'E4', 'A4', 'C5'];

  const sequence_16 = slices_16.map((val, step) => {
    const clamped = Math.max(0, Math.min(1, val));
    const noteIdx = Math.floor(clamped * (scaleNotes.length - 1));
    return {
      step,
      note: scaleNotes[noteIdx],
      velocity: +(0.42 + clamped * 0.35).toFixed(2),
      gate: '8n',
      intensity: +clamped.toFixed(2),
    };
  });

  const dominantRatio = Math.round(Math.max(warm_ratio, cool_ratio) * 100);
  const narration = `${zoom_class} visual analysis (${zoom_ratio}x) of ${variable} highlights ${meaning} across ${dominantRatio}% of the selected reticle.`;

  return {
    source: 'fallback',
    narration,
    musical_params: {
      bpm,
      scale: scaleName,
      root_note,
      pad_chord,
      oscillator: 'fatsawtooth',
      filter_cutoff_hz: Math.round(1200 + warm_ratio * 900),
      reverb_wet: 0.44,
    },
    sequence_16,
    // Compatibility fields
    tempo: bpm,
    scaleMode: scaleName,
    padChord: pad_chord,
    bassRoot: root_note,
    leadSteps: sequence_16.map((s) => scaleNotes.indexOf(s.note)),
    pulsePattern: sequence_16.map((s) => s.intensity > 0.38),
  };
}

/**
 * Posts the sonification payload to our Next.js API route (/api/sonify),
 * which handles the Ollama connection with 60s timeout and returns the parsed SLM output.
 */
export async function requestSlmSonification(
  payload: SlmSonificationInput,
  signal?: AbortSignal
): Promise<SlmSonificationOutput> {
  const res = await fetch('/api/sonify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Sonification API failed with status: ${res.status}`);
  }

  const result: SlmSonificationOutput = await res.json();

  // Populate backward compatibility fields if needed by older views
  if (!result.tempo && result.musical_params) {
    result.tempo = result.musical_params.bpm;
    result.scaleMode = result.musical_params.scale;
    result.padChord = result.musical_params.pad_chord;
    result.bassRoot = result.musical_params.root_note;
  }

  return result;
}

/**
 * High-level helper to trigger inference from dataset + reticle features.
 */
export async function runSmlInference(
  dataset: EicDataset,
  features: ReticleFeatures,
  zoom: number = 1.0
): Promise<SlmSonificationOutput> {
  const payload = buildSlmInputPayload(dataset, features.lat, features.lon, zoom);
  try {
    return await requestSlmSonification(payload);
  } catch (err) {
    console.warn('Frontend fetch error connecting to /api/sonify, falling back locally', err);
    return buildProceduralFallback(payload);
  }
}
