import { APCAcontrast, sRGBtoY } from 'apca-w3';

let contrastCache: Record<string, string> = {};

export const computeLuminance = (r: number, g: number, b: number) => {
  const srgb = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const parseRGBString = (rgb: string) => {
  const m = rgb.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
};

const parseHexColor = (color: string) => {
  if (!color.startsWith('#')) return null;
  const hex = color.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (normalized.length !== 6) return null;
  const bigint = parseInt(normalized, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

const parseColor = (color?: string) => {
  if (!color) return null;
  return color.startsWith('#') ? parseHexColor(color) : parseRGBString(color);
};

const getPreferredReadableTone = (color?: string): 'black' | 'white' => {
  const rgb = parseColor(color);
  if (!rgb) return 'white';

  const backgroundY = sRGBtoY(rgb);
  const blackContrast = APCAcontrast(sRGBtoY([0, 0, 0]), backgroundY);
  const whiteContrast = APCAcontrast(sRGBtoY([255, 255, 255]), backgroundY);
  return Math.abs(blackContrast) >= Math.abs(whiteContrast) ? 'black' : 'white';
};

export function getReadableOutlineColorFor(backgroundColor?: string): string {
  return getPreferredReadableTone(backgroundColor) === 'black'
    ? 'rgba(0,0,0,0.18)'
    : 'rgba(255,255,255,0.28)';
}

export function getReadableTextClassFor(key: string, fallbackColor?: string): string {
  const cacheKey = `${key}|${fallbackColor ?? ''}`;
  if (contrastCache[cacheKey]) return contrastCache[cacheKey];

  if (fallbackColor) {
    const cls = getPreferredReadableTone(fallbackColor) === 'black' ? 'text-black' : 'text-white';
    contrastCache[cacheKey] = cls;
    return cls;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    contrastCache[cacheKey] = 'text-white';
    return 'text-white';
  }

  try {
    const el = document.createElement('div');
    el.className = key;
    el.style.position = 'absolute';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.width = '1px';
    el.style.height = '1px';
    document.body.appendChild(el);
    const bg = getComputedStyle(el).backgroundColor;
    document.body.removeChild(el);
    const rgb = parseRGBString(bg);
    if (rgb) {
      const cls = getPreferredReadableTone(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`) === 'black' ? 'text-black' : 'text-white';
      contrastCache[cacheKey] = cls;
      return cls;
    }
  } catch (err) {
    // ignore
  }

  contrastCache[cacheKey] = 'text-white';
  return 'text-white';
}
