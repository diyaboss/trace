import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Incident } from '../api/types';

export const DRAWER_PARAM = 'incident';

/** Location state carried by drawer navigation. */
export interface DrawerState {
  /** True when the drawer was opened by in-app navigation, so Back closes it. */
  drawer?: boolean;
  /** Row data already on screen, shown immediately while the record reloads. */
  preview?: Incident;
  /** Open straight into edit mode (row Edit action). */
  edit?: boolean;
}

// The element that opened the drawer, so focus can return to it on close.
let opener: HTMLElement | null = null;
export const takeOpener = () => {
  const element = opener;
  opener = null;
  return element;
};

export function useDrawerNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const withParam = useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(location.search);
      if (value === null) params.delete(DRAWER_PARAM);
      else params.set(DRAWER_PARAM, value);
      const search = params.toString();
      return { pathname: location.pathname, search: search ? `?${search}` : '' };
    },
    [location.pathname, location.search],
  );

  const rememberOpener = () => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };

  const openIncident = useCallback(
    (id: number, preview?: Incident, options: { edit?: boolean } = {}) => {
      rememberOpener();
      navigate(withParam(String(id)), { state: { drawer: true, preview, edit: options.edit } satisfies DrawerState });
    },
    [navigate, withParam],
  );

  const openCreate = useCallback(() => {
    rememberOpener();
    navigate(withParam('new'), { state: { drawer: true } satisfies DrawerState });
  }, [navigate, withParam]);

  /** Swap the drawer's record in place (e.g. after creation) without a new history entry. */
  const replaceIncident = useCallback(
    (id: number, preview?: Incident) => {
      const current = (location.state ?? {}) as DrawerState;
      navigate(withParam(String(id)), { replace: true, state: { drawer: current.drawer, preview } satisfies DrawerState });
    },
    [location.state, navigate, withParam],
  );

  /** Back when we pushed the drawer entry; otherwise remove the param in place. */
  const closeDrawer = useCallback(() => {
    if (((location.state ?? {}) as DrawerState).drawer) navigate(-1);
    else navigate(withParam(null), { replace: true });
  }, [location.state, navigate, withParam]);

  /** Link target + state for record links, so they work as real links too. */
  const linkTo = useCallback((id: number) => withParam(String(id)), [withParam]);

  return { openIncident, openCreate, replaceIncident, closeDrawer, linkTo, rememberOpener };
}
