import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type Tone = 'success' | 'info' | 'error';
export interface Notice {
  id: number;
  message: string;
  tone: Tone;
}

interface Workspace {
  /** Increments after every confirmed mutation; lists refetch when it changes. */
  dataVersion: number;
  refreshData: () => void;
  notices: Notice[];
  announce: (message: string, tone?: Tone) => void;
  dismiss: (id: number) => void;
}

const WorkspaceContext = createContext<Workspace | null>(null);

/**
 * The only shared state in the app: a data-version counter for refreshing lists
 * after mutations, and the queue of user-facing announcements.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setNotices((list) => list.filter((n) => n.id !== id)), []);
  const announce = useCallback(
    (message: string, tone: Tone = 'success') => {
      const id = nextId.current++;
      setNotices((list) => [...list.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );
  const refreshData = useCallback(() => setDataVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ dataVersion, refreshData, notices, announce, dismiss }),
    [dataVersion, refreshData, notices, announce, dismiss],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}

export const FIXTURE_MODE = import.meta.env.MODE === 'fixtures';
