import { LanguageSwitch } from '@/components/shell/LanguageSwitch';

/** Sign-in screens: one centred card with the ImpactOS header and the language switch (matches the UI prototype). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 bg-navy px-6 py-4 text-white">
          <span className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-green font-bold text-navy" aria-hidden>
              i
            </span>
            <span className="text-lg font-bold">ImpactOS</span>
          </span>
          <LanguageSwitch tone="dark" />
        </div>
        <main id="main" className="flex flex-col gap-5 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
