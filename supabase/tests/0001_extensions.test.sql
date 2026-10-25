-- pgTAP checks for migration 0001. Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_extension('pgcrypto', 'pgcrypto is installed');
select has_extension('pg_trgm', 'pg_trgm is installed');
select has_extension('citext', 'citext is installed');
select has_schema('private', 'private schema exists');
select has_function('public', 'touch_updated', 'touch_updated() trigger function exists');

select * from finish();
rollback;
