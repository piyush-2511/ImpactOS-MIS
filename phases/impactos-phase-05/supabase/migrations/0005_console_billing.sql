-- Phase 5 · Platform console and billing
-- Plans, limits and modules; subscriptions (30-day trial); monthly invoices paid by UPI/bank with UTR confirmation;
-- credit notes; support grants (Secretary-approved, time-boxed, read-only views in the console, every view logged);
-- support tickets; feature flags; announcements; platform audit. Append-only: never edit once applied.

-- ───────────────────────────── permissions ─────────────────────────────

insert into public.permissions (key, module, description, sensitive) values
  ('admin.billing.manage', 'admin', 'See invoices, pay, change plan', false),
  ('admin.support.manage', 'admin', 'Grant or revoke ImpactOS support access', false);
-- Only the Secretary (grants_all) holds these by default: "Admin = everything except billing".

-- ───────────────────────────── plans ─────────────────────────────

create table public.plans (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null,
  description text,
  monthly_paise bigint not null check (monthly_paise >= 0),
  annual_paise bigint not null check (annual_paise >= 0),
  extra_seat_paise bigint not null default 0 check (extra_seat_paise >= 0),
  donation_fee_bps int not null default 200 check (donation_fee_bps between 0 and 1000),
  donation_fee_cap_paise bigint not null default 50000 check (donation_fee_cap_paise >= 0),
  is_public boolean not null default true,
  active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
comment on column public.plans.donation_fee_bps is 'Platform fee on confirmed online-page donations, in basis points (200 = 2%), capped per gift.';

create table public.plan_limits (
  plan_key text not null references public.plans (key) on delete cascade,
  limit_key text not null check (limit_key in ('staff_seats', 'beneficiaries', 'storage_gb', 'ai_units', 'custom_fields')),
  value int check (value is null or value >= 0), -- null = unlimited
  primary key (plan_key, limit_key)
);

create table public.plan_modules (
  plan_key text not null references public.plans (key) on delete cascade,
  module text not null check (module ~ '^[a-z][a-z_]{1,30}$'),
  primary key (plan_key, module)
);

insert into public.plans (key, name, description, monthly_paise, annual_paise, extra_seat_paise, donation_fee_bps, donation_fee_cap_paise, sort_order) values
  ('starter', 'Starter', 'For small NGOs getting organised', 199900, 1999000, 39900, 200, 50000, 1),
  ('growth', 'Growth', 'For NGOs with several funded programs', 599900, 5999000, 39900, 200, 50000, 2),
  ('enterprise', 'Enterprise', 'For large NGOs and networks', 1500000, 15000000, 0, 150, 50000, 3);
insert into public.plan_limits (plan_key, limit_key, value) values
  ('starter', 'staff_seats', 5), ('starter', 'beneficiaries', 2000), ('starter', 'storage_gb', 25), ('starter', 'ai_units', 1000), ('starter', 'custom_fields', 5),
  ('growth', 'staff_seats', 15), ('growth', 'beneficiaries', 15000), ('growth', 'storage_gb', 150), ('growth', 'ai_units', 5000), ('growth', 'custom_fields', 20),
  ('enterprise', 'staff_seats', null), ('enterprise', 'beneficiaries', null), ('enterprise', 'storage_gb', 1000), ('enterprise', 'ai_units', 25000), ('enterprise', 'custom_fields', 50);
insert into public.plan_modules (plan_key, module)
  select p, m from unnest(array['starter']) p, unnest(array['home', 'program', 'media', 'fundraising', 'workplace', 'organisation', 'admin', 'compliance']) m
  union all
  select p, m from unnest(array['growth', 'enterprise']) p,
    unnest(array['home', 'program', 'media', 'marketing', 'fundraising', 'hr', 'organisation', 'governance', 'compliance', 'workplace', 'admin', 'assistant', 'finance']) m;

-- ───────────────────────────── subscriptions ─────────────────────────────

create table public.subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan_key text not null references public.plans (key),
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'annual')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'read_only', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_start date,
  current_period_end date,
  pending_plan_key text references public.plans (key),
  plan_chosen boolean not null default false,
  read_only_since timestamptz,
  cancelled_at timestamptz,
  export_until timestamptz,
  console_notes text check (console_notes is null or char_length(console_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.subscriptions.pending_plan_key is 'Downgrade (or period change) taking effect at the next billing period.';

-- Every existing organisation starts a 30-day Growth trial (phase 2 orgs created before billing existed).
insert into public.subscriptions (organization_id, plan_key, status, trial_ends_at)
  select id, 'growth', 'trialing', greatest(created_at, now()) + interval '30 days' from public.organizations
  on conflict do nothing;

-- Usage that becomes invoice lines: proration on upgrade, AI packs, donation fees (phase 9), manual items.
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('proration', 'ai_pack', 'donation_fee', 'storage_pack', 'manual')),
  description text not null check (char_length(description) <= 200),
  quantity numeric(12,2) not null default 1,
  amount_paise bigint not null,
  occurred_at timestamptz not null default now(),
  invoice_id uuid,
  created_by uuid default auth.uid()
);
create index usage_records_unbilled on public.usage_records (organization_id) where invoice_id is null;

