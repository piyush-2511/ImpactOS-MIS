-- Phase 1 · Foundation
-- Extensions and helpers every later migration relies on. Append-only: never edit after it is applied.

create extension if not exists pgcrypto with schema extensions;   -- gen_random_uuid(), digest() for hashed tokens
create extension if not exists pg_trgm  with schema extensions;   -- similar-name matching (places, beneficiaries)
create extension if not exists citext   with schema extensions;   -- case-insensitive slugs, emails, usernames

-- pg_cron schedules jobs from phase 4. It exists on Supabase but not on every local Postgres, so enable it when available.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
  end if;
end
$$;

-- Private schema for security-definer helpers that must not be exposed through the API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Keeps updated_at current on every business table (attached as a BEFORE UPDATE trigger).
create or replace function public.touch_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

comment on function public.touch_updated() is 'BEFORE UPDATE trigger: sets updated_at and updated_by. Used by every org-scoped table.';
