// Sentry integration (disabled - re-add @sentry/nextjs to enable)

const noopSentry = {
  captureException: (error: unknown) => { console.error('[Sentry disabled]', error); },
  captureMessage: (message: string) => { console.warn('[Sentry disabled]', message); },
  init: () => {},
};

export function initSentry() {
  // No-op: @sentry/nextjs is not installed
}

export { noopSentry as Sentry };