-- ───────────────────────────── invoices ─────────────────────────────

create table public.platform_counters (
  key text not null,
  period text not null,
  next_value bigint not null default 1,
  primary key (key, period)
);

create or replace function private.next_platform_number(p_key text, p_period text, p_prefix text, p_pad int default 4)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
begin
  insert into public.platform_counters (key, period) values (p_key, p_period) on conflict do nothing;
  update public.platform_counters set next_value = next_value + 1 where key = p_key and period = p_period returning next_value - 1 into v;
  return p_prefix || lpad(v::text, p_pad, '0');
end;
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  number text unique,
  status text not null default 'draft' check (status in ('draft', 'issued', 'paid', 'void')),
  period_start date not null,
  period_end date not null,
  plan_key text references public.plans (key),
  issued_at timestamptz,
  due_at timestamptz,
  subtotal_paise bigint not null default 0,
  credit_paise bigint not null default 0,
  gst_rate_bps int not null default 0 check (gst_rate_bps between 0 and 2800),
  gst_paise bigint not null default 0,
  total_paise bigint not null default 0,
  paid_paise bigint not null default 0,
  paid_at timestamptz,
  pdf_file_id uuid references public.storage_files (id) on delete set null,
  notes text,
  reminders_sent text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (organization_id, period_start)
);
create index invoices_open on public.invoices (status, due_at) where status = 'issued';
comment on table public.invoices is 'Monthly/annual ImpactOS invoices. Immutable once issued: corrections are credit notes.';

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  kind text not null check (kind in ('plan', 'extra_seats', 'proration', 'ai_pack', 'donation_fee', 'storage_pack', 'manual', 'credit')),
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_paise bigint not null,
  amount_paise bigint not null,
  sort_order int not null default 0
);

create table public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  method text not null check (method in ('upi', 'bank', 'cheque', 'other')),
  utr text not null check (utr ~ '^[A-Za-z0-9/-]{6,40}$'),
  paid_on date not null,
  status text not null default 'submitted' check (status in ('submitted', 'confirmed', 'rejected')),
  submitted_by uuid default auth.uid(),
  submitted_at timestamptz not null default now(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  note text check (note is null or char_length(note) <= 500)
);
create unique index billing_payments_utr on public.billing_payments (upper(utr)) where status <> 'rejected';

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  invoice_id uuid references public.invoices (id),
  number text unique not null,
  amount_paise bigint not null check (amount_paise > 0),
  reason text not null check (char_length(reason) between 5 and 500),
  applied_invoice_id uuid references public.invoices (id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Issued invoices and their lines never change (only status/payment/reminder fields move).
create or replace function private.guard_issued_invoice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (new.subtotal_paise, new.credit_paise, new.gst_paise, new.total_paise, new.number, new.period_start, new.period_end, new.organization_id)
       is distinct from (old.subtotal_paise, old.credit_paise, old.gst_paise, old.total_paise, old.number, old.period_start, old.period_end, old.organization_id) then
    raise exception 'Issued invoices cannot be changed; issue a credit note' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger invoices_immutable before update on public.invoices for each row execute function private.guard_issued_invoice();

create or replace function private.guard_issued_lines()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select status from public.invoices where id = coalesce(new.invoice_id, old.invoice_id)) <> 'draft' then
    raise exception 'Lines of an issued invoice cannot be changed' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger invoice_lines_immutable before insert or update or delete on public.invoice_lines for each row execute function private.guard_issued_lines();

-- ───────────────────────────── support ─────────────────────────────

create table public.support_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null, -- null for break-glass
  access text not null default 'read' check (access in ('read')),
  reason text not null check (char_length(reason) between 3 and 500),
  break_glass boolean not null default false,
  requested_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid,
  check (expires_at > granted_at and expires_at <= granted_at + interval '7 days')
);
create index support_grants_active on public.support_grants (organization_id, expires_at) where revoked_at is null;
comment on column public.support_grants.access is 'Read-only views in the console. Write access for support is deliberately not offered.';

