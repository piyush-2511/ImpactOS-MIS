-- Phase 4 · Shared engine
-- Option lists, custom fields + per-org field settings, number series, files, Google Drive connection, imports,
-- notifications, saved views, report definitions, job log, AI cache/usage, and the RPCs list pages use
-- (filter facets, global search, next number). Append-only: never edit once applied.

-- ───────────────────────────── permissions ─────────────────────────────

insert into public.permissions (key, module, description, sensitive) values
  ('admin.lists.manage',        'admin', 'Edit option lists', false),
  ('admin.fields.manage',       'admin', 'Change fields and columns, add custom fields', false),
  ('admin.integrations.manage', 'admin', 'Connect Google Drive and other services', false),
  ('data.import',               'data',  'Import records from Excel or CSV', false),
  ('data.export',               'data',  'Export lists to Excel, CSV or PDF', false);

insert into public.role_permissions (role_id, permission_key)
  select r.id, k from public.roles r, unnest(array['admin.lists.manage', 'admin.fields.manage', 'admin.integrations.manage', 'data.import', 'data.export']) k
   where r.is_system and r.key = 'admin';
insert into public.role_permissions (role_id, permission_key)
  select r.id, 'data.export' from public.roles r where r.is_system and r.key in ('program_manager', 'finance', 'hr_manager', 'fundraising_head', 'viewer');
insert into public.role_permissions (role_id, permission_key)
  select r.id, 'data.import' from public.roles r where r.is_system and r.key in ('program_manager', 'hr_manager', 'fundraising_head');

-- ───────────────────────────── option lists ─────────────────────────────

create table public.lookup_lists (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  module text not null,
  label_en text not null,
  label_hi text not null,
  allow_custom boolean not null default true,
  sort_order int not null default 0
);
comment on table public.lookup_lists is 'Platform catalogue of editable lists. Each phase adds the lists its module needs.';

create table public.lookup_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade, -- null = platform default
  list_key text not null references public.lookup_lists (key) on delete cascade,
  value_key text not null check (value_key ~ '^[a-z0-9][a-z0-9_]{0,59}$'),
  label_en text not null check (char_length(label_en) between 1 and 120),
  label_hi text check (label_hi is null or char_length(label_hi) <= 120),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  active boolean not null default true,
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create unique index lookup_values_platform_key on public.lookup_values (list_key, value_key) where organization_id is null;
create unique index lookup_values_org_key on public.lookup_values (organization_id, list_key, value_key) where organization_id is not null;
create index lookup_values_list on public.lookup_values (organization_id, list_key, sort_order);
comment on table public.lookup_values is 'Platform defaults (organization_id null) plus organisation rows. An org row with the same value_key overrides (or hides, via active=false) the default.';

insert into public.lookup_lists (key, module, label_en, label_hi, sort_order) values
  ('departments', 'organisation', 'Departments', 'विभाग', 10),
  ('focus_areas', 'program', 'Focus areas', 'कार्य क्षेत्र', 20),
  ('document_categories', 'organisation', 'Document categories', 'दस्तावेज़ श्रेणियाँ', 30),
  ('donor_types', 'fundraising', 'Donor types', 'दाता के प्रकार', 40);

