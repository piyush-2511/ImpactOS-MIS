-- Phase 2 · Authentication and tenancy
-- Organisations, profiles, memberships, username accounts, invitations, platform staff and auth events.
-- Roles, positions and scopes arrive in phase 3 (0003_access_control); until then a membership carries a
-- base_role used for the last-Secretary guard and the MFA requirement. Append-only: never edit once applied.

-- ───────────────────────────── tables ─────────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug extensions.citext not null unique
    check (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  legal_form text not null check (legal_form in ('trust', 'society', 'section8', 'other')),
  state text not null check (char_length(state) between 2 and 60),
  district text check (district is null or char_length(district) <= 60),
  pan text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  fcra_registered boolean not null default false,
  locale text not null default 'en' check (locale in ('en', 'hi')),
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
comment on table public.organizations is 'One row per NGO (tenant). Created only through create_organization().';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  locale text not null default 'en' check (locale in ('en', 'hi')),
  must_change_password boolean not null default false,
  last_org_id uuid references public.organizations (id) on delete set null,
  avatar_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'email' check (kind in ('email', 'username')),
  base_role text not null default 'member'
    check (base_role in ('secretary', 'admin', 'finance', 'member', 'self_service')),
  status text not null default 'active' check (status in ('active', 'deactivated')),
  joined_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id) where status = 'active';
comment on column public.organization_members.base_role is 'Interim role until phase 3 roles; secretary/admin/finance require MFA.';

create table public.username_accounts (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  username extensions.citext not null check (username ~ '^[a-z0-9](?:[a-z0-9]|\.(?!\.)){1,28}[a-z0-9]$'),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (organization_id, username)
);
comment on table public.username_accounts is 'Field workers without email: org code + username map to a synthetic, non-routable auth email.';

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role_key text not null default 'member' check (role_key in ('admin', 'finance', 'member', 'self_service')),
  scope jsonb not null default '{}'::jsonb,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  locale text not null default 'en' check (locale in ('en', 'hi')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  invited_by uuid not null default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (organization_id) where accepted_at is null and revoked_at is null;

create table public.platform_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'support', 'billing', 'readonly')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.platform_staff is 'ImpactOS team allowlist for console.theimpactos.in. Managed by the platform team only.';

create table public.auth_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  event text not null check (event in (
    'sign_up', 'sign_in', 'sign_in_failed', 'sign_out', 'password_changed', 'password_reset_requested',
    'mfa_enrolled', 'mfa_verified', 'org_created', 'org_switched', 'invite_accepted', 'username_login', 'console_sign_in')),
  ip inet,
  user_agent text,
  device_hash text,
  created_at timestamptz not null default now()
);
create index auth_events_user_idx on public.auth_events (user_id, created_at desc);

-- ───────────────────────────── triggers ─────────────────────────────

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated();
create trigger organization_members_touch before update on public.organization_members
  for each row execute function public.touch_updated();

-- A profile for every new auth user (name and language from sign-up metadata).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 120), ''),
    case when new.raw_user_meta_data ->> 'locale' = 'hi' then 'hi' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Slugs are permanent (subdomains, links, printed QR codes). Only platform staff may change one.
create or replace function private.guard_slug_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug and not public.is_platform_staff() then
    raise exception 'Organisation address (slug) cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- An organisation must always keep at least one active Secretary.
create or replace function private.guard_last_secretary()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  remaining int;
begin
  if old.base_role = 'secretary' and old.status = 'active'
     and (tg_op = 'DELETE' or new.status <> 'active' or new.base_role <> 'secretary') then
    select count(*) into remaining
      from public.organization_members m
     where m.organization_id = old.organization_id
       and m.base_role = 'secretary' and m.status = 'active' and m.id <> old.id;
    if remaining = 0 then
      raise exception 'An organisation must keep at least one active Secretary' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger organization_members_last_secretary
  before update or delete on public.organization_members
  for each row execute function private.guard_last_secretary();

-- ───────────────────────────── helper functions ─────────────────────────────
-- security definer + empty search_path so policies can call them without recursion or path injection.

create or replace function public.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
     where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active'
  );
$$;

create or replace function public.member_role(org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.base_role from public.organization_members m
   where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_staff s where s.user_id = (select auth.uid()) and s.active);
$$;

create or replace function public.current_user_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id from public.organization_members m
   where m.user_id = (select auth.uid()) and m.status = 'active';
$$;

create or replace function public.shares_org_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members a
      join public.organization_members b on b.organization_id = a.organization_id
     where a.user_id = (select auth.uid()) and a.status = 'active'
       and b.user_id = other and b.status = 'active'
  );
$$;

-- Reserved subdomains mirror src/config/hosts.ts.
create or replace function public.slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
     and p_slug <> all (array['www','app','api','console','admin','mail','staging','status','help','docs','blog','donate'])
     and not exists (select 1 from public.organizations o where o.slug = p_slug::extensions.citext);
