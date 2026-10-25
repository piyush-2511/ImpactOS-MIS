-- pgTAP checks for migration 0005 (plans, subscriptions, invoices, payments, support grants, tickets).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-0000000005a1', 'sec@a5.example', now()),
  ('00000000-0000-0000-0000-0000000005a2', 'admin@a5.example', now()),
  ('00000000-0000-0000-0000-0000000005a3', 'field@a5.example', now()),
  ('00000000-0000-0000-0000-0000000005f1', 'staff@impactos.example', now());
insert into public.platform_staff (user_id, role) values ('00000000-0000-0000-0000-0000000005f1', 'support');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","aal":"aal2"}';
select set_config('t.org', public.create_organization('Org A5', 'org-a5', 'trust', 'Bihar')::text, true);
select is((select status from public.subscriptions where organization_id = current_setting('t.org')::uuid), 'trialing', 'a new organisation starts a trial');
select is((select plan_key from public.subscriptions where organization_id = current_setting('t.org')::uuid), 'growth', 'the trial has Growth features');
select ok((select trial_ends_at from public.subscriptions where organization_id = current_setting('t.org')::uuid) between now() + interval '29 days' and now() + interval '31 days', 'the trial lasts 30 days');
select is(public.plan_allows(current_setting('t.org')::uuid, 'hr'), true, 'Growth includes HR');
select is(public.org_limit(current_setting('t.org')::uuid, 'staff_seats'), 15, 'Growth allows 15 staff seats');

-- Add an Admin and a self-service field worker.
reset role;
insert into public.organization_members (organization_id, user_id) values
  (current_setting('t.org')::uuid, '00000000-0000-0000-0000-0000000005a2'), (current_setting('t.org')::uuid, '00000000-0000-0000-0000-0000000005a3');
insert into public.member_roles (member_id, role_id, organization_id)
  select m.id, r.id, m.organization_id from public.organization_members m, public.roles r
   where m.user_id = '00000000-0000-0000-0000-0000000005a2' and r.is_system and r.key = 'admin'
  union all
  select m.id, r.id, m.organization_id from public.organization_members m, public.roles r
   where m.user_id = '00000000-0000-0000-0000-0000000005a3' and r.is_system and r.key = 'self_service';
select is(public.staff_seats_used(current_setting('t.org')::uuid), 2, 'self-service people do not use staff seats');

-- An issued invoice with one line (as the invoice-run job would create it).
insert into public.invoices (id, organization_id, number, status, period_start, period_end, plan_key, issued_at, due_at, subtotal_paise, total_paise)
values ('00000000-0000-0000-0000-00000000aaa1', current_setting('t.org')::uuid, 'IOS/2026-27/0001', 'draft', '2026-11-01', '2026-11-30', 'growth', now(), now() + interval '10 days', 599900, 599900);
insert into public.invoice_lines (invoice_id, kind, description, quantity, unit_paise, amount_paise) values ('00000000-0000-0000-0000-00000000aaa1', 'plan', 'Growth plan, November 2026', 1, 599900, 599900);
update public.invoices set status = 'issued' where id = '00000000-0000-0000-0000-00000000aaa1';
insert into public.invoices (organization_id, status, period_start, period_end, plan_key) values (current_setting('t.org')::uuid, 'draft', '2026-12-01', '2026-12-31', 'growth');

select throws_ok($$ update public.invoices set total_paise = 1 where id = '00000000-0000-0000-0000-00000000aaa1' $$, '42501', null, 'issued invoice amounts cannot change');
select throws_ok($$ insert into public.invoice_lines (invoice_id, kind, description, unit_paise, amount_paise) values ('00000000-0000-0000-0000-00000000aaa1', 'manual', 'x', 1, 1) $$, '42501', null, 'lines cannot be added to an issued invoice');

