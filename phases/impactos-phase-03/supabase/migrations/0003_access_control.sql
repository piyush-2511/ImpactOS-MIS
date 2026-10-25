-- Phase 3 · Access control and audit
-- Permissions, roles (system templates + org custom roles), member roles and scopes, positions, the audit trail,
-- helper functions used by every later RLS policy, and safe RPCs for managing people.
-- organization_members.base_role (phase 2) is kept and SYNCED from member_roles so the MFA rule and the
-- last-Secretary guard keep working. Append-only: never edit once applied.

-- ───────────────────────────── permissions ─────────────────────────────

create table public.permissions (
  key text primary key check (key ~ '^[a-z]+(\.[a-z_]+)+$'),
  module text not null,
  description text not null,
  sensitive boolean not null default false
);
comment on table public.permissions is 'Platform permission catalogue. Each phase inserts its permissions in its own migration.';

insert into public.permissions (key, module, description, sensitive) values
  ('admin.users.view',      'admin', 'See people, roles and invitations', false),
  ('admin.users.manage',    'admin', 'Invite people, create username accounts, change roles, scopes and status', false),
  ('admin.roles.view',      'admin', 'See roles and their permissions', false),
  ('admin.roles.manage',    'admin', 'Create and edit custom roles', false),
  ('admin.positions.view',  'admin', 'See positions and who holds them', false),
  ('admin.positions.manage','admin', 'Create positions and appoint holders', false),
  ('admin.audit.view',      'admin', 'Read the organisation activity log', false),
  ('org.profile.edit',      'organisation', 'Edit organisation details', false),
  ('pii.aadhaar.reveal',    'privacy', 'Reveal full Aadhaar numbers (logged)', true),
  ('pii.bank.reveal',       'privacy', 'Reveal full bank account numbers (logged)', true),
  ('pii.salary.view',       'privacy', 'See salaries (logged)', true),
  ('pii.medical.view',      'privacy', 'See medical, disability and caste details (logged)', true);

-- ───────────────────────────── roles ─────────────────────────────

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade, -- null = system template
  key text check (key is null or key ~ '^[a-z_]+$'),
  name text not null check (char_length(name) between 2 and 60),
  description text check (description is null or char_length(description) <= 300),
  default_scope text not null default 'assigned' check (default_scope in ('all', 'assigned', 'own')),
  requires_mfa boolean not null default false,
  grants_all boolean not null default false,
  is_system boolean not null default false,
  cloned_from uuid references public.roles (id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check ((is_system and organization_id is null and key is not null) or (not is_system and organization_id is not null and not grants_all))
);
create unique index roles_system_key on public.roles (key) where is_system;
create unique index roles_org_name on public.roles (organization_id, lower(name)) where not is_system;
comment on column public.roles.grants_all is 'Only the system Secretary role: every permission, including ones added by later phases.';

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.member_roles (
  member_id uuid not null references public.organization_members (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  granted_by uuid default auth.uid(),
  granted_at timestamptz not null default now(),
  primary key (member_id, role_id)
);
create index member_roles_org_idx on public.member_roles (organization_id);

-- Program / branch scope. The program and branch tables arrive in phases 6–7; ref_id gets no FK until then.
create table public.member_scopes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.organization_members (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scope_type text not null check (scope_type in ('program', 'branch')),
  ref_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (member_id, scope_type, ref_id)
);
create index member_scopes_lookup on public.member_scopes (organization_id, scope_type, ref_id);

-- System role templates (identical for every organisation; organisations clone them to customise).
insert into public.roles (key, name, description, default_scope, requires_mfa, grants_all, is_system) values
  ('secretary',         'Secretary / Owner',            'Everything, including billing, roles and governance. Standing backup approver.', 'all', true, true, true),
  ('admin',             'Admin',                        'Everything except billing and closing the organisation.', 'all', true, false, true),
  ('program_manager',   'Program Manager',              'Runs programs; raises and approves requests.', 'assigned', false, false, true),
  ('field_coordinator', 'Field Coordinator',            'Registers beneficiaries, records services and activities, uploads field media.', 'assigned', false, false, true),
  ('fundraising_head',  'Fundraising / Marketing Head', 'Fundraising, marketing, donor communication and post approvals.', 'all', false, false, true),
  ('finance',           'Finance / Accountant',         'Receipts, payments on approved requests, claims payout, registers.', 'all', true, false, true),
  ('hr_manager',        'HR Manager',                   'People, induction, attendance, leave and payroll preparation.', 'all', false, false, true),
  ('viewer',            'Board member / Viewer',        'Read-only dashboards and reports.', 'all', false, false, true),
  ('self_service',      'Self-service',                 'Own attendance, leave, claims, tasks, documents and payslips.', 'own', false, false, true);

-- Admin gets every admin/org permission and the privacy reveals; HR gets salary; viewers can read the audit log.
insert into public.role_permissions (role_id, permission_key)
  select r.id, p.key from public.roles r cross join public.permissions p
   where r.is_system and r.key = 'admin';
insert into public.role_permissions (role_id, permission_key)
  select r.id, k from public.roles r, unnest(array['admin.users.view', 'admin.positions.view', 'pii.salary.view', 'pii.bank.reveal']) k
   where r.is_system and r.key = 'hr_manager';
insert into public.role_permissions (role_id, permission_key)
  select r.id, k from public.roles r, unnest(array['pii.bank.reveal']) k
   where r.is_system and r.key = 'finance';
insert into public.role_permissions (role_id, permission_key)
  select r.id, k from public.roles r, unnest(array['admin.users.view', 'admin.roles.view', 'admin.positions.view']) k
   where r.is_system and r.key in ('program_manager', 'viewer');

-- ───────────────────────────── positions ─────────────────────────────

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text check (description is null or char_length(description) <= 300),
  default_role_id uuid references public.roles (id) on delete set null,
  is_committee boolean not null default false,
  is_secretary boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (organization_id, name)
);
create unique index positions_one_secretary on public.positions (organization_id) where is_secretary;
comment on table public.positions is 'Posts in the organisation (Executive Director, Finance Manager, Procurement Committee…). Approvals route to positions (phase 6).';

