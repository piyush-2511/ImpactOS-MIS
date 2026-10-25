'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRightPanel } from '@/components/shell/RightPanelContext';
import { revokeInvitationAction, setMemberStatusAction } from '../actions';
import type { InvitationRow, MemberRow, RoleOption } from '../queries';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { RoleAssign } from './RoleAssign';
import { ScopeEditor } from './ScopeEditor';
import { CustomFieldsSection } from '@/components/patterns/CustomFieldsSection';
import { optionLabel } from '@/lib/fields/merge';
import type { ResolvedField } from '@/lib/fields/types';
import { saveMemberCustomFieldsAction } from '../actions';

type Props = {
  members: MemberRow[];
  invitations: InvitationRow[];
  roles: RoleOption[];
  canManage: boolean;
  meId: string;
  loginUrl: string;
  dateFmt: Record<string, string>;
  /** Resolved fields for people (Admin → Fields and columns): labels, visible columns, custom fields. */
  fields: ResolvedField[];
  locale: 'en' | 'hi';
};

function StatusButton({ member }: { member: MemberRow }) {
  const t = useTranslations('admin.users');
  const router = useRouter();
  const { close } = useRightPanel();
  const [pending, start] = useTransition();
  const next = member.status === 'active' ? 'deactivated' : 'active';
  return (
    <Button
      type="button"
      variant={next === 'deactivated' ? 'destructive' : 'outline'}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setMemberStatusAction({ memberId: member.id, status: next });
          if (!res.ok) return void toast.error(t(next === 'deactivated' ? 'deactivateFailed' : 'reactivateFailed'));
          toast.success(t(next === 'deactivated' ? 'deactivated' : 'reactivated', { name: member.name }));
          router.refresh();
          close();
        })
      }
    >
      {t(next === 'deactivated' ? 'deactivate' : 'reactivate')}
    </Button>
  );
}

