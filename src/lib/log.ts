import { getErrorReporter } from "./reporting";

/**
 * Minimal dependency-free structured logger. Emits one JSON line per call
 * (level, ISO time, msg, ...fields, serialized errors), gated by `LOG_LEVEL`
 * (default info; debug in development). debug/info → stdout, warn/error →
 * stderr. `log.error` also fans out to the active error reporter so a real
 * adapter (Sentry, etc.) needs no call-site changes.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_VALUE: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

function thresholdValue(): number {
  const env = (process.env.LOG_LEVEL ?? "").toLowerCase() as LogLevel;
  if (env in LEVEL_VALUE) return LEVEL_VALUE[env];
  return process.env.NODE_ENV === "development" ? LEVEL_VALUE.debug : LEVEL_VALUE.info;
}

function serializeError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { name: "NonError", message: String(err) };
}

/** Replace any Error-valued field with a serialized form for JSON output. */
function normalizeFields(fields: LogFields): { out: LogFields; firstError?: unknown } {
  const out: LogFields = {};
  let firstError: unknown;
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Error) {
      if (firstError === undefined) firstError = value;
      out[key] = serializeError(value);
    } else {
      out[key] = value;
    }
  }
  return { out, firstError };
}

function emit(level: LogLevel, msg: string, fields: LogFields, bindings: LogFields): void {
  if (LEVEL_VALUE[level] < thresholdValue()) return;
  const { out, firstError } = normalizeFields({ ...bindings, ...fields });
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...out });
  if (level === "warn" || level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");

  if (level === "error") {
    getErrorReporter().captureException(firstError ?? new Error(msg), { msg, ...out });
  }
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

function makeLogger(bindings: LogFields): Logger {
  return {
    debug: (msg, fields = {}) => emit("debug", msg, fields, bindings),
    info: (msg, fields = {}) => emit("info", msg, fields, bindings),
    warn: (msg, fields = {}) => emit("warn", msg, fields, bindings),
    error: (msg, fields = {}) => emit("error", msg, fields, bindings),
    child: (extra) => makeLogger({ ...bindings, ...extra }),
  };
}

export const log: Logger = makeLogger({});
