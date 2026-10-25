-- pgTAP checks for migration 0002 (tenancy isolation and auth guards). Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures: two verified users with their own organisations, one unverified user, one outsider.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'asha@a.example', now(), '{"full_name":"Asha","locale":"hi"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bina@b.example', now(), '{"full_name":"Bina"}'),
  ('00000000-0000-0000-0000-00000000000c', 'chetan@a.example', null, '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'dev@a.example', now(), '{}');

select is((select locale from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'hi',
  'profile is created from sign-up metadata');

-- As Asha: create organisation A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","email":"asha@a.example"}';
select lives_ok($$ select public.create_organization('Asha Foundation', 'asha-foundation', 'trust', 'Bihar') $$,
  'verified user can create an organisation');
select is((select base_role from public.organization_members where user_id = '00000000-0000-0000-0000-00000000000a'), 'secretary',
  'creator becomes Secretary');
select set_config('test.org_a', (select id::text from public.organizations where slug = 'asha-foundation'), true);
select throws_ok($$ select public.create_organization('Copy', 'asha-foundation', 'trust', 'Bihar') $$, '23505', null,
  'taken slug is refused');
select throws_ok($$ select public.create_organization('Bad', 'console', 'trust', 'Bihar') $$, '23505', null,
  'reserved slug is refused');
select is(public.slug_available('Asha-Foundation'), false, 'slug availability is case-insensitive');

-- Asha invites Dev (member) and Chetan.
insert into public.invitations (organization_id, email, role_key, token_hash)
  select id, 'dev@a.example', 'member', repeat('a', 64) from public.organizations where slug = 'asha-foundation';
insert into public.invitations (organization_id, email, role_key, token_hash, expires_at)
  select id, 'old@a.example', 'member', repeat('b', 64), now() - interval '1 day' from public.organizations where slug = 'asha-foundation';
select is((select count(*)::int from public.invitations), 2, 'Secretary sees her invitations');

-- As Bina: create organisation B; must not see A.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","email":"bina@b.example"}';
select lives_ok($$ select public.create_organization('Bina Trust', 'bina-trust', 'society', 'Jharkhand') $$, 'second org created');
select is((select count(*)::int from public.organizations), 1, 'user of org B sees only org B');
select is((select count(*)::int from public.organizations where slug = 'asha-foundation'), 0, 'org A is invisible to org B');
select is((select count(*)::int from public.organization_members), 1, 'org B sees only its own members');
select is((select count(*)::int from public.invitations), 0, 'org B cannot read org A invitations');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 0,
  'profiles of other organisations are hidden');
select throws_ok($$ insert into public.organizations (name, slug, legal_form, state) values ('X', 'x-org', 'trust', 'Bihar') $$,
  '42501', null, 'direct inserts into organizations are refused');
select throws_ok($$ update public.profiles set must_change_password = false where id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501', null, 'users cannot clear must_change_password themselves');
select throws_ok($$ update public.profiles set last_org_id = current_setting('test.org_a')::uuid
  where id = '00000000-0000-0000-0000-00000000000b' $$, '42501', null, 'last_org_id must be an organisation the user belongs to');

-- Username lookup does not leak across organisations.
reset role;
insert into public.username_accounts (organization_id, username, user_id)
  select id, 'sunita.k', '00000000-0000-0000-0000-00000000000d' from public.organizations where slug = 'asha-foundation';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","email":"bina@b.example"}';
select is((select count(*)::int from public.username_accounts), 0, 'org B cannot see org A usernames');

-- Unverified user cannot create an organisation.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","email":"chetan@a.example"}';
select throws_ok($$ select public.create_organization('C', 'chetan-org', 'trust', 'Bihar') $$, '42501', null,
  'unverified email cannot create an organisation');
select throws_ok($$ select public.accept_invitation(repeat('a', 64)) $$, '42501', null,
  'invitation for another email cannot be accepted');

-- Dev accepts his invitation; expired one is refused.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","email":"dev@a.example"}';
select is((select state from public.get_invitation(repeat('a', 64))), 'open', 'invitation preview works');
select lives_ok($$ select public.accept_invitation(repeat('a', 64)) $$, 'invited user accepts');
select throws_ok($$ select public.accept_invitation(repeat('a', 64)) $$, 'P0001', null, 'invitation is single use');
select throws_ok($$ select public.accept_invitation(repeat('b', 64)) $$, 'P0001', null, 'expired invitation is refused');

-- Last Secretary guard.
reset role;
select throws_ok($$ update public.organization_members set status = 'deactivated'
  where user_id = '00000000-0000-0000-0000-00000000000a' $$, 'P0001', null, 'the last active Secretary cannot be deactivated');

select * from finish();
rollback;
