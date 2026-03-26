import { shouldBootstrapFromLocalStorage } from './canonicalHydration.js';

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

export function safeReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    return fallback;
  }
}

export function readInitialWorkspaceJSON<T>(key: string, fallback: T): T {
  return shouldBootstrapFromLocalStorage() ? safeReadJSON(key, fallback) : fallback;
}

export function safeReadRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

export function safeWriteRaw(key: string, value: string): void {
  persistRawWithElectronMirror(key, value);
}

export function safeReadLocalStorageJSON<T>(key: string, fallback: T): T {
  const raw = safeReadRaw(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    return fallback;
  }
}

export function isPortableStorageKey(key: string): boolean {
  return key.startsWith('plumy.') || key.startsWith('plumy_viewstate_');
}

export function getPortableStorageSnapshot(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const snapshot: Record<string, string> = {};

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !isPortableStorageKey(key)) continue;
      const value = window.localStorage.getItem(key);
      if (typeof value === 'string') {
        snapshot[key] = value;
      }
    }
  } catch (err) {
    return {};
  }

  return snapshot;
}

export function flattenPortableStoreEntries(
  value: unknown,
  prefix = '',
  out: Record<string, unknown> = {}
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) {
      out[prefix] = value;
    }
    return out;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenPortableStoreEntries(child, nextPrefix, out);
    } else {
      out[nextPrefix] = child;
    }
  }

  return out;
}

export function getPortableStoreValue<T = unknown>(
  exported: Record<string, unknown>,
  key: string
): T | undefined {
  if (Object.prototype.hasOwnProperty.call(exported, key)) {
    return exported[key] as T;
  }

  const segments = key.split('.');
  let current: unknown = exported;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(segment in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current as T;
}

export async function getPortableElectronStoreSnapshot(): Promise<Record<string, unknown>> {
  try {
    const exported = await window.electron?.storeExport?.();
    if (!exported || typeof exported !== 'object') {
      return {};
    }

    const flattened = flattenPortableStoreEntries(exported);
    return Object.fromEntries(
      Object.entries(flattened).filter(([key]) => isPortableStorageKey(key))
    );
  } catch (err) {
    return {};
  }
}

export function clearPortableStorageKeys(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && isPortableStorageKey(key)) {
        keys.push(key);
      }
    }

    keys.forEach(key => {
      window.localStorage.removeItem(key);
    });
  } catch (err) {
    // ignore
  }
}

export function hasAnyPortableLocalStorageData(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && isPortableStorageKey(key)) {
        return true;
      }
    }
  } catch (err) {
    return false;
  }

  return false;
}

export async function clearPortableElectronStoreKeys(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const exported = await window.electron?.storeExport?.();
    if (!exported || typeof exported !== 'object') return;

    const keys = Object.keys(flattenPortableStoreEntries(exported)).filter(isPortableStorageKey);
    await Promise.all(keys.map(key => deleteStoredValue(key).catch(() => undefined)));
  } catch (err) {
    // ignore
  }
}

export async function restorePortableStorageSnapshot(
  storageSnapshot?: Record<string, string>,
  electronStoreSnapshot?: Record<string, unknown>
): Promise<void> {
  clearPortableStorageKeys();
  await clearPortableElectronStoreKeys();

  if (storageSnapshot && typeof storageSnapshot === 'object') {
    Object.entries(storageSnapshot).forEach(([key, value]) => {
      if (!isPortableStorageKey(key) || typeof value !== 'string') return;
      safeWriteRaw(key, value);
    });
  }

  if (electronStoreSnapshot && typeof electronStoreSnapshot === 'object') {
    const storeSet = window.electron?.storeSet;
    if (typeof storeSet === 'function') {
      await Promise.all(
        Object.entries(electronStoreSnapshot)
          .filter(([key]) => isPortableStorageKey(key))
          .map(([key, value]) => storeSet(key, value).catch(() => undefined))
      );
    }
  }
}