create table public.support_access_log (
  id bigint generated always as identity primary key,
  grant_id uuid not null references public.support_grants (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  staff_user_id uuid not null,
  view text not null check (char_length(view) <= 200),
  at timestamptz not null default now()
);
create index support_access_log_org on public.support_access_log (organization_id, at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 150),
  body text not null check (char_length(body) between 3 and 4000),
  page text check (page is null or page ~ '^/[^/]?'),
  status text not null default 'open' check (status in ('open', 'waiting', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  staff_reply text check (staff_reply is null or char_length(staff_reply) <= 4000),
  replied_at timestamptz,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  organization_id uuid references public.organizations (id) on delete cascade, -- null = everyone
  enabled boolean not null default false,
  note text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index feature_flags_scope on public.feature_flags (key, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_en text not null check (char_length(title_en) between 3 and 150),
  title_hi text check (title_hi is null or char_length(title_hi) <= 150),
  body_en text check (body_en is null or char_length(body_en) <= 600),
  body_hi text check (body_hi is null or char_length(body_hi) <= 600),
  tone text not null default 'info' check (tone in ('info', 'warn')),
  plan_key text references public.plans (key),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.platform_audit_events (
  id bigint generated always as identity primary key,
  staff_user_id uuid,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  organization_id uuid references public.organizations (id) on delete set null,
  target text,
  details jsonb,
  at timestamptz not null default now()
);
create index platform_audit_recent on public.platform_audit_events (at desc);

-- ───────────────────────────── helper functions ─────────────────────────────

-- Platform staff signed in with two-step verification (required for every console write, also checked in the app).
create or replace function public.is_staff_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_staff() and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the current user is platform staff with an unexpired, unrevoked grant for this organisation,
-- signed in with two-step verification.
create or replace function public.has_support_grant(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_staff()
     and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.support_grants g where g.organization_id = org and g.revoked_at is null and g.expires_at > now());
$$;

create or replace function public.org_plan(org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.plan_key from public.subscriptions s where s.organization_id = org;
$$;

create or replace function public.plan_allows(org uuid, p_module text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.subscriptions s join public.plan_modules m on m.plan_key = s.plan_key
                  where s.organization_id = org and m.module = p_module and s.status <> 'cancelled');
$$;

create or replace function public.org_limit(org uuid, p_key text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select l.value from public.subscriptions s join public.plan_limits l on l.plan_key = s.plan_key and l.limit_key = p_key
   where s.organization_id = org;
$$;

create or replace function public.is_read_only(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.status in ('read_only', 'cancelled') from public.subscriptions s where s.organization_id = org), false);
$$;

-- Staff seats in use: active members holding any role other than self-service.
create or replace function public.staff_seats_used(org uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct m.id)::int
    from public.organization_members m join public.member_roles mr on mr.member_id = m.id join public.roles r on r.id = mr.role_id
   where m.organization_id = org and m.status = 'active' and coalesce(r.key, '') <> 'self_service';
$$;

-- Organisation creation now also starts the 30-day Growth trial.
create or replace function private.start_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (organization_id, plan_key, status, trial_ends_at)
  values (new.id, 'growth', 'trialing', now() + interval '30 days')
  on conflict do nothing;
  return new;
end;
$$;
create trigger organizations_start_trial after insert on public.organizations for each row execute function private.start_trial();

-- Secretary-approved support access (read-only console views). Requires admin.support.manage.
create or replace function public.grant_support_access(p_org uuid, p_hours int, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  if not public.has_permission(p_org, 'admin.support.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_hours not in (4, 24, 72) then
    raise exception 'Choose 4, 24 or 72 hours' using errcode = '22023';
  end if;
  insert into public.support_grants (organization_id, granted_by, reason, expires_at)
  values (p_org, (select auth.uid()), trim(p_reason), now() + make_interval(hours => p_hours))
  returning id into gid;
  insert into public.audit_events (organization_id, actor_id, action, table_name, row_id, note)
  values (p_org, (select auth.uid()), 'support.access_granted', 'support_grants', gid::text, p_hours || ' h');
  return gid;
end;
$$;

create or replace function public.revoke_support_access(p_grant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  select organization_id into org from public.support_grants where id = p_grant;
  if org is null or not public.has_permission(org, 'admin.support.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.support_grants set revoked_at = now(), revoked_by = (select auth.uid()) where id = p_grant and revoked_at is null;
  insert into public.audit_events (organization_id, actor_id, action, table_name, row_id) values (org, (select auth.uid()), 'support.access_revoked', 'support_grants', p_grant::text);
end;
$$;

-- NGO submits a payment reference for an invoice (confirmed later by ImpactOS billing staff).
create or replace function public.submit_invoice_payment(p_invoice uuid, p_amount_paise bigint, p_method text, p_utr text, p_paid_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.invoices%rowtype;
  pid uuid;
begin
  select * into inv from public.invoices where id = p_invoice;
  if inv.id is null or not public.has_permission(inv.organization_id, 'admin.billing.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if inv.status <> 'issued' then
    raise exception 'This invoice is not open for payment' using errcode = '22023';
  end if;
  if p_paid_on > (now() at time zone 'Asia/Kolkata')::date or p_paid_on < (inv.issued_at at time zone 'Asia/Kolkata')::date - 30 then
    raise exception 'Check the payment date' using errcode = '22023';
  end if;
  insert into public.billing_payments (invoice_id, organization_id, amount_paise, method, utr, paid_on)
  values (inv.id, inv.organization_id, p_amount_paise, p_method, upper(trim(p_utr)), p_paid_on)
  returning id into pid;
  return pid;
end;
$$;

-- ───────────────────────────── support read access on organisation data ─────────────────────────────
-- Additional permissive SELECT policies: platform staff with an active grant can read (never write) these tables.
-- Every later phase adds the same policy to its org-scoped tables (references/conventions.md).
do $$
declare
  t text;
begin
  foreach t in array array['organization_members', 'invitations', 'username_accounts', 'member_roles', 'member_scopes', 'positions',
    'position_holders', 'audit_events', 'lookup_values', 'custom_field_definitions', 'field_settings', 'storage_files', 'import_jobs',
    'number_series', 'saved_views', 'report_definitions', 'jobs_log'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.has_support_grant(organization_id))', t || '_support_select', t);
  end loop;
end
$$;
create policy roles_support_select on public.roles for select to authenticated using (organization_id is not null and public.has_support_grant(organization_id));
create policy profiles_support_select on public.profiles for select to authenticated
  using (exists (select 1 from public.organization_members m where m.user_id = profiles.id and public.has_support_grant(m.organization_id)));

-- ───────────────────────────── row-level security ─────────────────────────────

alter table public.plans enable row level security;
alter table public.plan_limits enable row level security;
alter table public.plan_modules enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_records enable row level security;
alter table public.platform_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.billing_payments enable row level security;
alter table public.credit_notes enable row level security;
alter table public.support_grants enable row level security;
alter table public.support_access_log enable row level security;
alter table public.support_tickets enable row level security;
alter table public.feature_flags enable row level security;
alter table public.announcements enable row level security;
alter table public.platform_audit_events enable row level security;

-- Plans are public reference data; only platform staff change them.
create policy plans_select on public.plans for select to authenticated using (true);
create policy plan_limits_select on public.plan_limits for select to authenticated using (true);
create policy plan_modules_select on public.plan_modules for select to authenticated using (true);
create policy plans_staff_write on public.plans for all to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());
create policy plan_limits_staff_write on public.plan_limits for all to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());
create policy plan_modules_staff_write on public.plan_modules for all to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());

-- NGO members read their own subscription; billing changes go through server actions (service role) or staff.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_member(organization_id) or public.is_platform_staff());
create policy subscriptions_staff_write on public.subscriptions for update to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());

create policy usage_records_select on public.usage_records for select to authenticated
  using (public.has_permission(organization_id, 'admin.billing.manage') or public.is_platform_staff());

create policy invoices_select on public.invoices for select to authenticated
  using ((status <> 'draft' and public.has_permission(organization_id, 'admin.billing.manage')) or public.is_platform_staff());
create policy invoices_staff_write on public.invoices for update to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());
create policy invoice_lines_select on public.invoice_lines for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id and ((i.status <> 'draft' and public.has_permission(i.organization_id, 'admin.billing.manage')) or public.is_platform_staff())));

create policy billing_payments_select on public.billing_payments for select to authenticated
  using (public.has_permission(organization_id, 'admin.billing.manage') or public.is_platform_staff());
create policy billing_payments_staff_write on public.billing_payments for update to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());

create policy credit_notes_select on public.credit_notes for select to authenticated
  using (public.has_permission(organization_id, 'admin.billing.manage') or public.is_platform_staff());

create policy support_grants_select on public.support_grants for select to authenticated
  using (public.has_permission(organization_id, 'admin.support.manage') or public.is_platform_staff());
create policy support_access_log_select on public.support_access_log for select to authenticated
  using (public.has_permission(organization_id, 'admin.support.manage') or public.is_platform_staff());

create policy support_tickets_select on public.support_tickets for select to authenticated
  using (created_by = (select auth.uid()) or public.is_platform_staff());
create policy support_tickets_insert on public.support_tickets for insert to authenticated
  with check (created_by = (select auth.uid()) and (organization_id is null or public.is_member(organization_id)) and status = 'open' and staff_reply is null);
create policy support_tickets_staff_write on public.support_tickets for update to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());

create policy feature_flags_select on public.feature_flags for select to authenticated
  using (organization_id is null or public.is_member(organization_id) or public.is_platform_staff());
create policy feature_flags_staff_write on public.feature_flags for all to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());

