import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

/**
 * Guards unsaved form input. Every way of leaving the record — Close, Escape,
 * browser Back, the nav links, opening another record — is a navigation, so a
 * single blocker covers them all. Reload/tab close uses `beforeunload`.
 *
 * Returns the blocker plus `release()`, which lets a deliberate navigation
 * through immediately (e.g. after a successful save).
 */
export function useUnsavedChanges(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const release = useCallback(() => {
    dirtyRef.current = false;
  }, []);

  return { blocker, release };
}
