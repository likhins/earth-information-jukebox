// app/lib/gibsOffscreen.ts
import { GibsConfig } from './datasets';

const tileBufferCache = new Map<string, Uint8ClampedArray>();

export function latLonToTilePixel(lat: number, lon: number, zoom: number) {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const n = Math.pow(2, zoom);

  const xFloat = ((lon + 180) / 360) * n;
  const latRad = (clampedLat * Math.PI) / 180;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const tileX = ((Math.floor(xFloat) % n) + n) % n;
  const tileY = Math.max(0, Math.min(n - 1, Math.floor(yFloat)));

  const pixelX = Math.floor((xFloat - Math.floor(xFloat)) * 256);
  const pixelY = Math.floor((yFloat - Math.floor(yFloat)) * 256);

  return { tileX, tileY, pixelX, pixelY };
}

export function buildGibsTileUrl(gibs: GibsConfig, tileX: number, tileY: number): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${gibs.layerId}/default/${gibs.date}/${gibs.matrixSet}/${gibs.zoom}/${tileY}/${tileX}.${gibs.ext}`;
}

export async function getGibsTilePixels(
  gibs: GibsConfig,
  tileX: number,
  tileY: number
): Promise<Uint8ClampedArray | null> {
  const url = buildGibsTileUrl(gibs, tileX, tileY);
  if (tileBufferCache.has(url)) {
    return tileBufferCache.get(url)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Required for ctx.getImageData()

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve(null);

      ctx.drawImage(img, 0, 0, 256, 256);
      const pixels = ctx.getImageData(0, 0, 256, 256).data;
      tileBufferCache.set(url, pixels);
      resolve(pixels);
    };

    img.onerror = () => resolve(null); // Return null on network error so caller can fall back gracefully
    img.src = url;
  });
}