import { useEffect, useRef } from 'react';

/**
 * Fires `callback` whenever the browser tab becomes visible again or the
 * network reconnects — handles stale data after periods of inactivity.
 * The ref trick ensures it always calls the latest version of the callback
 * without re-registering the event listeners on every render.
 */
export function useVisibilityRefresh(callback: () => void) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') ref.current();
    };
    const onOnline = () => ref.current();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);
}