create policy announcements_select on public.announcements for select to authenticated using (true);
create policy announcements_staff_write on public.announcements for all to authenticated using (public.is_staff_verified()) with check (public.is_staff_verified());

create policy platform_audit_select on public.platform_audit_events for select to authenticated using (public.is_platform_staff());

-- ───────────────────────────── triggers ─────────────────────────────

create trigger subscriptions_touch before update on public.subscriptions for each row execute function private.touch_updated_at();
create trigger support_tickets_touch before update on public.support_tickets for each row execute function private.touch_updated_at();
create trigger plans_touch before update on public.plans for each row execute function private.touch_updated_at();

-- Billing and support changes appear in the NGO's own activity log too (actor shown as ImpactOS staff where relevant).
create trigger subscriptions_audit after insert or update on public.subscriptions for each row execute function public.audit_row_change();
create trigger invoices_audit after insert or update on public.invoices for each row execute function public.audit_row_change();
create trigger billing_payments_audit after insert or update on public.billing_payments for each row execute function public.audit_row_change();
create trigger credit_notes_audit after insert on public.credit_notes for each row execute function public.audit_row_change();
create trigger support_grants_audit after update on public.support_grants for each row execute function public.audit_row_change();

-- ───────────────────────────── privileges ─────────────────────────────

