import 'server-only';
import { z } from 'zod';
import { cachedRun, inputHash, saveRun } from './cache';
import { redactPII } from './redact';
import { consumeUnits } from './throttle';

export type GenerateRequest = { system: string; input: string; jsonSchema: Record<string, unknown> };
export type GenerateResult = { text: string; tokensIn: number; tokensOut: number; model: string };

/** One AI vendor. Swappable: ImpactOS code only calls generateJson(). */
export interface AiProvider {
  readonly name: string;
  generate(req: GenerateRequest): Promise<GenerateResult>;
}

export class AiError extends Error {
  constructor(public code: 'disabled' | 'allowance' | 'provider' | 'invalidOutput') {
    super(code);
  }
}

async function provider(): Promise<AiProvider> {
  if (!process.env.AI_API_KEY) throw new AiError('disabled');
  const { GeminiProvider } = await import('./gemini');
  return new GeminiProvider(process.env.AI_API_KEY, process.env.AI_MODEL || 'gemini-2.5-flash');
}

/**
 * Structured AI output: redact PII → reuse a cached answer for the same input → check the monthly allowance →
 * call the provider → validate against the zod schema → cache. Callers never see raw provider output.
 * Drafts only: features must show AI output for a person to accept (AI never overwrites staff text).
 */
export async function generateJson<S extends z.ZodType>(opts: {
  orgId: string;
  userId?: string;
  purpose: string;
  system: string;
  input: string;
  schema: S;
  names?: string[];
  allowance?: number;
}): Promise<{ data: z.infer<S>; cached: boolean }> {
  const { text } = redactPII(opts.input, opts.names);
  const hash = await inputHash(opts.purpose, opts.system, text);
  const hit = await cachedRun(opts.orgId, opts.purpose, hash);
  if (hit) {
    const parsed = opts.schema.safeParse(hit);
    if (parsed.success) return { data: parsed.data, cached: true };
  }
  const estimate = Math.ceil((opts.system.length + text.length) / 4 / 1000) + 1; // ~1 unit per 1k tokens
  if (!(await consumeUnits(opts.orgId, estimate, opts.allowance))) throw new AiError('allowance');
  const ai = await provider();
  let out: GenerateResult;
  try {
    out = await ai.generate({
      system: opts.system,
      input: text,
      jsonSchema: z.toJSONSchema(opts.schema) as Record<string, unknown>,
    });
  } catch {
    throw new AiError('provider');
  }
  let json: unknown;
  try {
    json = JSON.parse(out.text);
  } catch {
    throw new AiError('invalidOutput');
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new AiError('invalidOutput');
  await saveRun({
    orgId: opts.orgId,
    purpose: opts.purpose,
    hash,
    model: out.model,
    output: parsed.data,
    units: Math.ceil((out.tokensIn + out.tokensOut) / 1000),
    userId: opts.userId,
  });
  return { data: parsed.data, cached: false };
}