$$;

-- ───────────────────────────── RPCs ─────────────────────────────

-- Creates an organisation with the caller as its first Secretary, in one transaction.
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
  values (new_id, uid, 'email', 'secretary', uid);

  update public.profiles set last_org_id = new_id where id = uid;
  insert into public.auth_events (user_id, organization_id, event) values (uid, new_id, 'org_created');
  -- Phase 3 adds the Secretary position; phase 4 seeds default option lists; phase 5 starts the trial subscription.
  return new_id;
end;
$$;

-- Shows an invitation before sign-in. The 64-hex hash is only known to whoever holds the emailed token.
create or replace function public.get_invitation(p_token_hash text)
returns table (organization_name text, email text, expires_at timestamptz, state text, locale text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.email::text, i.expires_at,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'accepted'
              when i.expires_at < now() then 'expired'
              else 'open' end,
         i.locale
    from public.invitations i
    join public.organizations o on o.id = i.organization_id
   where i.token_hash = p_token_hash and o.status = 'active';
$$;

-- Accepts an invitation for the signed-in user. The user's email must match the invitation.
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
  values (inv.organization_id, uid, 'email', inv.role_key, inv.invited_by)
  on conflict (organization_id, user_id)
    do update set status = 'active', deactivated_at = null, base_role = excluded.base_role;

  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;
  update public.profiles set last_org_id = inv.organization_id where id = uid;
  insert into public.auth_events (user_id, organization_id, event) values (uid, inv.organization_id, 'invite_accepted');
  return inv.organization_id;
end;
$$;

-- ───────────────────────────── row-level security ─────────────────────────────

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.username_accounts enable row level security;
alter table public.invitations enable row level security;
alter table public.platform_staff enable row level security;
alter table public.auth_events enable row level security;

-- organizations: members (and platform staff) read; Secretary/Admin edit; inserts only via create_organization().
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_member(id) or public.is_platform_staff());
create policy organizations_update on public.organizations for update to authenticated
  using (public.member_role(id) in ('secretary', 'admin'))
  with check (public.member_role(id) in ('secretary', 'admin'));
create trigger organizations_slug_guard before update on public.organizations
  for each row execute function private.guard_slug_change();

-- profiles: your own, plus colleagues in a shared organisation (names in member lists).
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and (last_org_id is null or public.is_member(last_org_id)));

-- organization_members: see your own memberships and your organisations' members. Changes come in phase 3.
create policy organization_members_select on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_member(organization_id));

-- username_accounts: Secretary/Admin of that organisation, and the account holder.
create policy username_accounts_select on public.username_accounts for select to authenticated
  using (user_id = (select auth.uid()) or public.member_role(organization_id) in ('secretary', 'admin'));

-- invitations: Secretary/Admin create, list and revoke.
create policy invitations_select on public.invitations for select to authenticated
  using (public.member_role(organization_id) in ('secretary', 'admin'));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.member_role(organization_id) in ('secretary', 'admin') and invited_by = (select auth.uid()));
create policy invitations_update on public.invitations for update to authenticated
  using (public.member_role(organization_id) in ('secretary', 'admin'))
  with check (public.member_role(organization_id) in ('secretary', 'admin'));

-- platform_staff: only your own row is visible.
create policy platform_staff_select on public.platform_staff for select to authenticated
  using (user_id = (select auth.uid()));

-- auth_events: your own sign-in history. Written by the server (service role) and the RPCs above.
create policy auth_events_select on public.auth_events for select to authenticated
  using (user_id = (select auth.uid()));

-- ───────────────────────────── privileges ─────────────────────────────

revoke all on public.organizations, public.profiles, public.organization_members, public.username_accounts,
  public.invitations, public.platform_staff, public.auth_events from anon;

-- Users may edit only these profile columns; must_change_password is cleared by the server after a password change.
revoke update on public.profiles from authenticated;
grant update (full_name, locale, last_org_id, avatar_key) on public.profiles to authenticated;

-- Organisation slug, status and creator are not user-editable.
revoke update on public.organizations from authenticated;
grant update (name, legal_form, state, district, pan, fcra_registered, locale) on public.organizations to authenticated;

revoke insert, update, delete on public.organization_members, public.username_accounts, public.platform_staff,
  public.auth_events from authenticated;

revoke execute on function public.create_organization(text, text, text, text, text, text, boolean, text),
  public.accept_invitation(text), public.get_invitation(text), public.slug_available(text),
  public.is_member(uuid), public.member_role(uuid), public.is_platform_staff(), public.current_user_orgs(),
  public.shares_org_with(uuid) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text, boolean, text),
  public.accept_invitation(text), public.slug_available(text), public.is_member(uuid), public.member_role(uuid),
  public.is_platform_staff(), public.current_user_orgs(), public.shares_org_with(uuid) to authenticated;
grant execute on function public.get_invitation(text) to anon, authenticated;
