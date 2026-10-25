/** Every server action returns this shape; forms read `error` / `fieldErrors` (i18n keys) and `data`. */
export type ActionOk<T> = { ok: true; data: T };
export type ActionFail = { ok: false; error: string; fieldErrors?: Record<string, string> };
export type ActionResult<T = null> = ActionOk<T> | ActionFail;

export const ok = <T>(data: T): ActionOk<T> => ({ ok: true, data });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionFail => ({
  ok: false,
  error,
  fieldErrors,
});