export function MembersTable({
  members,
  invitations,
  roles,
  canManage,
  meId,
  loginUrl,
  dateFmt,
  fields,
  locale,
}: Props) {
  const shown = (key: string) => fields.find((f) => f.key === key && f.showInTable);
  const customCols = fields.filter((f) => !f.builtin && f.showInTable);
  const showCustom = (f: ResolvedField, v: unknown) =>
    v === null || v === undefined || v === ''
      ? '—'
      : Array.isArray(v)
        ? v.map((x) => optionLabel(f, String(x), locale)).join(', ')
        : f.type === 'select'
          ? optionLabel(f, String(v), locale)
          : typeof v === 'boolean'
            ? v
              ? '✓'
              : '—'
            : String(v);
  const t = useTranslations('admin');
  const router = useRouter();
  const { open } = useRightPanel();
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const match = (m: MemberRow) =>
    !q || [m.name, m.email, m.username].some((v) => v?.toLowerCase().includes(q.toLowerCase()));
  const active = useMemo(() => members.filter((m) => m.status === 'active' && match(m)), [members, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const inactive = useMemo(() => members.filter((m) => m.status === 'deactivated' && match(m)), [members, q]); // eslint-disable-line react-hooks/exhaustive-deps

  function openMember(m: MemberRow) {
    const isMe = m.userId === meId;
    const scopeAll = m.roles.some(
      (r) => roles.find((o) => o.id === r.id)?.defaultScope === 'all' || r.key === 'secretary',
    );
    open({
      title: m.name,
      subtitle: m.username ?? m.email ?? undefined,
      body: (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t('users.signIn')}</dt>
              <dd className="font-semibold">{t(m.kind === 'username' ? 'users.kindUsername' : 'users.kindEmail')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('users.joined')}</dt>
              <dd className="font-semibold">{dateFmt[m.id]}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">{t('users.positions')}</dt>
              <dd className="font-semibold">{m.positions.join(', ') || '—'}</dd>
            </div>
          </dl>
          {canManage && !isMe && m.status === 'active' ? (
            <RoleAssign memberId={m.id} current={m.roles.map((r) => r.id)} roles={mergeRoles(roles, m)} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">{t('users.roles')}</span>
              <div className="flex flex-wrap gap-1.5">
                {m.roles.map((r) => (
                  <Badge key={r.id} tone="info">
                    {r.name}
                  </Badge>
                ))}
              </div>
              {isMe && <p className="text-xs text-muted-foreground">{t('users.cannotEditSelf')}</p>}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t('users.scope')}</span>
            <ScopeEditor
              memberId={m.id}
              hasAllScope={scopeAll}
              programs={[]}
              branches={[]}
              current={[]}
              disabled={!canManage || isMe}
            />
          </div>
          <CustomFieldsSection
            fields={fields}
            values={m.customFields}
            editable={canManage && m.status === 'active'}
            locale={locale}
            onSave={(values) => saveMemberCustomFieldsAction({ memberId: m.id, values })}
          />
          {canManage && !isMe && (
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              {m.kind === 'username' && m.status === 'active' && (
                <ResetPasswordDialog memberId={m.id} name={m.name} loginUrl={loginUrl} />
              )}
              <StatusButton member={m} />
            </div>
          )}
        </div>
      ),
    });
  }

  const table = (rows: MemberRow[]) =>
    rows.length === 0 ? (
      <p className="rounded-xl bg-card p-6 text-center text-muted-foreground">
        {q ? t('users.noMatch') : t('users.empty')}
      </p>
    ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{shown('name')?.label ?? t('users.colName')}</TableHead>
            {shown('kind') && <TableHead>{shown('kind')!.label}</TableHead>}
            {shown('roles') && <TableHead>{shown('roles')!.label}</TableHead>}
            {shown('positions') && <TableHead>{shown('positions')!.label}</TableHead>}
            {shown('joined_at') && <TableHead>{shown('joined_at')!.label}</TableHead>}
            {customCols.map((f) => (
              <TableHead key={f.key}>{f.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow
              key={m.id}
              tabIndex={0}
              className="cursor-pointer"
              onClick={() => openMember(m)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openMember(m);
                }
              }}
              aria-label={t('users.openMember', { name: m.name })}
            >
              <TableCell>
                <div className="font-semibold">
                  {m.name}
                  {m.userId === meId && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{t('users.you')}</span>
                  )}
                </div>
                <div className="font-mono text-xs text-muted-foreground">{m.username ?? m.email}</div>
              </TableCell>
              {shown('kind') && (
                <TableCell>
                  <Badge tone={m.kind === 'username' ? 'idea' : 'neutral'}>
                    {t(m.kind === 'username' ? 'users.kindUsername' : 'users.kindEmail')}
                  </Badge>
                </TableCell>
              )}
              {shown('roles') && (
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {m.roles.map((r) => (
                      <Badge key={r.id} tone="info">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              )}
              {shown('positions') && <TableCell className="text-sm">{m.positions.join(', ') || '—'}</TableCell>}
              {shown('joined_at') && <TableCell className="whitespace-nowrap text-sm">{dateFmt[m.id]}</TableCell>}
              {customCols.map((f) => (
                <TableCell key={f.key} className="text-sm">
                  {showCustom(f, m.customFields[f.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3">
        <label className="flex-1">
          <span className="sr-only">{t('users.search')}</span>
          <Input type="search" placeholder={t('users.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className="text-sm text-muted-foreground">
          {t('users.count', { active: members.filter((m) => m.status === 'active').length })}
        </span>
      </div>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t('users.tabActive', { n: active.length })}</TabsTrigger>
          <TabsTrigger value="invitations">{t('users.tabInvitations', { n: invitations.length })}</TabsTrigger>
          <TabsTrigger value="inactive">{t('users.tabInactive', { n: inactive.length })}</TabsTrigger>
        </TabsList>
        <TabsContent value="active">{table(active)}</TabsContent>
        <TabsContent value="inactive">{table(inactive)}</TabsContent>
        <TabsContent value="invitations">
          {invitations.length === 0 ? (
            <p className="rounded-xl bg-card p-6 text-center text-muted-foreground">{t('users.noInvitations')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.email')}</TableHead>
                  <TableHead>{t('fields.role')}</TableHead>
                  <TableHead>{t('users.colStatus')}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('users.colActions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((i) => {
                  const expired = i.expired;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-sm">{i.email}</TableCell>
                      <TableCell>{i.roleName}</TableCell>
                      <TableCell>
                        <Badge tone={expired ? 'warn' : 'info'}>{t(expired ? 'users.expired' : 'users.pending')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                const res = await revokeInvitationAction({ invitationId: i.id });
                                if (res.ok) {
                                  toast.success(t('users.revoked'));
                                  router.refresh();
                                } else toast.error(t(`errors.${res.error}`));
                              })
                            }
                          >
                            {t('users.revoke')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Keep roles a member already holds visible even if the current admin may not assign them (e.g. Secretary). */
function mergeRoles(assignable: RoleOption[], m: MemberRow): RoleOption[] {
  const extra = m.roles
    .filter((r) => !assignable.some((a) => a.id === r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      key: r.key,
      isSystem: true,
      description: null,
      defaultScope: 'all' as const,
    }));
  return [...assignable, ...extra];
}
