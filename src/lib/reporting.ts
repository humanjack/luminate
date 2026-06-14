/**
 * Vendor-neutral error-reporting seam.
 *
 * Shaped to match the common `captureException`/`captureMessage` surface (e.g.
 * `@sentry/node`) so a real adapter is a thin wrapper registered later from
 * `instrumentation.ts`. The default reporter is a no-op — NO vendor SDK, DSN, or
 * network call ships by default. `log.error` fans out to the active reporter.
 */
export interface ErrorContext {
  [key: string]: unknown;
}

export interface ErrorReporter {
  captureException(error: unknown, context?: ErrorContext): void;
  captureMessage(message: string, context?: ErrorContext): void;
}

export class NoopErrorReporter implements ErrorReporter {
  captureException(): void {}
  captureMessage(): void {}
}

let current: ErrorReporter = new NoopErrorReporter();

export function setErrorReporter(reporter: ErrorReporter): void {
  current = reporter;
}

export function getErrorReporter(): ErrorReporter {
  return current;
}
