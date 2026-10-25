-- pgTAP checks for migration 0003 (permissions, roles, escalation guards, scopes, audit). Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'sec@a.example', now()),
  ('00000000-0000-0000-0000-0000000000a2', 'admin@a.example', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'field@a.example', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'sec@b.example', now());

-- Org A by its Secretary; org B by another Secretary.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"sec@a.example"}';
select set_config('t.org_a', public.create_organization('Org A', 'org-a', 'trust', 'Bihar')::text, true);
select is(public.has_permission(current_setting('t.org_a')::uuid, 'admin.users.manage'), true, 'Secretary has every permission');
select is(public.my_permissions(current_setting('t.org_a')::uuid), array['*'], 'Secretary permissions are reported as *');
select is(current_setting('impactos.bootstrap', true), 'off', 'bootstrap flag is switched off after organisation creation');
select is((select email from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'sec@a.example', 'profile email is synced from auth');
select is((select count(*)::int from public.positions where organization_id = current_setting('t.org_a')::uuid and is_secretary), 1, 'Secretary position is created with the organisation');
select is((select count(*)::int from public.position_holders where organization_id = current_setting('t.org_a')::uuid), 1, 'creator holds the Secretary position');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","email":"sec@b.example"}';
select set_config('t.org_b', public.create_organization('Org B', 'org-b', 'society', 'Bihar')::text, true);

-- Add an admin and a field coordinator to org A (as platform setup would; uses service-level inserts).
reset role;
insert into public.organization_members (organization_id, user_id, kind, base_role)
  values (current_setting('t.org_a')::uuid, '00000000-0000-0000-0000-0000000000a2', 'email', 'member'),
         (current_setting('t.org_a')::uuid, '00000000-0000-0000-0000-0000000000a3', 'username', 'member');
select set_config('t.m_admin', (select id::text from public.organization_members where user_id = '00000000-0000-0000-0000-0000000000a2'), true);
select set_config('t.m_field', (select id::text from public.organization_members where user_id = '00000000-0000-0000-0000-0000000000a3'), true);
select set_config('t.m_sec', (select id::text from public.organization_members where user_id = '00000000-0000-0000-0000-0000000000a1'), true);
select set_config('t.r_admin', (select id::text from public.roles where is_system and key = 'admin'), true);
select set_config('t.r_field', (select id::text from public.roles where is_system and key = 'field_coordinator'), true);
select set_config('t.r_sec', (select id::text from public.roles where is_system and key = 'secretary'), true);
select set_config('t.r_self', (select id::text from public.roles where is_system and key = 'self_service'), true);

-- Secretary assigns roles.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"sec@a.example"}';
select lives_ok($$ select public.set_member_roles(current_setting('t.m_admin')::uuid, array[current_setting('t.r_admin')::uuid]) $$, 'Secretary makes someone Admin');
select lives_ok($$ select public.set_member_roles(current_setting('t.m_field')::uuid, array[current_setting('t.r_field')::uuid]) $$, 'Secretary assigns Field Coordinator');
select is((select base_role from public.organization_members where id = current_setting('t.m_admin')::uuid), 'admin', 'base_role follows roles (MFA rule)');
select is((select base_role from public.organization_members where id = current_setting('t.m_field')::uuid), 'member', 'non-MFA roles map to member');

-- Admin: manages people but cannot touch the Secretary role.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","email":"admin@a.example"}';
select is(public.has_permission(current_setting('t.org_a')::uuid, 'admin.users.manage'), true, 'Admin can manage people');
select throws_ok($$ select public.set_member_roles(current_setting('t.m_field')::uuid, array[current_setting('t.r_sec')::uuid]) $$, '42501', null,
  'Admin cannot grant the Secretary role');
select throws_ok($$ select public.set_member_roles(current_setting('t.m_sec')::uuid, array[current_setting('t.r_admin')::uuid]) $$, '42501', null,
  'Admin cannot remove the Secretary role');
select throws_ok($$ select public.set_member_roles(current_setting('t.m_field')::uuid, array[]::uuid[]) $$, '22023', null,
  'a member keeps at least one role');
select throws_ok($$ insert into public.invitations (organization_id, email, role_id, token_hash) values (current_setting('t.org_a')::uuid, 'x@a.example', current_setting('t.r_sec')::uuid, repeat('c', 64)) $$,
  '42501', null, 'nobody can invite someone straight into the Secretary role');
select throws_ok($$ select public.set_member_status(current_setting('t.m_admin')::uuid, 'deactivated') $$, '42501', null,
  'you cannot deactivate yourself');

-- Custom role: clone with a subset of permissions.
select lives_ok($$ insert into public.roles (organization_id, name, default_scope) values (current_setting('t.org_a')::uuid, 'Branch Head', 'assigned') $$, 'Admin creates a custom role');
select lives_ok($$ insert into public.role_permissions (role_id, permission_key) select id, 'admin.users.view' from public.roles where name = 'Branch Head' $$, 'and gives it a permission');
select throws_ok($$ insert into public.role_permissions (role_id, permission_key) values (current_setting('t.r_field')::uuid, 'admin.users.manage') $$, null, null,
  'system role permissions cannot be changed');
update public.roles set name = 'Boss' where id = current_setting('t.r_admin')::uuid;
select is((select name from public.roles where id = current_setting('t.r_admin')::uuid), 'Admin', 'system roles cannot be renamed');

-- Field coordinator: no admin rights, scoped to assigned programs.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","email":"field@a.example"}';
select is(public.has_permission(current_setting('t.org_a')::uuid, 'admin.users.manage'), false, 'Field Coordinator cannot manage people');
select throws_ok($$ select public.set_member_roles(current_setting('t.m_field')::uuid, array[current_setting('t.r_admin')::uuid]) $$, '42501', null,
  'a Field Coordinator cannot promote themselves');
select is(public.in_scope(current_setting('t.org_a')::uuid, '11111111-1111-1111-1111-111111111111'::uuid, null), false, 'unassigned program is out of scope');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"sec@a.example"}';
select lives_ok($$ select public.set_member_scopes(current_setting('t.m_field')::uuid, array['11111111-1111-1111-1111-111111111111'::uuid], null) $$, 'Secretary assigns a program scope');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","email":"field@a.example"}';
select is(public.in_scope(current_setting('t.org_a')::uuid, '11111111-1111-1111-1111-111111111111'::uuid, null), true, 'assigned program is in scope');
select is(public.log_reveal(current_setting('t.org_a')::uuid, 'pii.bank.reveal', 'donors', 'x', 'bank'), false, 'reveal is refused without the permission');

-- Audit trail and isolation.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","email":"sec@a.example"}';
select ok((select count(*) from public.audit_events where organization_id = current_setting('t.org_a')::uuid and table_name = 'member_roles') >= 2, 'role changes are in the audit trail');
select ok((select actor_id from public.audit_events where table_name = 'member_scopes' order by id desc limit 1) = '00000000-0000-0000-0000-0000000000a1', 'audit records who made the change');
select is(public.log_reveal(current_setting('t.org_a')::uuid, 'pii.bank.reveal', 'donors', 'x', 'bank'), true, 'Secretary reveal is allowed');
select is((select action from public.audit_events order by id desc limit 1), 'reveal.bank', 'and logged');
select throws_ok($$ delete from public.audit_events $$, '42501', null, 'nobody can delete the audit trail');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","email":"sec@b.example"}';
select is((select count(*)::int from public.audit_events where organization_id = current_setting('t.org_a')::uuid), 0, 'org B cannot read org A audit trail');

select * from finish();
rollback;
