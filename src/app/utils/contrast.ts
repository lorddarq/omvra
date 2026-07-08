let contrastCache: Record<string, string> = {};

export const computeLuminance = (r: number, g: number, b: number) => {
  const srgb = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

const parseRGBString = (rgb: string) => {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
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

const getColorLuminance = (color?: string): number | null => {
  if (!color) return null;
  const rgb = color.startsWith('#') ? parseHexColor(color) : parseRGBString(color);
  if (!rgb) return null;
  return computeLuminance(rgb[0], rgb[1], rgb[2]);
};

const getPreferredReadableTone = (color?: string): 'black' | 'white' => {
  const luminance = getColorLuminance(color);
  if (luminance === null) return 'white';

  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return blackContrast >= whiteContrast ? 'black' : 'white';
};

export function getReadableOutlineColorFor(backgroundColor?: string): string {
  return getPreferredReadableTone(backgroundColor) === 'black'
    ? 'rgba(0,0,0,0.18)'
    : 'rgba(255,255,255,0.28)';
}

export function getReadableTextClassFor(key: string, fallbackColor?: string): string {
  if (contrastCache[key]) return contrastCache[key];

  if (fallbackColor) {
    const cls = getPreferredReadableTone(fallbackColor) === 'black' ? 'text-black' : 'text-white';
    contrastCache[key] = cls;
    return cls;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    contrastCache[key] = 'text-white';
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
      contrastCache[key] = cls;
      return cls;
    }
  } catch (err) {
    // ignore
  }

  contrastCache[key] = 'text-white';
  return 'text-white';
}
