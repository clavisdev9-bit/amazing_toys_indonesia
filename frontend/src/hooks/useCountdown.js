import { useState, useEffect } from 'react';

export function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    let id;
    const tick = () => {
      const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff === 0) clearInterval(id);
    };
    tick();
    id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return {
    remaining,
    mins: Math.floor(remaining / 60000),
    secs: Math.floor((remaining % 60000) / 1000),
  };
}