revoke all on public.plans, public.plan_limits, public.plan_modules, public.subscriptions, public.usage_records, public.platform_counters,
  public.invoices, public.invoice_lines, public.billing_payments, public.credit_notes, public.support_grants, public.support_access_log,
  public.support_tickets, public.feature_flags, public.announcements, public.platform_audit_events from anon;
-- Writes on billing/support tables happen through the RPCs above, staff policies, or the service role (jobs).
revoke insert, delete on public.subscriptions, public.invoices, public.invoice_lines, public.billing_payments, public.credit_notes,
  public.support_grants, public.support_access_log, public.usage_records, public.platform_counters, public.platform_audit_events from authenticated;
revoke update on public.usage_records, public.platform_counters, public.platform_audit_events, public.support_grants, public.support_access_log, public.credit_notes, public.invoice_lines from authenticated;
revoke delete on public.support_tickets from authenticated;
-- Staff update only status/notes columns on these; amounts are fixed by the immutability trigger as well.
revoke update on public.subscriptions from authenticated;
grant update (plan_key, billing_period, status, trial_ends_at, pending_plan_key, read_only_since, cancelled_at, export_until, console_notes) on public.subscriptions to authenticated;

revoke execute on function public.has_support_grant(uuid), public.org_plan(uuid), public.plan_allows(uuid, text), public.org_limit(uuid, text),
  public.is_read_only(uuid), public.staff_seats_used(uuid), public.grant_support_access(uuid, int, text), public.revoke_support_access(uuid),
  public.submit_invoice_payment(uuid, bigint, text, text, date), public.is_staff_verified() from public, anon;
grant execute on function public.has_support_grant(uuid), public.org_plan(uuid), public.plan_allows(uuid, text), public.org_limit(uuid, text),
  public.is_read_only(uuid), public.staff_seats_used(uuid), public.grant_support_access(uuid, int, text), public.revoke_support_access(uuid),
  public.submit_invoice_payment(uuid, bigint, text, text, date), public.is_staff_verified() to authenticated;
revoke execute on function private.next_platform_number(text, text, text, int) from public;
grant execute on function private.next_platform_number(text, text, text, int) to service_role;
-- The service role (jobs) calls this wrapper to number invoices and credit notes.
create or replace function public.next_platform_number(p_key text, p_period text, p_prefix text, p_pad int default 4)
returns text
language sql
security definer
set search_path = ''
as $$ select private.next_platform_number(p_key, p_period, p_prefix, p_pad); $$;
revoke execute on function public.next_platform_number(text, text, text, int) from public, anon, authenticated;
grant execute on function public.next_platform_number(text, text, text, int) to service_role;
