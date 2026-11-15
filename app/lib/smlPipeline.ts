// app/lib/smlPipeline.ts
import { EicDataset, ReticleFeatures, SmlSonificationOutput } from './datasets';
import { getGibsTilePixels, latLonToTilePixel } from './gibsOffscreen';

const SCALES: Record<string, string[]> = {
  Lydian: ['C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5'],
  Dorian: ['C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4', 'C5'],
  Phrygian: ['C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
};

/**
 * Fetches the NASA GIBS WMTS tile for (lat, lon) via Offscreen Canvas,
 * samples a 16x16 pixel reticle window, and outputs ReticleFeatures.
 */
export async function extractReticleFeaturesFromGibs(
  dataset: EicDataset,
  lat: number,
  lon: number
): Promise<ReticleFeatures> {
  const { tileX, tileY, pixelX, pixelY } = latLonToTilePixel(lat, lon, dataset.gibs.zoom);
  const pixels = await getGibsTilePixels(dataset.gibs, tileX, tileY);

  // Offline / fallback safety if Wi-Fi drops during demo
  if (!pixels) {
    const mid = (dataset.minVal + dataset.maxVal) / 2;
    return {
      datasetId: dataset.id,
      lat,
      lon,
      windowMean: mid,
      quadrantMeans: [mid, mid * 1.05, mid * 0.95, mid],
      spatialGradient: 0.3,
    };
  }

  const halfWin = 8; // 16x16 reticle window
  const qSums = [0, 0, 0, 0];
  const qCounts = [0, 0, 0, 0];
  const allNorms: number[] = [];

  for (let dy = -halfWin; dy < halfWin; dy++) {
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

      // Quadrant index: 0 = NW, 1 = NE, 2 = SW, 3 = SE
      const qIdx = (dy >= 0 ? 2 : 0) + (dx >= 0 ? 1 : 0);
      qSums[qIdx] += norm;
      qCounts[qIdx]++;
    }
  }

  const mapToPhysical = (n: number) =>
    dataset.minVal + n * (dataset.maxVal - dataset.minVal);

  const quadrantMeans = [0, 1, 2, 3].map((i) =>
    mapToPhysical(qCounts[i] ? qSums[i] / qCounts[i] : 0.5)
  ) as [number, number, number, number];

  const meanNorm = allNorms.reduce((acc, v) => acc + v, 0) / allNorms.length;
  const variance =
    allNorms.reduce((acc, v) => acc + Math.pow(v - meanNorm, 2), 0) / allNorms.length;

  return {
    datasetId: dataset.id,
    lat,
    lon,
    windowMean: mapToPhysical(meanNorm),
    quadrantMeans,
    spatialGradient: Math.min(1, Math.sqrt(variance) * 3.5), // Normalized 0..1 contrast
  };
}

export async function runSmlInference(
  dataset: EicDataset,
  features: ReticleFeatures
): Promise<SmlSonificationOutput> {
  const normVal = Math.max(
    0,
    Math.min(1, (features.windowMean - dataset.minVal) / (dataset.maxVal - dataset.minVal))
  );

  const scaleMode = normVal > 0.72 ? 'Phrygian' : normVal < 0.35 ? 'Lydian' : 'Dorian';
  const scale = SCALES[scaleMode];
  const tempo = Math.round(82 + normVal * 54);

  const leadSteps = Array.from({ length: 16 }, (_, step) => {
    const qVal = features.quadrantMeans[step % 4];
    const qNorm = Math.max(0, Math.min(1, (qVal - dataset.minVal) / (dataset.maxVal - dataset.minVal)));
    if (step % 3 === 2 && features.spatialGradient < 0.25) return -1;
    return Math.floor(qNorm * (scale.length - 1));
  });

  const pulsePattern = Array.from({ length: 16 }, (_, step) => {
    return step % 4 === 0 || (features.spatialGradient > 0.45 && step % 2 === 1);
  });

  const padChord =
    scaleMode === 'Phrygian'
      ? ['C3', 'Db3', 'G3', 'Bb3']
      : scaleMode === 'Dorian'
      ? ['C3', 'Eb3', 'G3', 'Bb3']
      : ['C3', 'E3', 'G3', 'B3'];

  const bassRoot = normVal > 0.6 ? 'C2' : 'G1';
  const latDir = features.lat >= 0 ? 'N' : 'S';
  const lonDir = features.lon >= 0 ? 'E' : 'W';

  const narration = `[${dataset.shortCode}] Sampling ${Math.abs(features.lat).toFixed(1)}°${latDir}, ${Math.abs(
    features.lon
  ).toFixed(1)}°${lonDir}: Mean value ${features.windowMean.toFixed(2)} ${
    dataset.unit
  } with ${features.spatialGradient > 0.5 ? 'high' : 'moderate'} spatial gradient mapped to ${scaleMode} mode at ${tempo} BPM.`;

  return {
    tempo,
    scaleMode,
    tension: normVal,
    leadSteps,
    padChord,
    bassRoot,
    pulsePattern,
    narration,
  };
}