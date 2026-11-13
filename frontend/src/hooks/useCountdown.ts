import { useEffect, useState } from 'react';

/**
 * Seconds left until a server-given wait (Retry-After) runs out. Pass a new
 * `start` object for each wait so a repeated identical value still restarts it.
 */
export function useCountdown(start: { seconds: number } | null): number {
  const [left, setLeft] = useState(start?.seconds ?? 0);

  useEffect(() => {
    if (!start) {
      setLeft(0);
      return;
    }
    const endsAt = Date.now() + start.seconds * 1000;
    setLeft(start.seconds);
    const timer = setInterval(() => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [start]);

  return left;
}
