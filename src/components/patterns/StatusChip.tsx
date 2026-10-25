import { Badge } from '@/components/ui/badge';

type Tone = 'neutral' | 'ok' | 'info' | 'warn' | 'bad' | 'idea';
/** Sensible tones for common status keys; pass `tone` to override. Always shows text (never colour alone). */
const DEFAULT_TONES: Record<string, Tone> = {
  active: 'ok',
  approved: 'ok',
  done: 'ok',
  paid: 'ok',
  published: 'ok',
  completed: 'ok',
  ready: 'ok',
  successful: 'ok',
  committed: 'ok',
  yes: 'ok',
  pending: 'info',
  in_progress: 'info',
  scheduled: 'info',
  submitted: 'info',
  open: 'info',
  validated: 'info',
  committing: 'info',
  draft: 'idea',
  idea: 'idea',
  due: 'warn',
  overdue: 'warn',
  expired: 'warn',
  sent_back: 'warn',
  missing: 'warn',
  on_hold: 'warn',
  rejected: 'bad',
  failed: 'bad',
  cancelled: 'bad',
  deactivated: 'bad',
  deleted: 'bad',
  no: 'bad',
  undone: 'neutral',
};

export function StatusChip({ status, label, tone }: { status: string; label: string; tone?: Tone }) {
  return <Badge tone={tone ?? DEFAULT_TONES[status] ?? 'neutral'}>{label}</Badge>;
}
