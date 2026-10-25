/** Error codes are i18n keys under `admin.errors` (shared by later modules through their own namespaces). */
export type ErrorCode =
  'unauthenticated' | 'forbidden' | 'noOrganisation' | 'invalid' | 'notFound' | 'conflict' | 'generic';

export class ActionError extends Error {
  constructor(
    public code: ErrorCode | string,
    message?: string,
    /** Per-field i18n keys, e.g. when a handler validates against data it loaded (custom field definitions). */
    public fieldErrors?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = 'ActionError';
  }
}

/** Maps Postgres / PostgREST errors to action error codes. Never leaks database messages to the browser. */
export function fromPgError(error: { code?: string; message?: string } | null | undefined): ErrorCode {
  switch (error?.code) {
    case '42501':
      return 'forbidden';
    case '23505':
      return 'conflict';
    case 'P0002':
    case 'PGRST116':
      return 'notFound';
    case '22023':
    case '23514':
    case '23502':
      return 'invalid';
    default:
      return 'generic';
  }
}
