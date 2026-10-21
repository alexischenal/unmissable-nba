// src/hooks/useNight.ts
// Loads a night once and exposes where we are: loading, ready or error.

import { useEffect, useState } from 'react';
import { loadNextNight, loadNight } from '../lib/night.ts';
import type { NightJson } from '../types/public.ts';

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'ready'; night: T }
  | { status: 'error' };

function useLoaded<T>(load: (signal: AbortSignal) => Promise<T>): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((night) => setState({ status: 'ready', night }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return; // unmounted (or StrictMode's double run in dev)
        console.error(error);
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [load]);

  return state;
}

// The home page night
export const useNight = (): Loaded<NightJson> => useLoaded(loadNight);

// The next night: null when it has no games
export const useNextNight = (): Loaded<NightJson | null> => useLoaded(loadNextNight);
