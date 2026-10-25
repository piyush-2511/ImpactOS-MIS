'use client';

import * as React from 'react';

/** The right panel shows the selected record and its actions. Any list page opens it via `useRightPanel().open(...)`. */
export type PanelContent = { title: string; subtitle?: string; body: React.ReactNode };
type Ctx = { content: PanelContent | null; open: (c: PanelContent) => void; close: () => void };

const RightPanelCtx = React.createContext<Ctx | null>(null);

export function RightPanelProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = React.useState<PanelContent | null>(null);
  const value = React.useMemo<Ctx>(() => ({ content, open: setContent, close: () => setContent(null) }), [content]);
  return <RightPanelCtx.Provider value={value}>{children}</RightPanelCtx.Provider>;
}

export function useRightPanel(): Ctx {
  const ctx = React.useContext(RightPanelCtx);
  if (!ctx) throw new Error('useRightPanel must be used inside <AppShell>');
  return ctx;
}
