import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

/**
 * Platform console (console.theimpactos.in). This layout only enforces the host; every console page, action and route
 * handler must call requirePlatformStaff() (phase 5 adds the console shell around the pages).
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  if ((await headers()).get('x-impactos-host') !== 'console') notFound();
  return <div className="min-h-dvh bg-background">{children}</div>;
}