create table public.position_holders (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.positions (id) on delete cascade,
  member_id uuid not null references public.organization_members (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  from_date date not null default current_date,
  to_date date,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (to_date is null or to_date >= from_date)
);
create unique index position_holders_current on public.position_holders (position_id, member_id) where to_date is null;

-- ───────────────────────────── audit trail ─────────────────────────────

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid,
  actor_kind text not null default 'user' check (actor_kind in ('user', 'platform', 'system')),
  action text not null,
  table_name text,
  row_id text,
  before jsonb,
  after jsonb,
  changed text[],
  note text,
  created_at timestamptz not null default now()
);
create index audit_events_org_time on public.audit_events (organization_id, created_at desc);
create index audit_events_actor on public.audit_events (organization_id, actor_id, created_at desc);
create index audit_events_row on public.audit_events (table_name, row_id);
comment on table public.audit_events is 'Append-only activity log. Written by audit_row_change() and record_audit(); never updated or deleted by users.';

-- Generic row trigger for business tables. Stores before/after and the list of changed columns; skips no-op updates.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_j jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_j jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  cols text[];
  org uuid;
  rid text;
  ignore text[] := array['updated_at', 'updated_by'];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into cols
      from jsonb_object_keys(new_j) k
     where k <> all (ignore) and (old_j -> k) is distinct from (new_j -> k);
    if cols is null then return new; end if;
  end if;
  org := coalesce((new_j ->> 'organization_id'), (old_j ->> 'organization_id'),
                  case when tg_table_name = 'organizations' then coalesce(new_j ->> 'id', old_j ->> 'id') end)::uuid;
  rid := coalesce(new_j ->> 'id', old_j ->> 'id', new_j ->> 'member_id', old_j ->> 'member_id');
  insert into public.audit_events (organization_id, actor_id, actor_kind, action, table_name, row_id, before, after, changed)
  values (org, (select auth.uid()),
          case when (select auth.uid()) is null then 'system' when public.is_platform_staff() then 'platform' else 'user' end,
          lower(tg_op), tg_table_name, rid,
          case when tg_op = 'INSERT' then null else old_j - ignore end,
          case when tg_op = 'DELETE' then null else new_j - ignore end,
          cols);
  return coalesce(new, old);
end;
$$;

-- ───────────────────────────── helpers ─────────────────────────────

