import { useEffect, useRef } from 'react';

export function useScreenWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const retryOnInteractionRef = useRef(false);

  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      return undefined;
    }

    let isMounted = true;

    const releaseWakeLock = () => {
      retryOnInteractionRef.current = false;
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      void sentinel?.release();
    };

    const requestWakeLock = async () => {
      if (!isMounted || document.visibilityState !== 'visible' || sentinelRef.current) {
        return;
      }

      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (!isMounted) {
          void sentinel.release();
          return;
        }

        retryOnInteractionRef.current = false;
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) {
            sentinelRef.current = null;
          }
        });
      } catch {
        retryOnInteractionRef.current = true;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
        return;
      }

      releaseWakeLock();
    };

    const handleInteraction = () => {
      if (retryOnInteractionRef.current) {
        void requestWakeLock();
      }
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('pointerdown', handleInteraction, { passive: true });
    document.addEventListener('keydown', handleInteraction);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('pointerdown', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      releaseWakeLock();
    };
  }, []);
}
