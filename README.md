# ImpactOS

Multi-tenant operating system for Indian NGOs: programs and beneficiaries, field media, marketing, fundraising with
auto-emailed receipts, governance, compliance, HR and a self-service portal, in English and Hindi.

Build guide, phases and file manifest: the `impactos-mis` skill. Clickable UI prototype:
`assets/ui-prototype/impactos-ui.html` in that skill.

## What is built

| Phase                          | Status | What it adds                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Foundation                 | ✅     | Next.js 16 app, design tokens (light/dark), English/Hindi, app shell components, host routing, env validation, Sentry, CI, Supabase project with migration 0001, marketing site (home, pricing)                                                                                                    |
| 2 · Authentication and tenancy | ✅     | Sign-up with email code, organisation setup with subdomain check, email/Google/username login, invitations, multi-org switcher, TOTP two-step sign-in, account page, console sign-in, bilingual auth emails, migration 0002 with RLS                                                               |
| 3 · Access control and audit   | ✅     | Permissions, built-in and custom roles, positions, program/branch scopes, `action()` wrapper for every write, automatic activity log, Admin → Users (invite, username accounts with printable slips, roles, access, deactivate, HR password reset), Roles, Positions, Activity log, migration 0003 |
| 4 · Shared engine              | next   | Data tables, filters, import/export, custom fields and columns, files, jobs, PDFs, notifications, search                                                                                                                                                                                           |

## Requirements

- Node.js 22 (20.9 or later) and **npm 11** (`npm i -g npm@11.6.2`; npm 10 cannot resolve the dependency tree)
- Docker, for the local Supabase stack (`npm run db:start`)
- Optional for local background jobs: `npx inngest-cli@latest dev` (Inngest dev server at http://localhost:8288)

## Setup

```bash
npm ci
cp .env.example .env.local      # fill the App and Supabase blocks (local values come from `npm run db:start`)
npm run db:start                 # local Supabase: API :54321, Studio :54323, emails in Inbucket :54324
npm run db:reset                 # apply migrations + seed
npm run dev                      # site: http://localhost:3000 · workspace: http://app.localhost:3000
```

Supabase settings for staging and production (email hook, Google, MFA, password rules): `supabase/templates/README.md`.
To give yourself console access locally: `insert into public.platform_staff (user_id, role) values ('<your user id>', 'super_admin');`
Host routing in development: `localhost:3000` is the marketing site; `app.localhost:3000` and
`console.localhost:3000` are reserved for the workspace and console (phases 2 and 5); `NGONAME.localhost:3000` is
rewritten to `/o/NGONAME` (public pages, phase 9).

## Scripts

| Command                                     | Does                                                     |
| ------------------------------------------- | -------------------------------------------------------- |
| `npm run dev` / `build` / `start`           | Develop, build, serve                                    |
| `npm run typecheck` · `lint` · `test`       | TypeScript, ESLint (warns on hard-coded UI text), Vitest |
| `npm run i18n:check`                        | Every message key exists in English and Hindi            |
| `npm run test:e2e`                          | Playwright smoke tests (desktop and phone)               |
| `npm run db:start` · `db:reset` · `db:test` | Local Supabase, apply migrations + seed, pgTAP tests     |

## Building a list page (from phase 4)

1. Register the entity in `src/lib/fields/registry.ts` and in `private.entity_sources` (migration), and give its table
   `custom_fields jsonb` if admins may add fields.
2. Page: `parseListQuery(searchParams, …)` → query with filters/sort/paging → `resolveFields(org, entity, locale)`.
3. Client: `<FilterBar>` (options from `filter_facets`), `<DataTable>` (columns from resolved fields), `<SavedViews>`,
   `<ExportMenu>` (feature action using `buildExport`), `<ImportWizard>` (add an importer in `src/lib/import/commit.ts`).
4. Background work goes in `src/lib/jobs/functions` and is registered in `functions/index.ts`.

## Plans, limits and read-only mode (from phase 5)

- `action({ module: 'hr', … })` refuses actions whose module is not in the organisation's plan; every action is refused
  while the organisation is read-only, unless it sets `allowReadOnly: true` (exports, paying invoices).
- Check limits before adding: `checkLimit(orgId, 'staff_seats')` (src/lib/billing/limits.ts).
- Every org-scoped table gets a support read policy: `create policy <table>_support_select on public.<table> for select
to authenticated using (public.has_support_grant(organization_id));`
- Console writes use `consoleAction({ roles, schema, audit })` (src/lib/platform/support.ts).

## Writing a new feature (from phase 3)

- Every write: `export const doThing = action({ permission: 'module.entity.verb', schema }, async (input, ctx) => …)`
  in `features/<f>/actions.ts`. It checks sign-in, organisation, permission and input, then runs with RLS.
- Every protected page: `await requireUser(path)` and `await requirePermission('…')` in the page itself.
- New permissions go in the phase's migration (`insert into public.permissions …`) and in `src/lib/authz/permissions.ts`.
- New business tables get the audit trigger: `create trigger … after insert or update or delete … execute function public.audit_row_change();`

## Project rules (short)

1. A page enters `src/config/modules.ts` in the same phase as its route; the sidebar only shows built pages.
2. No hard-coded UI text: add keys to `src/messages/en|hi/<namespace>.json`; register namespaces in
   `src/lib/i18n/namespaces.ts`.
3. Database changes only through new numbered migrations in `supabase/migrations` (never edit an applied one).
4. Every business table has `organization_id` and row-level security (from phase 2).

## Deployment

Vercel project with `theimpactos.in`, `app.`, `console.` and `*.theimpactos.in` (wildcard needs Vercel nameservers).
Set `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN` and the Sentry variables for staging and production.
