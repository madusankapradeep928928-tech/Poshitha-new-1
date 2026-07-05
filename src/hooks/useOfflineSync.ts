/**
 * useOfflineSync — syncs queued offline sales to Supabase when
 * the device comes back online.  Call once at the app root level.
 */
import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useNetworkStatus } from './useNetworkStatus';
import {
  getPendingSales,
  removePendingSale,
  incrementSyncAttempts,
  getPendingCount,
} from '@/services/offlineQueue';
import { checkoutOfflineSale } from '@/services/sales';

export function useOfflineSync() {
  const { isOnline, justReconnected } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Refresh badge count
  const refreshCount = useCallback(async () => {
    const n = await getPendingCount();
    setPendingCount(n);
  }, []);

  // Run sync
  const syncNow = useCallback(async () => {
    if (syncing) return;
    const sales = await getPendingSales();
    if (sales.length === 0) return;

    setSyncing(true);
    let successCount = 0;
    let failCount    = 0;

    for (const sale of sales) {
      try {
        await checkoutOfflineSale(sale);
        await removePendingSale(sale.id);
        successCount++;
      } catch {
        await incrementSyncAttempts(sale.id);
        failCount++;
      }
    }

    setSyncing(false);
    await refreshCount();

    if (successCount > 0) {
      toast.success(`ඔෆ්ලයින් ${successCount} Invoice(s) sync සාර්ථකයි ✓`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} Invoice sync නොවිය — නැවත උත්සාහ කෙරේ`);
    }
  }, [syncing, refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (justReconnected) {
      syncNow();
    }
  }, [justReconnected, syncNow]);

  // Load count on mount
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  return { pendingCount, syncing, syncNow, isOnline, justReconnected, refreshCount };
}
