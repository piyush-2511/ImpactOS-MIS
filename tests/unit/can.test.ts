import { describe, expect, it } from 'vitest';
import { ALL, PERMISSIONS, groupByModule, hasPermission } from '@/lib/authz/permissions';
import { inScope } from '@/lib/authz/scope';
import { maskTail } from '@/lib/authz/reveal';
import { fromPgError } from '@/lib/actions/errors';

describe('hasPermission', () => {
  it('matches exact keys only', () => {
    expect(hasPermission(['admin.users.view'], 'admin.users.view')).toBe(true);
    expect(hasPermission(['admin.users.view'], 'admin.users.manage')).toBe(false);
    expect(hasPermission(['admin.users'], 'admin.users.view')).toBe(false);
  });
  it("treats '*' (Secretary) as every permission, including future ones", () => {
    expect(hasPermission([ALL], 'admin.users.manage')).toBe(true);
    expect(hasPermission([ALL], 'fundraising.receipt.cancel')).toBe(true);
  });
  it('denies on empty or missing sets', () => {
    expect(hasPermission([], 'admin.users.view')).toBe(false);
    expect(hasPermission(null, 'admin.users.view')).toBe(false);
  });
});

describe('permission catalogue', () => {
  it('uses module.entity.verb keys that match the database check', () => {
    for (const k of Object.keys(PERMISSIONS)) expect(k).toMatch(/^[a-z]+(\.[a-z_]+)+$/);
  });
  it('marks every pii.* permission as sensitive', () => {
    for (const [k, v] of Object.entries(PERMISSIONS)) if (k.startsWith('pii.')) expect(v.sensitive).toBe(true);
  });
  it('groups keys by module in catalogue order', () => {
    const groups = groupByModule(['pii.bank.reveal', 'admin.users.view', 'org.profile.edit', 'admin.roles.view']);
    expect(groups.map((g) => g.module)).toEqual(['admin', 'organisation', 'privacy']);
    expect(groups[0]!.keys).toEqual(['admin.users.view', 'admin.roles.view']);
  });
});

describe('inScope', () => {
  const p1 = '11111111-1111-1111-1111-111111111111';
  const b1 = '22222222-2222-2222-2222-222222222222';
  it('allows everything for all-scope roles', () => {
    expect(inScope({ all: true, programs: [], branches: [] }, { programId: p1 })).toBe(true);
  });
  it('allows only assigned programs or branches otherwise', () => {
    const s = { all: false, programs: [p1], branches: [b1] };
    expect(inScope(s, { programId: p1 })).toBe(true);
    expect(inScope(s, { branchId: b1 })).toBe(true);
    expect(inScope(s, { programId: 'x' })).toBe(false);
    expect(inScope(s, {})).toBe(false);
  });
});

describe('masking and error mapping', () => {
  it('masks all but the last 4 characters', () => {
    expect(maskTail('123456784821')).toBe('XXXX-XXXX-4821');
    expect(maskTail('1234')).toBe('1234');
    expect(maskTail(null)).toBe('—');
  });
  it('never exposes database messages, only codes', () => {
    expect(fromPgError({ code: '42501', message: 'new row violates row-level security policy' })).toBe('forbidden');
    expect(fromPgError({ code: '23505' })).toBe('conflict');
    expect(fromPgError({ code: 'XX000' })).toBe('generic');
    expect(fromPgError(null)).toBe('generic');
  });
});
