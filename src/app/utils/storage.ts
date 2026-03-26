export async function getJSON<T = any>(key: string, fallback: T | null = null): Promise<T | null> {
  // In Electron we have window.electron.storeGet available via preload
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && (window as any).electron && (window as any).electron.storeGet) {
      // electron-store returns undefined for unknown keys
      const v = await (window as any).electron.storeGet(key);
      return v === undefined ? fallback : (v as T);
    }
  } catch (err) {
    // fallthrough to localStorage
  }

  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    return fallback;
  }
}

export async function setJSON<T = any>(key: string, value: T): Promise<void> {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && (window as any).electron && (window as any).electron.storeSet) {
      await (window as any).electron.storeSet(key, value);
      return;
    }
  } catch (err) {
    // fallthrough to localStorage
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    // ignore
  }
}

export async function deleteStoredValue(key: string): Promise<void> {
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && (window as any).electron && (window as any).electron.storeDelete) {
      await (window as any).electron.storeDelete(key);
      return;
    }
  } catch (err) {
    // fallthrough to localStorage
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    // ignore
  }
}

/**
 * Persist to the renderer storage surface and best-effort mirror to electron-store.
 * In Electron, the canonical data source is electron-store; localStorage remains
 * a portability/fallback layer for web-style and backup flows.
 */
export function persistJSONWithElectronMirror<T = any>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // ignore
  }

  try {
    const storeSet = window.electron?.storeSet;
    if (typeof storeSet === 'function') {
      void storeSet(key, value).catch(() => {
        // Ignore mirror failures to keep renderer persistence non-breaking.
      });
    }
  } catch (err) {
    // ignore
  }
}

export function persistRawWithElectronMirror(key: string, value: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    // ignore
  }

  try {
    const storeSet = window.electron?.storeSet;
    if (typeof storeSet === 'function') {
      void storeSet(key, value).catch(() => {
        // Ignore mirror failures to keep renderer persistence non-breaking.
      });
    }
  } catch (err) {
    // ignore
  }
}

export function removeRawWithElectronMirror(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    // ignore
  }

  try {
    const storeDelete = window.electron?.storeDelete;
    if (typeof storeDelete === 'function') {
      void storeDelete(key).catch(() => {
        // Ignore mirror failures to keep renderer persistence non-breaking.
      });
    }
  } catch (err) {
    // ignore
  }
}
