// app/lib/smlPipeline.ts
import { EicDataset, ReticleFeatures, SmlSonificationOutput } from './datasets';

const SCALES: Record<string, string[]> = {
  Lydian: ['C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5'],
  Dorian: ['C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4', 'C5'],
  Phrygian: ['C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
};

export async function runSmlInference(
  dataset: EicDataset,
  features: ReticleFeatures
): Promise<SmlSonificationOutput> {
  // Normalize windowMean to 0..1 based on dataset range
  const normVal = Math.max(
    0,
    Math.min(1, (features.windowMean - dataset.minVal) / (dataset.maxVal - dataset.minVal))
  );

  // Select musical mode based on anomaly severity
  const scaleMode = normVal > 0.72 ? 'Phrygian' : normVal < 0.35 ? 'Lydian' : 'Dorian';
  const scale = SCALES[scaleMode];

  // Tempo scales between 82 BPM (calm) and 136 BPM (intense anomaly)
  const tempo = Math.round(82 + normVal * 54);

  // Generate 16-step melody from quadrant means + spatial gradient
  const leadSteps = Array.from({ length: 16 }, (_, step) => {
    const qVal = features.quadrantMeans[step % 4];
    const qNorm = Math.max(0, Math.min(1, (qVal - dataset.minVal) / (dataset.maxVal - dataset.minVal)));
    if (step % 3 === 2 && features.spatialGradient < 0.25) return -1; // rest on low variance
    return Math.floor(qNorm * (scale.length - 1));
  });

  // Pulse triggers wherever spatial gradient exceeds threshold
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