insert into public.lookup_values (list_key, value_key, label_en, label_hi, sort_order) values
  ('departments', 'programs', 'Programs', 'कार्यक्रम', 1), ('departments', 'fundraising', 'Fundraising', 'धन संग्रह', 2),
  ('departments', 'finance', 'Finance', 'वित्त', 3), ('departments', 'hr_admin', 'HR and Admin', 'HR और प्रशासन', 4),
  ('departments', 'leadership', 'Leadership', 'नेतृत्व', 5),
  ('focus_areas', 'education', 'Education', 'शिक्षा', 1), ('focus_areas', 'health', 'Health', 'स्वास्थ्य', 2),
  ('focus_areas', 'nutrition', 'Nutrition', 'पोषण', 3), ('focus_areas', 'livelihood', 'Livelihood', 'आजीविका', 4),
  ('focus_areas', 'disability', 'Disability inclusion', 'दिव्यांगजन समावेशन', 5), ('focus_areas', 'women', 'Women’s empowerment', 'महिला सशक्तिकरण', 6),
  ('focus_areas', 'environment', 'Environment', 'पर्यावरण', 7),
  ('document_categories', 'registration', 'Registration', 'पंजीकरण', 1), ('document_categories', 'tax', 'Tax', 'कर', 2),
  ('document_categories', 'fcra', 'FCRA', 'FCRA', 3), ('document_categories', 'governance', 'Governance', 'शासन', 4),
  ('document_categories', 'policies', 'Policies', 'नीतियाँ', 5), ('document_categories', 'audits', 'Audits', 'ऑडिट', 6),
  ('document_categories', 'contracts', 'Contracts', 'अनुबंध', 7), ('document_categories', 'grants', 'Grants', 'अनुदान', 8),
  ('donor_types', 'individual', 'Individual', 'व्यक्ति', 1), ('donor_types', 'foundation', 'Foundation', 'फ़ाउंडेशन', 2),
  ('donor_types', 'corporate', 'Corporate', 'कॉर्पोरेट', 3), ('donor_types', 'government', 'Government', 'सरकारी', 4),
  ('donor_types', 'philanthropy', 'Philanthropy', 'परोपकार', 5), ('donor_types', 'ngo', 'NGO', 'NGO', 6),
  ('donor_types', 'trust', 'Trust', 'ट्रस्ट', 7), ('donor_types', 'society', 'Society', 'सोसाइटी', 8);

-- Effective list for an organisation: org rows override platform defaults with the same key.
create or replace function public.lookup_list(p_org uuid, p_list text, p_include_inactive boolean default false)
returns table (id uuid, value_key text, label_en text, label_hi text, color text, sort_order int, active boolean, is_default boolean, overridden boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with org_rows as (select * from public.lookup_values v where v.organization_id = p_org and v.list_key = p_list),
       defaults as (select * from public.lookup_values v where v.organization_id is null and v.list_key = p_list)
  select coalesce(o.id, d.id), coalesce(o.value_key, d.value_key), coalesce(o.label_en, d.label_en), coalesce(o.label_hi, d.label_hi),
         coalesce(o.color, d.color), coalesce(o.sort_order, d.sort_order), coalesce(o.active, d.active),
         d.id is not null, o.id is not null and d.id is not null
    from org_rows o full join defaults d on d.value_key = o.value_key
   where p_include_inactive or coalesce(o.active, d.active)
   order by 6, 3;
$$;

-- ───────────────────────────── custom fields and field settings ─────────────────────────────

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null check (entity ~ '^[a-z][a-z_]{1,40}$'),
  key text not null check (key ~ '^cf_[a-z0-9_]{1,40}$'),
  label_en text not null check (char_length(label_en) between 1 and 80),
  label_hi text check (label_hi is null or char_length(label_hi) <= 80),
  type text not null check (type in ('text', 'number', 'date', 'select', 'multiselect', 'boolean', 'phone', 'email', 'file')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  help_en text check (help_en is null or char_length(help_en) <= 200),
  help_hi text check (help_hi is null or char_length(help_hi) <= 200),
  required boolean not null default false,
  show_in_table boolean not null default false,
  filterable boolean not null default false check (not (filterable and type = 'file')),
  section text not null default 'other' check (section ~ '^[a-z_]{1,40}$'),
  sort_order int not null default 1000,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (organization_id, entity, key)
);
comment on column public.custom_field_definitions.archived_at is 'Deleted fields are archived; their values stay in custom_fields for 30 days, then a job removes them.';

create table public.field_settings (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null check (entity ~ '^[a-z][a-z_]{1,40}$'),
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_]{0,60}$'),
  label_en text check (label_en is null or char_length(label_en) between 1 and 80),
  label_hi text check (label_hi is null or char_length(label_hi) <= 80),
  show_in_table boolean,
  filterable boolean,
  required boolean,
  section text check (section is null or section ~ '^[a-z_]{1,40}$'),
  sort_order int,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (organization_id, entity, field_key)
);
comment on table public.field_settings is 'Per-organisation overrides for built-in fields (label, column, filter, required, section, order). Built-in TYPES never change.';

-- People get custom fields (first registered entity; later modules add custom_fields to their own tables).
alter table public.organization_members add column custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object');
create index organization_members_custom_fields on public.organization_members using gin (custom_fields);
-- Admins with admin.users.manage may write custom values on people (RLS added below).
grant update (custom_fields) on public.organization_members to authenticated;

