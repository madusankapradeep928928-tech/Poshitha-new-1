/**
 * useNetworkStatus — React hook for online/offline detection.
 * Returns { isOnline, wasOffline } so components can react to
 * reconnection events as well as the current network state.
 */
import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  /** true for one render cycle after transitioning offline→online */
  justReconnected: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline]           = useState(navigator.onLine);
  const [justReconnected, setJustRecon]   = useState(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const handleOnline = () => {
      setIsOnline(true);
      setJustRecon(true);
      reconnectTimer = setTimeout(() => setJustRecon(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustRecon(false);
    };

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, justReconnected };
}
