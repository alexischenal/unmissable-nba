// src/hooks/useNight.ts
// Loads the night once and exposes where we are: loading, ready or error.

import { useEffect, useState } from 'react';
import { loadNight } from '../lib/night.ts';
import type { NightJson } from '../types/public.ts';

export type NightState =
  | { status: 'loading' }
  | { status: 'ready'; night: NightJson }
  | { status: 'error' };

export function useNight(): NightState {
  const [state, setState] = useState<NightState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    loadNight(controller.signal)
      .then((night) => setState({ status: 'ready', night }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return; // unmounted (or StrictMode's double run in dev)
        console.error(error);
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, []);

  return state;
}