-- ───────────────────────────── number series ─────────────────────────────

create table public.number_series (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  series_key text not null check (series_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  period text not null default '' check (period ~ '^[0-9a-z-]{0,20}$'),
  prefix text not null default '' check (char_length(prefix) <= 40),
  pad int not null default 5 check (pad between 1 and 10),
  next_value bigint not null default 1 check (next_value > 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, series_key, period)
);
comment on table public.number_series is 'Gap-free sequences per org, series and period (e.g. financial year). Only next_number() increments.';

-- Returns the next formatted number (prefix + zero-padded value) and increments atomically (row lock).
create or replace function public.next_number(p_org uuid, p_series text, p_period text default '', p_prefix text default '', p_pad int default 5)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v bigint;
  pre text;
  pd int;
begin
  if not public.is_member(p_org) and (select auth.uid()) is not null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.number_series (organization_id, series_key, period, prefix, pad)
  values (p_org, p_series, coalesce(p_period, ''), coalesce(p_prefix, ''), coalesce(p_pad, 5))
  on conflict do nothing;
  update public.number_series set next_value = next_value + 1, updated_at = now()
   where organization_id = p_org and series_key = p_series and period = coalesce(p_period, '')
  returning next_value - 1, prefix, pad into v, pre, pd;
  return pre || lpad(v::text, pd, '0');
end;
$$;

-- ───────────────────────────── files and Google Drive ─────────────────────────────

create table public.storage_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('r2', 'drive', 'local')),
  object_key text,
  drive_file_id text,
  name text not null check (char_length(name) between 1 and 255),
  mime text not null check (char_length(mime) <= 120),
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 104857600),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  entity text check (entity is null or entity ~ '^[a-z][a-z_]{1,40}$'),
  entity_id text,
  purpose text not null default 'attachment' check (purpose ~ '^[a-z_]{1,40}$'),
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleted')),
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (provider <> 'drive' or drive_file_id is not null or status = 'pending')
);
create index storage_files_entity on public.storage_files (organization_id, entity, entity_id) where status = 'ready';
comment on table public.storage_files is 'File metadata only; bytes live in R2 or the organisation''s Google Drive (hard rule 10).';

create table public.drive_connections (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  google_email text not null,
  refresh_token_enc text not null,
  folder_id text,
  status text not null default 'connected' check (status in ('connected', 'revoked', 'error')),
  connected_by uuid,
  connected_at timestamptz not null default now(),
  last_error text
);
comment on column public.drive_connections.refresh_token_enc is 'AES-256-GCM encrypted (TOKEN_ENCRYPTION_KEY). Never readable through the API.';

-- ───────────────────────────── imports ─────────────────────────────

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null check (entity ~ '^[a-z][a-z_]{1,40}$'),
  status text not null default 'uploaded' check (status in ('uploaded', 'validated', 'committing', 'committed', 'failed', 'undone')),
  file_name text not null check (char_length(file_name) <= 255),
  headers text[] not null default '{}',
  rows jsonb,
  mapping jsonb not null default '{}'::jsonb,
  total_rows int not null default 0,
  valid_rows int not null default 0,
  error_rows int not null default 0,
  committed_rows int not null default 0,
  errors jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  undo_until timestamptz,
  undone_at timestamptz
);
create index import_jobs_org on public.import_jobs (organization_id, created_at desc);
comment on column public.import_jobs.rows is 'Parsed rows, kept only until commit/undo window ends, then cleared by a job (privacy).';

-- ───────────────────────────── notifications, views, reports ─────────────────────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_.]{2,60}$'),
  title text not null check (char_length(title) <= 200),
  body text check (body is null or char_length(body) <= 1000),
  link text check (link is null or link ~ '^/[^/]'),
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_unread on public.notifications (user_id) where read_at is null;

create table public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  digest_enabled boolean not null default true,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity text not null check (entity ~ '^[a-z][a-z_]{1,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index saved_views_lookup on public.saved_views (organization_id, entity);

create table public.report_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  entity text not null check (entity ~ '^[a-z][a-z_]{1,40}$'),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  shared boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- ───────────────────────────── jobs and AI ─────────────────────────────

create table public.jobs_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  job_name text not null,
  run_id text,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  attempt int not null default 1,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_log_recent on public.jobs_log (organization_id, started_at desc);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  purpose text not null check (purpose ~ '^[a-z_.]{2,60}$'),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  model text not null,
  output jsonb not null,
  units int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, purpose, input_hash)
);