-- Secretary: sees the issued invoice, not the draft; pays by UTR.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","aal":"aal2"}';
select is((select count(*)::int from public.invoices), 1, 'Secretary sees issued invoices only (no drafts)');
select is((select count(*)::int from public.invoice_lines), 1, 'and their lines');
select lives_ok($$ select public.submit_invoice_payment('00000000-0000-0000-0000-00000000aaa1', 599900, 'upi', '629104812233', current_date) $$, 'Secretary submits a UPI reference');
select throws_ok($$ select public.submit_invoice_payment('00000000-0000-0000-0000-00000000aaa1', 599900, 'upi', '629104812233', current_date) $$, '23505', null, 'the same UTR cannot be used twice');
select throws_ok($$ select public.submit_invoice_payment('00000000-0000-0000-0000-00000000aaa1', 599900, 'upi', 'X1', current_date) $$, '23514', null, 'UTR format is checked');
update public.subscriptions set plan_key = 'enterprise';
select is((select plan_key from public.subscriptions where organization_id = current_setting('t.org')::uuid), 'growth', 'NGOs cannot change their own subscription directly');

-- Admin: "everything except billing".
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a2","aal":"aal2"}';
select is((select count(*)::int from public.invoices), 0, 'Admin cannot see invoices');
select throws_ok($$ select public.submit_invoice_payment('00000000-0000-0000-0000-00000000aaa1', 1, 'upi', 'ABC123456', current_date) $$, '42501', null, 'Admin cannot submit payments');
select throws_ok($$ select public.grant_support_access(current_setting('t.org')::uuid, 4, 'help please') $$, '42501', null, 'Admin cannot grant support access');

-- Support access.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005f1","aal":"aal2"}';
select is((select count(*)::int from public.organization_members where organization_id = current_setting('t.org')::uuid), 0, 'staff see no organisation data without a grant');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","aal":"aal2"}';
select throws_ok($$ select public.grant_support_access(current_setting('t.org')::uuid, 5, 'bad hours') $$, '22023', null, 'grant length must be 4, 24 or 72 hours');
select set_config('t.grant', public.grant_support_access(current_setting('t.org')::uuid, 4, 'Import fails on Hindi names')::text, true);
select ok((select count(*) from public.audit_events where action = 'support.access_granted') = 1, 'the grant is in the NGO activity log');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005f1","aal":"aal2"}';
select is((select count(*)::int from public.organization_members where organization_id = current_setting('t.org')::uuid), 3, 'with a grant, verified staff can read members');
select throws_ok($$ update public.organization_members set status = 'deactivated' where user_id = '00000000-0000-0000-0000-0000000005a3' $$, '42501', null, 'support staff can never change organisation data');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005f1","aal":"aal1"}';
select is((select count(*)::int from public.organization_members where organization_id = current_setting('t.org')::uuid), 0, 'without two-step verification the grant does not apply');
update public.plans set monthly_paise = 1 where key = 'starter';
select is((select monthly_paise from public.plans where key = 'starter'), 199900::bigint, 'unverified staff cannot edit plans');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a1","aal":"aal2"}';
select lives_ok($$ select public.revoke_support_access(current_setting('t.grant')::uuid) $$, 'Secretary revokes access');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005f1","aal":"aal2"}';
select is((select count(*)::int from public.organization_members where organization_id = current_setting('t.org')::uuid), 0, 'revoking ends access at once');

-- Staff billing work.
select lives_ok($$ update public.invoices set status = 'paid', paid_paise = total_paise, paid_at = now() where id = '00000000-0000-0000-0000-00000000aaa1' $$, 'verified staff mark an invoice paid');
select lives_ok($$ update public.subscriptions set status = 'read_only' where organization_id = current_setting('t.org')::uuid $$, 'staff can set an organisation read-only');
select is(public.is_read_only(current_setting('t.org')::uuid), true, 'read-only status is reported');

-- Tickets.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a3","aal":"aal1"}';
select lives_ok($$ insert into public.support_tickets (organization_id, subject, body) values (current_setting('t.org')::uuid, 'Cannot upload', 'Upload stops at 50%') $$, 'a member opens a ticket');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005a2","aal":"aal2"}';
select is((select count(*)::int from public.support_tickets), 0, 'tickets are private to the person who opened them');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000005f1","aal":"aal2"}';
select is((select count(*)::int from public.support_tickets), 1, 'staff see tickets');

select * from finish();
rollback;
