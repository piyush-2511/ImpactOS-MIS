import * as Sentry from '@sentry/nextjs';

export async function register() {
  // Fail fast on bad configuration: importing env validates it.
  await import('./src/config/env');
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { serverEnv } = await import('./src/config/env');
    serverEnv();
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