create table public.ai_usage (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  units int not null default 0 check (units >= 0),
  primary key (organization_id, month)
);

-- Atomically consume AI units within a monthly allowance. Returns false (and consumes nothing) when it would exceed it.
create or replace function public.ai_consume(p_org uuid, p_units int, p_allowance int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  m date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  used int;
begin
  insert into public.ai_usage (organization_id, month, units) values (p_org, m, 0) on conflict do nothing;
  select units into used from public.ai_usage where organization_id = p_org and month = m for update;
  if used + p_units > p_allowance then
    return false;
  end if;
  update public.ai_usage set units = units + p_units where organization_id = p_org and month = m;
  return true;
end;
$$;

-- ───────────────────────────── filter facets and global search ─────────────────────────────

-- Which entity tables the generic list engine may read, and which columns can be filters. Each phase registers its entities.
create table private.entity_sources (
  entity text primary key,
  table_name text not null,
  facet_columns text[] not null default '{}',
  has_custom_fields boolean not null default false
);
insert into private.entity_sources (entity, table_name, facet_columns, has_custom_fields) values
  ('members', 'organization_members', array['status', 'kind'], true),
  ('lookup_values', 'lookup_values', array['list_key', 'active'], false);

-- Distinct values + counts for a filter, read with the caller's rights (RLS applies). Custom fields use 'cf_<key>'.
create or replace function public.filter_facets(p_org uuid, p_entity text, p_field text, p_limit int default 50)
returns table (value text, n bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  src record;
  expr text;
begin
  select * into src from private.entity_sources where entity = p_entity;
  if src is null then
    raise exception 'Unknown entity' using errcode = '22023';
  end if;
  if p_field = any (src.facet_columns) then
    expr := format('%I::text', p_field);
  elsif src.has_custom_fields and p_field ~ '^cf_[a-z0-9_]{1,40}$'
        and exists (select 1 from public.custom_field_definitions d where d.organization_id = p_org and d.entity = p_entity and d.key = p_field and d.filterable and d.archived_at is null) then
    expr := format('custom_fields ->> %L', p_field);
  else
    raise exception 'Field cannot be filtered' using errcode = '22023';
  end if;
  return query execute format(
    'select %s as value, count(*) as n from public.%I where organization_id = $1 and %s is not null group by 1 order by 2 desc, 1 limit $2',
    expr, src.table_name, expr)
  using p_org, least(greatest(p_limit, 1), 200);
end;
$$;
-- private.entity_sources is read by the invoker function above.
grant usage on schema private to authenticated;
grant select on private.entity_sources to authenticated;
revoke all on schema private from anon;

-- Topbar search across what the user can see (RLS applies). Later phases replace this function to add their entities.
create or replace function public.global_search(p_org uuid, p_q text, p_limit int default 20)
returns table (kind text, id text, title text, subtitle text, href text, score real)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (select trim(p_q) as t)
  select * from (
    select 'person'::text, m.id::text, coalesce(p.full_name, p.email), p.email, '/admin/users'::text,
           greatest(extensions.similarity(coalesce(p.full_name, ''), (select t from q)), extensions.similarity(coalesce(p.email, ''), (select t from q)))
      from public.organization_members m join public.profiles p on p.id = m.user_id
     where m.organization_id = p_org and (p.full_name ilike '%' || (select t from q) || '%' or p.email ilike '%' || (select t from q) || '%')
    union all
    select 'position', pos.id::text, pos.name, null, '/admin/positions', extensions.similarity(pos.name, (select t from q))
      from public.positions pos where pos.organization_id = p_org and pos.name ilike '%' || (select t from q) || '%'
    union all
    select 'role', r.id::text, r.name, null, '/admin/roles/' || r.id, extensions.similarity(r.name, (select t from q))
      from public.roles r where (r.is_system or r.organization_id = p_org) and r.name ilike '%' || (select t from q) || '%'
    union all
    select 'option', v.id::text, v.label_en, v.label_hi, '/admin/option-lists?list=' || v.list_key, extensions.similarity(v.label_en, (select t from q))
      from public.lookup_values v where (v.organization_id = p_org or v.organization_id is null)
       and (v.label_en ilike '%' || (select t from q) || '%' or v.label_hi ilike '%' || (select t from q) || '%')
  ) s (kind, id, title, subtitle, href, score)
  where char_length((select t from q)) >= 2
  order by score desc, title
  limit least(greatest(p_limit, 1), 50);
$$;

-- ───────────────────────────── triggers ─────────────────────────────

create trigger lookup_values_touch before update on public.lookup_values for each row execute function public.touch_updated();
create trigger custom_field_definitions_touch before update on public.custom_field_definitions for each row execute function public.touch_updated();
create trigger report_definitions_touch before update on public.report_definitions for each row execute function public.touch_updated();

create trigger lookup_values_audit after insert or update or delete on public.lookup_values for each row execute function public.audit_row_change();
create trigger custom_field_definitions_audit after insert or update or delete on public.custom_field_definitions for each row execute function public.audit_row_change();
create trigger field_settings_audit after insert or update or delete on public.field_settings for each row execute function public.audit_row_change();
create trigger storage_files_audit after insert or update or delete on public.storage_files for each row execute function public.audit_row_change();
create trigger drive_connections_audit after insert or update or delete on public.drive_connections for each row execute function public.audit_row_change();
create trigger report_definitions_audit after insert or update or delete on public.report_definitions for each row execute function public.audit_row_change();
-- Import jobs: audit the job, not every parsed row.
create trigger import_jobs_audit after insert or delete on public.import_jobs for each row execute function public.audit_row_change();

-- Audit diffs must not copy secrets or bulk row payloads.
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
  ignore text[] := array['updated_at', 'updated_by', 'refresh_token_enc', 'rows', 'token_hash'];
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into cols
      from jsonb_object_keys(new_j) k
     where k <> all (ignore) and (old_j -> k) is distinct from (new_j -> k);
    if cols is null then return new; end if;
  end if;
  org := coalesce((new_j ->> 'organization_id'), (old_j ->> 'organization_id'),
                  case when tg_table_name = 'organizations' then coalesce(new_j ->> 'id', old_j ->> 'id') end)::uuid;
  rid := coalesce(new_j ->> 'id', old_j ->> 'id', new_j ->> 'member_id', old_j ->> 'member_id', new_j ->> 'field_key', old_j ->> 'field_key');
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

-- ───────────────────────────── row-level security ─────────────────────────────

alter table public.lookup_lists enable row level security;
alter table public.lookup_values enable row level security;
alter table public.custom_field_definitions enable row level security;
alter table public.field_settings enable row level security;
alter table public.number_series enable row level security;
alter table public.storage_files enable row level security;
alter table public.drive_connections enable row level security;
alter table public.import_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.saved_views enable row level security;
alter table public.report_definitions enable row level security;
alter table public.jobs_log enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_usage enable row level security;

create policy lookup_lists_select on public.lookup_lists for select to authenticated using (true);

create policy lookup_values_select on public.lookup_values for select to authenticated
  using (organization_id is null or public.is_member(organization_id));
create policy lookup_values_insert on public.lookup_values for insert to authenticated
  with check (organization_id is not null and public.has_permission(organization_id, 'admin.lists.manage'));
create policy lookup_values_update on public.lookup_values for update to authenticated
  using (organization_id is not null and public.has_permission(organization_id, 'admin.lists.manage'))
  with check (organization_id is not null and public.has_permission(organization_id, 'admin.lists.manage'));
create policy lookup_values_delete on public.lookup_values for delete to authenticated
  using (organization_id is not null and public.has_permission(organization_id, 'admin.lists.manage'));

create policy custom_fields_select on public.custom_field_definitions for select to authenticated using (public.is_member(organization_id));
create policy custom_fields_insert on public.custom_field_definitions for insert to authenticated with check (public.has_permission(organization_id, 'admin.fields.manage'));
create policy custom_fields_update on public.custom_field_definitions for update to authenticated
  using (public.has_permission(organization_id, 'admin.fields.manage')) with check (public.has_permission(organization_id, 'admin.fields.manage'));

create policy field_settings_select on public.field_settings for select to authenticated using (public.is_member(organization_id));
create policy field_settings_insert on public.field_settings for insert to authenticated with check (public.has_permission(organization_id, 'admin.fields.manage'));
create policy field_settings_update on public.field_settings for update to authenticated
  using (public.has_permission(organization_id, 'admin.fields.manage')) with check (public.has_permission(organization_id, 'admin.fields.manage'));
create policy field_settings_delete on public.field_settings for delete to authenticated using (public.has_permission(organization_id, 'admin.fields.manage'));

create policy organization_members_update_custom on public.organization_members for update to authenticated
  using (public.has_permission(organization_id, 'admin.users.manage')) with check (public.has_permission(organization_id, 'admin.users.manage'));

create policy number_series_select on public.number_series for select to authenticated using (public.is_member(organization_id));

create policy storage_files_select on public.storage_files for select to authenticated using (public.is_member(organization_id) and status <> 'deleted');
create policy storage_files_insert on public.storage_files for insert to authenticated
  with check (public.is_member(organization_id) and uploaded_by = (select auth.uid()) and status = 'pending');
create policy storage_files_update on public.storage_files for update to authenticated
  using (public.is_member(organization_id) and (uploaded_by = (select auth.uid()) or public.has_permission(organization_id, 'admin.users.manage')))
  with check (public.is_member(organization_id));

create policy drive_connections_select on public.drive_connections for select to authenticated
  using (public.has_permission(organization_id, 'admin.integrations.manage'));

create policy import_jobs_select on public.import_jobs for select to authenticated
  using (public.is_member(organization_id) and (created_by = (select auth.uid()) or public.has_permission(organization_id, 'data.import')));
create policy import_jobs_insert on public.import_jobs for insert to authenticated
  with check (public.has_permission(organization_id, 'data.import') and created_by = (select auth.uid()));
create policy import_jobs_update on public.import_jobs for update to authenticated
  using (public.has_permission(organization_id, 'data.import') and created_by = (select auth.uid()))
  with check (public.has_permission(organization_id, 'data.import'));

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notification_prefs_all on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy saved_views_select on public.saved_views for select to authenticated
  using (public.is_member(organization_id) and (user_id = (select auth.uid()) or shared));
create policy saved_views_write on public.saved_views for insert to authenticated
  with check (public.is_member(organization_id) and user_id = (select auth.uid()));
create policy saved_views_update on public.saved_views for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_views_delete on public.saved_views for delete to authenticated using (user_id = (select auth.uid()));

create policy report_definitions_select on public.report_definitions for select to authenticated
  using (public.is_member(organization_id) and (shared or created_by = (select auth.uid())));
create policy report_definitions_insert on public.report_definitions for insert to authenticated
  with check (public.is_member(organization_id) and created_by = (select auth.uid()));
create policy report_definitions_update on public.report_definitions for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy report_definitions_delete on public.report_definitions for delete to authenticated using (created_by = (select auth.uid()));

create policy jobs_log_select on public.jobs_log for select to authenticated using (public.has_permission(organization_id, 'admin.audit.view'));
create policy ai_usage_select on public.ai_usage for select to authenticated using (public.is_member(organization_id));

-- ───────────────────────────── privileges ─────────────────────────────

revoke all on public.lookup_lists, public.lookup_values, public.custom_field_definitions, public.field_settings, public.number_series,
  public.storage_files, public.drive_connections, public.import_jobs, public.notifications, public.notification_prefs,
  public.saved_views, public.report_definitions, public.jobs_log, public.ai_runs, public.ai_usage from anon;
revoke insert, update, delete on public.lookup_lists, public.number_series, public.drive_connections, public.jobs_log, public.ai_runs, public.ai_usage from authenticated;
revoke delete on public.custom_field_definitions, public.storage_files, public.import_jobs, public.notifications from authenticated;
-- The encrypted Drive token is never selectable through the API, even by admins.
revoke select on public.drive_connections from authenticated;
grant select (organization_id, google_email, folder_id, status, connected_by, connected_at, last_error) on public.drive_connections to authenticated;
-- Users may only mark notifications read.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke execute on function public.next_number(uuid, text, text, text, int), public.filter_facets(uuid, text, text, int),
  public.global_search(uuid, text, int), public.lookup_list(uuid, text, boolean), public.ai_consume(uuid, int, int) from public, anon;
grant execute on function public.next_number(uuid, text, text, text, int), public.filter_facets(uuid, text, text, int),
  public.global_search(uuid, text, int), public.lookup_list(uuid, text, boolean) to authenticated;
grant execute on function public.ai_consume(uuid, int, int) to service_role;
