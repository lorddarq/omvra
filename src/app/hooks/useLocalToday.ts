import { useEffect, useState } from 'react';
import { startOfLocalDay } from '../utils/timeSurface.ts';

export function useLocalToday(): Date {
  const [today, setToday] = useState(() => startOfLocalDay(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      const nextToday = startOfLocalDay(now);
      setToday(current => current.getTime() === nextToday.getTime() ? current : nextToday);
      // Calendar arithmetic keeps midnight correct across daylight-saving changes.
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return today;
}
