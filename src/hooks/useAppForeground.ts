import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Centralized AppState subscription (AUDIT P0-7).
 *
 * Before this hook, AuthContext, useChat, UpgradeScreen and others each
 * subscribed to `AppState.addEventListener('change', …)` independently.
 * That meant N listeners firing in non-deterministic order on every state
 * transition — races on token/socket state, redundant work.
 *
 * One subscription, two consumer flavors:
 *   - `useAppForeground(cb)` — fires once on background/inactive → active.
 *   - `useAppStateChange(cb)` — fires on every transition with (next, prev).
 *
 * Order guarantee: change listeners run BEFORE foreground listeners so the
 * code holding the "authoritative" state (e.g. AuthContext refreshing the
 * socket on resume) gets to run first. Foreground consumers can then rely
 * on that state being up-to-date.
 */

type ForegroundListener = () => void;
type ChangeListener = (state: AppStateStatus, prev: AppStateStatus) => void;

const foregroundListeners = new Set<ForegroundListener>();
const changeListeners = new Set<ChangeListener>();
let prevState: AppStateStatus = AppState.currentState;
let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  AppState.addEventListener('change', (nextState) => {
    const wasBackground = prevState === 'background' || prevState === 'inactive';
    const isActive = nextState === 'active';

    // Snapshot before iterating so a listener removing itself mid-dispatch
    // doesn't trip the iterator.
    const changes = [...changeListeners];
    changes.forEach((cb) => { try { cb(nextState, prevState); } catch {} });

    if (isActive && wasBackground) {
      const foregrounds = [...foregroundListeners];
      foregrounds.forEach((cb) => { try { cb(); } catch {} });
    }
    prevState = nextState;
  });
}

/** Fires once when the app transitions from background/inactive to active. */
export function useAppForeground(cb: ForegroundListener) {
  useEffect(() => {
    ensureSubscribed();
    foregroundListeners.add(cb);
    return () => { foregroundListeners.delete(cb); };
  }, [cb]);
}

/** Fires on every AppState transition, with the new and previous state. */
export function useAppStateChange(cb: ChangeListener) {
  useEffect(() => {
    ensureSubscribed();
    changeListeners.add(cb);
    return () => { changeListeners.delete(cb); };
  }, [cb]);
}
