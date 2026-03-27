import { useEffect, useState } from 'react';
import type { StorageMeter } from '../types.ts';

function getLocalStorageUsageBytes(): number {
  if (typeof window === 'undefined') return 0;
  try {
    let totalChars = 0;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const value = window.localStorage.getItem(key) || '';
      totalChars += key.length + value.length;
    }
    return totalChars * 2;
  } catch {
    return 0;
  }
}

interface UseStorageMeterOptions {
  enabled: boolean;
  dependencies: ReadonlyArray<unknown>;
}

const DEFAULT_STORAGE_METER: StorageMeter = {
  usedBytes: 0,
  totalBytes: 5 * 1024 * 1024,
  usagePercent: 0,
  sourceLabel: 'Estimated localStorage capacity',
};

export function useStorageMeter({ enabled, dependencies }: UseStorageMeterOptions) {
  const [storageMeter, setStorageMeter] = useState<StorageMeter>(DEFAULT_STORAGE_METER);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let cancelled = false;

    const refreshStorageMeter = async () => {
      const usedBytes = getLocalStorageUsageBytes();
      let totalBytes = DEFAULT_STORAGE_METER.totalBytes;
      let sourceLabel = DEFAULT_STORAGE_METER.sourceLabel;

      try {
        if (navigator.storage?.estimate) {
          const estimate = await navigator.storage.estimate();
          if (typeof estimate.quota === 'number' && estimate.quota > 0) {
            totalBytes = estimate.quota;
            sourceLabel = 'Browser storage estimate';
          }
        }
      } catch {
        // Keep fallback values.
      }

      const usagePercent = totalBytes > 0
        ? Math.max(0, Math.min(100, Math.round((usedBytes / totalBytes) * 100)))
        : 0;

      if (!cancelled) {
        setStorageMeter({
          usedBytes,
          totalBytes,
          usagePercent,
          sourceLabel,
        });
      }
    };

    void refreshStorageMeter();

    return () => {
      cancelled = true;
    };
  }, [enabled, ...dependencies]);

  return storageMeter;
}
