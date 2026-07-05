/**
 * OfflineBanner — global status bar shown at the top of AppLayout.
 * • Offline: amber warning bar with pending-sale count
 * • Reconnected: green sync bar (auto-dismisses after 4 s)
 * • Pending > 0 while online: sync-in-progress indicator
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge }  from '@/components/ui/badge';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { WifiOff, Wifi, RefreshCw, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const { isOnline, pendingCount, syncing, syncNow, justReconnected } = useOfflineSync();

  const [showReconnected, setShowReconnected] = useState(false);

  // Show green bar briefly after reconnect
  useEffect(() => {
    if (justReconnected) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(t);
    }
  }, [justReconnected]);

  // ── Offline ──────────────────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-600">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span className="text-xs font-medium flex-1 min-w-0">
          ඔෆ්ලයින් — Bills queue ගත වේ; online වූ විට sync වේ.
        </span>
        {pendingCount > 0 && (
          <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-500 shrink-0">
            <CloudOff className="w-3 h-3 mr-1" />
            {pendingCount} pending
          </Badge>
        )}
      </div>
    );
  }

  // ── Online + pending sales waiting to sync ────────────────────────────────
  if (isOnline && pendingCount > 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 text-primary">
        <RefreshCw className={cn('w-4 h-4 shrink-0', syncing && 'animate-spin')} />
        <span className="text-xs font-medium flex-1 min-w-0">
          {syncing
            ? `ඔෆ්ලයින් ${pendingCount} Invoice(s) sync කරමින්...`
            : `${pendingCount} offline Invoice(s) sync සඳහා සුදානම්`}
        </span>
        {!syncing && (
          <Button size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0 gap-1" onClick={syncNow}>
            <RefreshCw className="w-3 h-3" /> Sync
          </Button>
        )}
      </div>
    );
  }

  // ── Just reconnected — success flash ─────────────────────────────────────
  if (showReconnected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/15 border-b border-green-500/30 text-green-600">
        <Wifi className="w-4 h-4 shrink-0" />
        <span className="text-xs font-medium">Online — ස්වයංක්‍රීය sync සිදු කෙරිණ.</span>
      </div>
    );
  }

  return null;
}
