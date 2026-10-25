# Phase 3 - Access control and audit

Permissions, roles, positions, scopes, the action() wrapper and the audit trail.

Migration: 0003_access_control

## New
- src/app/(app)/admin/activity-logs/page.tsx
- src/app/(app)/admin/positions/page.tsx
- src/app/(app)/admin/roles/[id]/page.tsx
- src/app/(app)/admin/roles/page.tsx
- src/app/(app)/admin/users/page.tsx
- src/features/activity-logs/components/AuditTable.tsx
- src/features/activity-logs/components/DiffView.tsx
- src/features/activity-logs/queries.ts
- src/features/admin-users/actions.ts
- src/features/admin-users/components/InviteDialog.tsx
- src/features/admin-users/components/MembersTable.tsx
- src/features/admin-users/components/PrintableSlip.tsx
- src/features/admin-users/components/ResetPasswordDialog.tsx
- src/features/admin-users/components/RoleAssign.tsx
- src/features/admin-users/components/ScopeEditor.tsx
- src/features/admin-users/components/UsernameAccountDialog.tsx
- src/features/admin-users/queries.ts
- src/features/admin-users/schema.ts
- src/features/positions/actions.ts
- src/features/positions/components/PositionForm.tsx
- src/features/positions/components/PositionsList.tsx
- src/features/positions/queries.ts
- src/features/positions/schema.ts
- src/features/roles/actions.ts
- src/features/roles/components/RoleEditor.tsx
- src/features/roles/components/RolesList.tsx
- src/features/roles/queries.ts
- src/features/roles/schema.ts
- src/hooks/useCan.ts
- src/lib/actions/action.ts
- src/lib/actions/audit.ts
- src/lib/actions/errors.ts
- src/lib/actions/result.ts
- src/lib/authz/can.ts
- src/lib/authz/permissions.ts
- src/lib/authz/reveal.ts
- src/lib/authz/scope.ts
- src/messages/en/admin.json
- src/messages/hi/admin.json
- supabase/migrations/0003_access_control.sql
- supabase/tests/0003_access_control.test.sql
- tests/e2e/access.spec.ts
- tests/unit/can.test.ts

## Modified (full replacement)
- README.md
- src/app/(app)/layout.tsx
- src/components/shell/Sidebar.tsx
- src/config/features.ts
- src/config/modules.ts
- src/lib/i18n/namespaces.ts
- src/lib/supabase/database.types.ts
- src/messages/en/common.json
- src/messages/hi/common.json