create or replace function private.current_member_id(org uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.organization_members m
   where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create or replace function public.has_permission(org uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.organization_members m
      join public.member_roles mr on mr.member_id = m.id
      join public.roles r on r.id = mr.role_id
     where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active'
       and (r.grants_all or exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission_key = perm))
  );
$$;

-- All permission keys the current user holds in an organisation ('*' when a role grants everything).
create or replace function public.my_permissions(org uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when bool_or(r.grants_all) then array['*']
    else coalesce(array_agg(distinct rp.permission_key) filter (where rp.permission_key is not null), '{}')
  end
    from public.organization_members m
    join public.member_roles mr on mr.member_id = m.id
    join public.roles r on r.id = mr.role_id
    left join public.role_permissions rp on rp.role_id = r.id
   where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

-- True when the current user may see a row tagged with this program/branch: any role with scope 'all', or a match.
create or replace function public.in_scope(org uuid, p_program uuid default null, p_branch uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.organization_members m
        join public.member_roles mr on mr.member_id = m.id
        join public.roles r on r.id = mr.role_id
       where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active' and r.default_scope = 'all')
    or exists (
      select 1 from public.member_scopes s
        join public.organization_members m on m.id = s.member_id
       where s.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active'
         and ((s.scope_type = 'program' and s.ref_id = p_program) or (s.scope_type = 'branch' and s.ref_id = p_branch)));
$$;

create or replace function private.holds_role(org uuid, role_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
      join public.member_roles mr on mr.member_id = m.id
      join public.roles r on r.id = mr.role_id
     where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active' and r.is_system and r.key = role_key);
$$;

-- Keeps organization_members.base_role in step with member_roles (MFA rule and last-Secretary guard read it).
create or replace function private.sync_base_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mid uuid := coalesce(new.member_id, old.member_id);
  keys text[];
  next_role text;
begin
  select coalesce(array_agg(r.key), '{}') into keys
    from public.member_roles mr join public.roles r on r.id = mr.role_id where mr.member_id = mid and r.is_system;
  next_role := case
    when 'secretary' = any (keys) then 'secretary'
    when 'admin' = any (keys) then 'admin'
    when 'finance' = any (keys) then 'finance'
    when keys = array['self_service'] then 'self_service'
    else 'member' end;
  -- Custom roles that require MFA count as 'admin' for the MFA rule.
  if next_role = 'member' and exists (select 1 from public.member_roles mr join public.roles r on r.id = mr.role_id
                                       where mr.member_id = mid and not r.is_system and r.requires_mfa) then
    next_role := 'finance';
  end if;
  update public.organization_members set base_role = next_role where id = mid and base_role is distinct from next_role;
  return coalesce(new, old);
end;
$$;

-- Privilege escalation guard: only a Secretary may grant or remove the Secretary role; roles must belong to the org.
create or replace function private.guard_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.roles%rowtype;
  rec public.member_roles%rowtype := coalesce(new, old);
begin
  select * into r from public.roles where id = rec.role_id;
  if r.organization_id is not null and r.organization_id <> rec.organization_id then
    raise exception 'Role belongs to another organisation' using errcode = '42501';
  end if;
  if (r.grants_all or r.key = 'secretary') and (select auth.uid()) is not null
     and not private.holds_role(rec.organization_id, 'secretary') then
    raise exception 'Only a Secretary can grant or remove the Secretary role' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (select m.organization_id from public.organization_members m where m.id = new.member_id) <> new.organization_id then
    raise exception 'Member and role assignment organisations differ' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger member_roles_guard before insert or delete on public.member_roles
  for each row execute function private.guard_member_role();
create trigger member_roles_sync after insert or delete on public.member_roles
  for each row execute function private.sync_base_role();

-- Backfill: phase 2 memberships get the matching system role.
insert into public.member_roles (member_id, role_id, organization_id, granted_by)
  select m.id, r.id, m.organization_id, m.created_by
    from public.organization_members m
    join public.roles r on r.is_system and r.key = case m.base_role when 'member' then 'viewer' else m.base_role end
  on conflict do nothing;

-- Secretary position for every existing organisation, held by its current Secretaries.
insert into public.positions (organization_id, name, default_role_id, is_secretary)
  select o.id, 'Secretary', (select id from public.roles where is_system and key = 'secretary'), true from public.organizations o
  on conflict do nothing;
insert into public.position_holders (position_id, member_id, organization_id)
  select p.id, m.id, m.organization_id
    from public.positions p join public.organization_members m on m.organization_id = p.organization_id
   where p.is_secretary and m.base_role = 'secretary' and m.status = 'active';

-- Invitations now carry a role id (system or custom) as well as the phase 2 role_key.
alter table public.invitations add column role_id uuid references public.roles (id) on delete set null;

-- Revoke every refresh token of a user (deactivation, HR password reset, role downgrade). Service role only.
create or replace function private.revoke_user_sessions(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.sessions where user_id = uid;
$$;
create or replace function public.revoke_user_sessions(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$ select private.revoke_user_sessions(uid); $$;

-- ───────────────────────────── RPCs for managing people ─────────────────────────────

-- Replace a member's roles in one step (at least one role). Requires admin.users.manage.
create or replace function public.set_member_roles(p_member uuid, p_roles uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organization_id into org from public.organization_members where id = p_member;
  if org is null or not public.has_permission(org, 'admin.users.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(p_roles, 1), 0) = 0 then
    raise exception 'A member needs at least one role' using errcode = '22023';
  end if;
  -- Insert first so the last-Secretary guard never sees a moment without one.
  insert into public.member_roles (member_id, role_id, organization_id)
    select p_member, rid, org from unnest(p_roles) rid
     where rid not in (select role_id from public.member_roles where member_id = p_member);
  delete from public.member_roles where member_id = p_member and role_id <> all (p_roles);
end;
$$;

-- Replace a member's program/branch scope. Requires admin.users.manage.
create or replace function public.set_member_scopes(p_member uuid, p_programs uuid[], p_branches uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organization_id into org from public.organization_members where id = p_member;
  if org is null or not public.has_permission(org, 'admin.users.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.member_scopes where member_id = p_member;
  insert into public.member_scopes (member_id, organization_id, scope_type, ref_id)
    select p_member, org, 'program', unnest(coalesce(p_programs, '{}'))
    union all
    select p_member, org, 'branch', unnest(coalesce(p_branches, '{}'));
end;
$$;

-- Deactivate / reactivate a member. Never deletes (records keep their author). Revokes sessions on deactivation.
create or replace function public.set_member_status(p_member uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.organization_members%rowtype;
begin
  select * into m from public.organization_members where id = p_member;
  if m.id is null or not public.has_permission(m.organization_id, 'admin.users.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if m.user_id = (select auth.uid()) then
    raise exception 'You cannot change your own status' using errcode = '42501';
  end if;
  if p_status not in ('active', 'deactivated') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  update public.organization_members
     set status = p_status, deactivated_at = case when p_status = 'deactivated' then now() end
   where id = p_member;
  if p_status = 'deactivated' then
    update public.position_holders set to_date = current_date where member_id = p_member and to_date is null;
    perform private.revoke_user_sessions(m.user_id);
  end if;
end;
$$;

-- Application-level audit entries (e.g. "username password reset", "invitation sent", "bank number revealed").
create or replace function public.record_audit(p_org uuid, p_action text, p_table text default null, p_row text default null, p_note text default null, p_after jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_org) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_action !~ '^[a-z_]+(\.[a-z_]+)+$' then
    raise exception 'Bad audit action' using errcode = '22023';
  end if;
  insert into public.audit_events (organization_id, actor_id, action, table_name, row_id, note, after)
  values (p_org, (select auth.uid()), p_action, p_table, p_row, left(p_note, 500), p_after);
end;
$$;

-- Logged reveal of a sensitive field: checks the pii.* permission and writes the audit entry in one step.
create or replace function public.log_reveal(p_org uuid, p_permission text, p_table text, p_row text, p_field text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_permission not like 'pii.%' or not public.has_permission(p_org, p_permission) then
    return false;
  end if;
  insert into public.audit_events (organization_id, actor_id, action, table_name, row_id, note)
  values (p_org, (select auth.uid()), 'reveal.' || split_part(p_permission, '.', 2), p_table, p_row, p_field);
  return true;
end;
$$;

-- ───────────────────────────── phase 2 RPCs, now role-aware ─────────────────────────────

create or replace function public.create_organization(
  p_name text, p_slug text, p_legal_form text, p_state text,
  p_district text default null, p_pan text default null, p_fcra boolean default false, p_locale text default 'en'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
  member uuid;
  sec_role uuid := (select id from public.roles where is_system and key = 'secretary');
  pos uuid;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users u where u.id = uid and u.email_confirmed_at is not null) then
    raise exception 'Verify your email before creating an organisation' using errcode = '42501';
  end if;
  if exists (select 1 from public.username_accounts ua where ua.user_id = uid) then
    raise exception 'Username accounts cannot create organisations' using errcode = '42501';
  end if;
  if (select count(*) from public.organizations o where o.created_by = uid) >= 3 then
    raise exception 'Organisation limit reached for this account; contact ImpactOS support' using errcode = 'P0001';
  end if;
  if not public.slug_available(lower(p_slug)) then
    raise exception 'This address is not available' using errcode = '23505';
  end if;

  insert into public.organizations (name, slug, legal_form, state, district, pan, fcra_registered, locale, created_by)
  values (trim(p_name), lower(p_slug), p_legal_form, trim(p_state), nullif(trim(p_district), ''),
          nullif(upper(trim(p_pan)), ''), coalesce(p_fcra, false), coalesce(p_locale, 'en'), uid)
  returning id into new_id;

  insert into public.organization_members (organization_id, user_id, kind, base_role, created_by)
  values (new_id, uid, 'email', 'secretary', uid) returning id into member;
  -- The creator becomes Secretary; the guard allows this one insert while the bootstrap flag is on.
  perform set_config('impactos.bootstrap', 'on', true);
  insert into public.member_roles (member_id, role_id, organization_id, granted_by) values (member, sec_role, new_id, uid);
  perform set_config('impactos.bootstrap', 'off', true);
  insert into public.positions (organization_id, name, default_role_id, is_secretary) values (new_id, 'Secretary', sec_role, true) returning id into pos;
  insert into public.position_holders (position_id, member_id, organization_id) values (pos, member, new_id);

  update public.profiles set last_org_id = new_id where id = uid;
  insert into public.auth_events (user_id, organization_id, event) values (uid, new_id, 'org_created');
  return new_id;
end;
$$;

create or replace function public.accept_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  user_email text;
  inv public.invitations%rowtype;
  member uuid;
  rid uuid;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select u.email into user_email from auth.users u where u.id = uid;
  select * into inv from public.invitations i where i.token_hash = p_token_hash for update;
  if not found or inv.revoked_at is not null then
    raise exception 'This invitation is not valid' using errcode = 'P0002';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invitation has already been used' using errcode = 'P0001';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation has expired; ask for a new one' using errcode = 'P0001';
  end if;
  if lower(user_email) <> lower(inv.email::text) then
    raise exception 'Sign in with the email address the invitation was sent to' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, kind, base_role, created_by)
  values (inv.organization_id, uid, 'email', 'member', inv.invited_by)
  on conflict (organization_id, user_id) do update set status = 'active', deactivated_at = null
  returning id into member;

  rid := coalesce(inv.role_id, (select id from public.roles where is_system and key = case inv.role_key when 'member' then 'viewer' else inv.role_key end));
  perform set_config('impactos.bootstrap', 'on', true);
  insert into public.member_roles (member_id, role_id, organization_id, granted_by)
  values (member, rid, inv.organization_id, inv.invited_by) on conflict do nothing;
  perform set_config('impactos.bootstrap', 'off', true);
  if inv.scope ? 'programs' or inv.scope ? 'branches' then
    insert into public.member_scopes (member_id, organization_id, scope_type, ref_id, created_by)
      select member, inv.organization_id, 'program', (jsonb_array_elements_text(coalesce(inv.scope -> 'programs', '[]')))::uuid, inv.invited_by
      union all
      select member, inv.organization_id, 'branch', (jsonb_array_elements_text(coalesce(inv.scope -> 'branches', '[]')))::uuid, inv.invited_by
    on conflict do nothing;
  end if;

  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.profiles set last_org_id = inv.organization_id where id = uid;
  insert into public.auth_events (user_id, organization_id, event) values (uid, inv.organization_id, 'invite_accepted');
  return inv.organization_id;
end;
$$;

-- The Secretary guard trusts the two RPCs above while they bootstrap a membership.
create or replace function private.guard_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.roles%rowtype;
  rec public.member_roles%rowtype := coalesce(new, old);
begin
  select * into r from public.roles where id = rec.role_id;
  if r.organization_id is not null and r.organization_id <> rec.organization_id then
    raise exception 'Role belongs to another organisation' using errcode = '42501';
  end if;
  if (r.grants_all or r.key = 'secretary') and (select auth.uid()) is not null
     and coalesce(current_setting('impactos.bootstrap', true), '') <> 'on'
     and not private.holds_role(rec.organization_id, 'secretary') then
    raise exception 'Only a Secretary can grant or remove the Secretary role' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (select m.organization_id from public.organization_members m where m.id = new.member_id) <> new.organization_id then
    raise exception 'Member and role assignment organisations differ' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

-- ───────────────────────────── triggers ─────────────────────────────

create trigger roles_touch before update on public.roles for each row execute function public.touch_updated();
create trigger positions_touch before update on public.positions for each row execute function public.touch_updated();

-- System roles never change through the API.
create or replace function private.guard_system_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' and old.is_system) or (tg_op = 'UPDATE' and (old.is_system or new.is_system)) then
    raise exception 'System roles cannot be changed; clone one instead' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger roles_system_guard before update or delete on public.roles for each row execute function private.guard_system_role();

create or replace function private.guard_system_role_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select is_system from public.roles where id = coalesce(new.role_id, old.role_id)) and current_user <> 'postgres' then
    raise exception 'System role permissions are fixed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger role_permissions_system_guard before insert or delete on public.role_permissions
  for each row execute function private.guard_system_role_permissions();

-- Audit every table so far that holds organisation data.
create trigger organizations_audit after insert or update or delete on public.organizations for each row execute function public.audit_row_change();
create trigger organization_members_audit after insert or update or delete on public.organization_members for each row execute function public.audit_row_change();
create trigger invitations_audit after insert or update or delete on public.invitations for each row execute function public.audit_row_change();
create trigger username_accounts_audit after insert or update or delete on public.username_accounts for each row execute function public.audit_row_change();
create trigger roles_audit after insert or update or delete on public.roles for each row execute function public.audit_row_change();
create trigger role_permissions_audit after insert or delete on public.role_permissions for each row execute function public.audit_row_change();
create trigger member_roles_audit after insert or delete on public.member_roles for each row execute function public.audit_row_change();
create trigger member_scopes_audit after insert or delete on public.member_scopes for each row execute function public.audit_row_change();
create trigger positions_audit after insert or update or delete on public.positions for each row execute function public.audit_row_change();
create trigger position_holders_audit after insert or update or delete on public.position_holders for each row execute function public.audit_row_change();

-- Email on profiles (for member lists), kept in sync with auth.users. Synthetic username emails are stored too;
-- the app shows the username instead for those accounts.
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, locale)
  values (new.id, new.email, nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
          case when new.raw_user_meta_data ->> 'locale' = 'hi' then 'hi' else 'en' end)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger on_auth_user_created on auth.users;
-- Lets the API embed a member's profile (name, email) in member lists.
alter table public.organization_members
  add constraint organization_members_profile_fkey foreign key (user_id) references public.profiles (id) on delete cascade;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.sync_profile_email();
create trigger on_auth_user_email_changed after update of email on auth.users for each row execute function private.sync_profile_email();

-- ───────────────────────────── row-level security ─────────────────────────────

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.member_scopes enable row level security;
alter table public.positions enable row level security;
alter table public.position_holders enable row level security;
alter table public.audit_events enable row level security;

create policy permissions_select on public.permissions for select to authenticated using (true);

create policy roles_select on public.roles for select to authenticated
  using (is_system or public.is_member(organization_id) or public.is_platform_staff());
create policy roles_insert on public.roles for insert to authenticated
  with check (not is_system and public.has_permission(organization_id, 'admin.roles.manage'));
create policy roles_update on public.roles for update to authenticated
  using (not is_system and public.has_permission(organization_id, 'admin.roles.manage'))
  with check (not is_system and public.has_permission(organization_id, 'admin.roles.manage'));
create policy roles_delete on public.roles for delete to authenticated
  using (not is_system and public.has_permission(organization_id, 'admin.roles.manage'));

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id and (r.is_system or public.is_member(r.organization_id))));
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check (exists (select 1 from public.roles r where r.id = role_id and not r.is_system and public.has_permission(r.organization_id, 'admin.roles.manage')));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using (exists (select 1 from public.roles r where r.id = role_id and not r.is_system and public.has_permission(r.organization_id, 'admin.roles.manage')));

-- member_roles / member_scopes: readable inside the organisation; changed only through set_member_roles/scopes.
create policy member_roles_select on public.member_roles for select to authenticated using (public.is_member(organization_id));
create policy member_scopes_select on public.member_scopes for select to authenticated using (public.is_member(organization_id));

create policy positions_select on public.positions for select to authenticated using (public.is_member(organization_id));
create policy positions_insert on public.positions for insert to authenticated
  with check (public.has_permission(organization_id, 'admin.positions.manage') and not is_secretary);
create policy positions_update on public.positions for update to authenticated
  using (public.has_permission(organization_id, 'admin.positions.manage'))
  with check (public.has_permission(organization_id, 'admin.positions.manage'));
create policy positions_delete on public.positions for delete to authenticated
  using (public.has_permission(organization_id, 'admin.positions.manage') and not is_secretary);

create policy position_holders_select on public.position_holders for select to authenticated using (public.is_member(organization_id));
create policy position_holders_insert on public.position_holders for insert to authenticated
  with check (public.has_permission(organization_id, 'admin.positions.manage')
              and exists (select 1 from public.organization_members m where m.id = member_id and m.organization_id = position_holders.organization_id and m.status = 'active'));
create policy position_holders_update on public.position_holders for update to authenticated
  using (public.has_permission(organization_id, 'admin.positions.manage'))
  with check (public.has_permission(organization_id, 'admin.positions.manage'));

create policy audit_events_select on public.audit_events for select to authenticated
  using (public.has_permission(organization_id, 'admin.audit.view'));

-- Invitations and organisation edits now follow permissions instead of the interim base_role.
drop policy invitations_select on public.invitations;
drop policy invitations_insert on public.invitations;
drop policy invitations_update on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
  using (public.has_permission(organization_id, 'admin.users.view'));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.has_permission(organization_id, 'admin.users.manage') and invited_by = (select auth.uid())
              and (role_id is null or exists (select 1 from public.roles r where r.id = role_id and (r.is_system or r.organization_id = invitations.organization_id))
                   and (role_id is null or not exists (select 1 from public.roles r where r.id = role_id and (r.grants_all or r.key = 'secretary')))));
create policy invitations_update on public.invitations for update to authenticated
  using (public.has_permission(organization_id, 'admin.users.manage'))
  with check (public.has_permission(organization_id, 'admin.users.manage'));

drop policy organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_permission(id, 'org.profile.edit')) with check (public.has_permission(id, 'org.profile.edit'));

drop policy username_accounts_select on public.username_accounts;
create policy username_accounts_select on public.username_accounts for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission(organization_id, 'admin.users.view'));

-- ───────────────────────────── privileges ─────────────────────────────

revoke all on public.permissions, public.roles, public.role_permissions, public.member_roles, public.member_scopes,
  public.positions, public.position_holders, public.audit_events from anon;
revoke insert, update, delete on public.member_roles, public.member_scopes, public.audit_events, public.permissions from authenticated;
grant update (role_id) on public.invitations to authenticated;

revoke execute on function public.has_permission(uuid, text), public.my_permissions(uuid), public.in_scope(uuid, uuid, uuid),
  public.set_member_roles(uuid, uuid[]), public.set_member_scopes(uuid, uuid[], uuid[]), public.set_member_status(uuid, text),
  public.record_audit(uuid, text, text, text, text, jsonb), public.log_reveal(uuid, text, text, text, text),
  public.revoke_user_sessions(uuid), public.audit_row_change() from public, anon;
grant execute on function public.has_permission(uuid, text), public.my_permissions(uuid), public.in_scope(uuid, uuid, uuid),
  public.set_member_roles(uuid, uuid[]), public.set_member_scopes(uuid, uuid[], uuid[]), public.set_member_status(uuid, text),
  public.record_audit(uuid, text, text, text, text, jsonb), public.log_reveal(uuid, text, text, text, text) to authenticated;
revoke execute on function public.revoke_user_sessions(uuid) from authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
