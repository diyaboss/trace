import { MotionConfig } from 'motion/react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { AppShell } from './components/AppShell';
import { WorkspaceProvider } from './lib/workspace';
import { ExplorerPage } from './pages/ExplorerPage';
import { OverviewPage } from './pages/OverviewPage';

// Two screens. Record viewing, creation, editing, and deletion are drawer and
// dialog states expressed in the URL (?incident=…), not separate pages.
//
// createBrowserRouter is used only because useBlocker (the unsaved-changes
// guard for Back/Close/Escape) requires it. No loaders or actions are used.
const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/explore', element: <ExplorerPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <WorkspaceProvider>
        <RouterProvider router={router} />
      </WorkspaceProvider>
    </MotionConfig>
  );
}
