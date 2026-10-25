# ADR 0001 · Stack and foundations

Status: accepted (phase 1)

## Decision
- **Fresh repository.** Nothing is copied from the earlier ImpactOS-MIS prototype.
- **Next.js 16** (App Router, `src/`, `proxy.ts` for host routing), **React 19**, **TypeScript 5.9 strict**
  (TypeScript 7 is deferred until Next.js supports it), **Tailwind CSS 4** with CSS-first tokens, shadcn-style
  components on **Radix UI**.
- **Supabase** (Postgres, Auth, RLS) in the Mumbai region; schema changes only through numbered migrations.
- **next-intl 4**, English and Hindi, locale from a cookie (no locale in URLs), one message file per namespace.
- **Sentry** for errors with `sendDefaultPii: false`; **Vercel** hosting; **npm 11** (npm 10 fails to resolve
  vitest's optional peer dependencies).
- Exact dependency versions, each at least 14 days old when added, to limit supply-chain risk.

## Consequences
- Every page follows the definition of done in the `impactos-mis` skill (`references/conventions.md`).
- UI tokens live in `src/app/globals.css` and match `references/ui-design.md` and the clickable prototype.
