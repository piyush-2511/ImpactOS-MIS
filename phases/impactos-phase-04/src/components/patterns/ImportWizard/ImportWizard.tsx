'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  commitImportAction,
  importErrorsAction,
  importTemplateAction,
  startImportAction,
  undoImportAction,
  validateImportAction,
} from '@/lib/import/actions';
import type { RowError } from '@/lib/import/validate';
import { downloadBase64 } from '../ExportMenu';
import { MapColumns, type ImportField } from './MapColumns';
import { ValidatePreview } from './ValidatePreview';

type Step = 'upload' | 'map' | 'preview' | 'done';
const CODES = [
  'required',
  'number',
  'date',
  'boolean',
  'email',
  'phone',
  'option',
  'tooLong',
  'duplicateInFile',
  'notImportable',
  'skippedExisting',
] as const;

/**
 * Import menu for a list page: "Download sample" (XLSX/CSV built from the current fields) and the import wizard:
 * upload → map columns → check → import. Imports only add records, skip keys that already exist, and can be undone
 * for 24 hours.
 */
export function ImportWizard({
  entity,
  context = {},
  title,
}: {
  entity: string;
  context?: Record<string, string>;
  title: string;
}) {
  const t = useTranslations('engine.import');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [job, setJob] = useState<{
    jobId: string;
    headers: string[];
    sample: Record<string, string>[];
    total: number;
    fields: ImportField[];
  } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [check, setCheck] = useState<{ valid: number; errorRows: number; errors: RowError[]; total: number } | null>(
    null,
  );
  const [result, setResult] = useState<{ inserted: number; skipped: number; queued: boolean } | null>(null);
  const ctx = JSON.stringify(context);
  const fieldLabels = Object.fromEntries((job?.fields ?? []).map((f) => [f.key, f.label]));

  const reset = () => {
    setStep('upload');
    setJob(null);
    setMapping({});
    setCheck(null);
    setResult(null);
    setError(undefined);
  };
  const sample = (format: 'xlsx' | 'csv') =>
    start(async () => {
      const r = await importTemplateAction({ entity, format });
      if (r.ok) downloadBase64(r.data);
      else toast.error(t(`errors.${r.error}`));
    });

  function upload(fd: FormData) {
    setError(undefined);
    fd.set('entity', entity);
    fd.set('context', ctx);
    start(async () => {
      const r = await startImportAction(fd);
      if (!r.ok) return void setError(r.error);
      setJob(r.data);
      setMapping(r.data.mapping);
      setStep('map');
    });
  }
  const validate = () =>
    start(async () => {
      const r = await validateImportAction({ jobId: job!.jobId, mapping });
      if (!r.ok) return void setError(r.error);
      setCheck(r.data);
      setStep('preview');
    });
  const commit = () =>
    start(async () => {
      const r = await commitImportAction({ jobId: job!.jobId });
      if (!r.ok) return void setError(r.error);
      setResult(r.data);
      setStep('done');
      router.refresh();
    });
  const undo = () =>
    start(async () => {
      const r = await undoImportAction({ jobId: job!.jobId });
      if (!r.ok) return void toast.error(t(`errors.${r.error}`));
      toast.success(t('undone', { n: r.data.removed }));
      router.refresh();
      setOpen(false);
      reset();
    });
  const errorsFile = () =>
    start(async () => {
      const labels = Object.fromEntries(CODES.map((c) => [c, t(`codes.${c}`)]));
      const r = await importErrorsAction({ jobId: job!.jobId, labels });
      if (r.ok) downloadBase64(r.data);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            <UploadIcon aria-hidden /> {t('import')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => sample('xlsx')}>{t('sampleXlsx')}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => sample('csv')}>{t('sampleCsv')}</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              reset();
              setOpen(true);
            }}
          >
            {t('importFile')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogTrigger className="hidden" />
        <DialogContent className="w-[min(760px,calc(100%-2rem))]" closeLabel={t('close')}>
          <DialogHeader>
            <DialogTitle>{t('title', { what: title })}</DialogTitle>
            <DialogDescription>{t(`steps.${step}`)}</DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-fg">
              {t(`errors.${error}`)}
            </p>
          )}
          {step === 'upload' && (
            <form action={upload} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t('chooseFile')}
                <Input type="file" name="file" accept=".xlsx,.csv" required />
              </label>
              <p className="text-sm text-muted-foreground">{t('fileRules')}</p>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? t('reading') : t('next')}
                </Button>
              </DialogFooter>
            </form>
          )}
          {step === 'map' && job && (
            <>
              <MapColumns
                headers={job.headers}
                sample={job.sample}
                fields={job.fields}
                mapping={mapping}
                onChange={setMapping}
              />
              <DialogFooter>
                <Button variant="outline" onClick={reset} disabled={pending}>
                  {t('back')}
                </Button>
                <Button onClick={validate} disabled={pending}>
                  {pending ? t('checking') : t('check')}
                </Button>
              </DialogFooter>
            </>
          )}
          {step === 'preview' && check && (
            <>
              <ValidatePreview
                total={check.total}
                valid={check.valid}
                errorRows={check.errorRows}
                errors={check.errors}
                fieldLabels={fieldLabels}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep('map')} disabled={pending}>
                  {t('back')}
                </Button>
                {check.errorRows > 0 && (
                  <Button variant="outline" onClick={errorsFile} disabled={pending}>
                    {t('downloadErrors')}
                  </Button>
                )}
                <Button onClick={commit} disabled={pending || check.valid === 0}>
                  {t('importN', { n: check.valid })}
                </Button>
              </DialogFooter>
            </>
          )}
          {step === 'done' && result && (
            <>
              <p role="status" className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok-fg">
                {result.queued ? t('queued') : t('doneSummary', { inserted: result.inserted, skipped: result.skipped })}
              </p>
              <DialogFooter>
                {!result.queued && result.inserted > 0 && (
                  <Button variant="outline" onClick={undo} disabled={pending}>
                    {t('undo')}
                  </Button>
                )}
                <Button
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  {t('finish')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
