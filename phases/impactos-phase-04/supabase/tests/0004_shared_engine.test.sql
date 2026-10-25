-- pgTAP checks for migration 0004 (option lists, fields, facets, numbering, files, imports, notifications, search, AI).
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000004a1', 'sec@a4.example', now(), '{"full_name":"Asha Secretary"}'),
  ('00000000-0000-0000-0000-0000000004a2', 'field@a4.example', now(), '{"full_name":"Farid Field"}'),
  ('00000000-0000-0000-0000-0000000004b1', 'sec@b4.example', now(), '{"full_name":"Bina Other"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004a1"}';
select set_config('t.a', public.create_organization('Org A4', 'org-a4', 'trust', 'Bihar')::text, true);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004b1"}';
select set_config('t.b', public.create_organization('Org B4', 'org-b4', 'trust', 'Bihar')::text, true);
reset role;
insert into public.organization_members (organization_id, user_id) values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000004a2');
select set_config('t.mf', (select id::text from public.organization_members where user_id = '00000000-0000-0000-0000-0000000004a2'), true);
insert into public.member_roles (member_id, role_id, organization_id)
  select current_setting('t.mf')::uuid, id, current_setting('t.a')::uuid from public.roles where is_system and key = 'field_coordinator';

-- Option lists: defaults, override, hide.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004a1"}';
select is((select count(*)::int from public.lookup_list(current_setting('t.a')::uuid, 'departments')), 5, 'platform defaults are visible');
select lives_ok($$ insert into public.lookup_values (organization_id, list_key, value_key, label_en, label_hi) values (current_setting('t.a')::uuid, 'departments', 'finance', 'Accounts', 'लेखा') $$, 'Secretary overrides a default');
select lives_ok($$ insert into public.lookup_values (organization_id, list_key, value_key, label_en, active) values (current_setting('t.a')::uuid, 'departments', 'leadership', 'Leadership', false) $$, 'and hides another');
select lives_ok($$ insert into public.lookup_values (organization_id, list_key, value_key, label_en) values (current_setting('t.a')::uuid, 'departments', 'communications', 'Communications') $$, 'and adds a new value');
select is((select label_en from public.lookup_list(current_setting('t.a')::uuid, 'departments') where value_key = 'finance'), 'Accounts', 'org label overrides the default');
select is((select count(*)::int from public.lookup_list(current_setting('t.a')::uuid, 'departments')), 5, 'hidden default is excluded, new value included');
select is((select count(*)::int from public.lookup_list(current_setting('t.a')::uuid, 'departments', true)), 6, 'inactive values appear when asked');
select throws_ok($$ insert into public.lookup_values (organization_id, list_key, value_key, label_en) values (null, 'departments', 'x', 'X') $$, '42501', null, 'nobody edits platform defaults through the API');

-- Custom fields and field settings.
select lives_ok($$ insert into public.custom_field_definitions (organization_id, entity, key, label_en, type, filterable, show_in_table, options)
  values (current_setting('t.a')::uuid, 'members', 'cf_branch', 'Branch', 'select', true, true, '[{"key":"gaya","label_en":"Gaya"},{"key":"patna","label_en":"Patna"}]') $$, 'admin adds a select custom field');
select throws_ok($$ insert into public.custom_field_definitions (organization_id, entity, key, label_en, type, filterable) values (current_setting('t.a')::uuid, 'members', 'cf_photo', 'Photo', 'file', true) $$,
  '23514', null, 'file fields cannot be filters');
select lives_ok($$ insert into public.field_settings (organization_id, entity, field_key, label_en, show_in_table) values (current_setting('t.a')::uuid, 'members', 'joined_at', 'Date joined', false) $$, 'admin renames a built-in field');
select lives_ok($$ update public.organization_members set custom_fields = '{"cf_branch":"gaya"}' where id = current_setting('t.mf')::uuid $$, 'admin writes a custom value on a person');

-- Facets.
select is((select n from public.filter_facets(current_setting('t.a')::uuid, 'members', 'status') where value = 'active'), 2::bigint, 'facet counts active members');
select is((select n from public.filter_facets(current_setting('t.a')::uuid, 'members', 'cf_branch') where value = 'gaya'), 1::bigint, 'custom field facet works when filterable');
select throws_ok($$ select * from public.filter_facets(current_setting('t.a')::uuid, 'members', 'user_id') $$, '22023', null, 'non-filter columns are refused');
select throws_ok($$ select * from public.filter_facets(current_setting('t.a')::uuid, 'members', 'status; drop table x') $$, '22023', null, 'injection attempts are refused');

-- Number series.
select is(public.next_number(current_setting('t.a')::uuid, 'receipt', '2026-27', 'A4/2026-27/', 6), 'A4/2026-27/000001', 'first number');
select is(public.next_number(current_setting('t.a')::uuid, 'receipt', '2026-27', 'A4/2026-27/', 6), 'A4/2026-27/000002', 'numbers increase without gaps');
select is(public.next_number(current_setting('t.a')::uuid, 'receipt', '2027-28', 'A4/2027-28/', 6), 'A4/2027-28/000001', 'each period starts again');

-- Search and notifications.
select is((select count(*)::int from public.global_search(current_setting('t.a')::uuid, 'Farid')), 1, 'search finds a colleague');
select is((select count(*)::int from public.global_search(current_setting('t.a')::uuid, 'Bina')), 0, 'search does not reach other organisations');
reset role;
insert into public.notifications (organization_id, user_id, kind, title) values (current_setting('t.a')::uuid, '00000000-0000-0000-0000-0000000004a2', 'test.ping', 'For Farid');
insert into public.drive_connections (organization_id, google_email, refresh_token_enc) values (current_setting('t.a')::uuid, 'drive@a4.example', 'v1:secret');
set local role authenticated;
select is((select count(*)::int from public.notifications), 0, 'other people''s notifications are hidden');
select throws_ok($$ select refresh_token_enc from public.drive_connections $$, '42501', null, 'the Drive token is never readable');
select is((select google_email from public.drive_connections), 'drive@a4.example', 'connection details are visible to admins');

-- Field coordinator: limited.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000004a2"}';
select is((select count(*)::int from public.notifications), 1, 'own notification is visible');
select throws_ok($$ update public.notifications set title = 'changed' $$, '42501', null, 'only read_at can be changed');
select throws_ok($$ insert into public.lookup_values (organization_id, list_key, value_key, label_en) values (current_setting('t.a')::uuid, 'departments', 'y', 'Y') $$, '42501', null, 'a field coordinator cannot edit lists');
select throws_ok($$ insert into public.import_jobs (organization_id, entity, file_name) values (current_setting('t.a')::uuid, 'lookup_values', 'x.csv') $$, '42501', null, 'imports need data.import');
select throws_ok($$ insert into public.storage_files (organization_id, provider, name, mime, size_bytes, status) values (current_setting('t.a')::uuid, 'r2', 'a.pdf', 'application/pdf', 10, 'ready') $$, '42501', null, 'files start as pending');

-- AI allowance (service level).
reset role;
select is(public.ai_consume(current_setting('t.a')::uuid, 90, 100) and not public.ai_consume(current_setting('t.a')::uuid, 20, 100), true, 'AI units stop at the monthly allowance');

select * from finish();
rollback;
