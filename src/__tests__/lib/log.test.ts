import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { log } from "@/lib/log";
import { setErrorReporter, NoopErrorReporter } from "@/lib/reporting";

let stdout: string[];
let stderr: string[];

beforeEach(() => {
  stdout = [];
  stderr = [];
  vi.spyOn(process.stdout, "write").mockImplementation((s: string | Uint8Array) => {
    stdout.push(String(s));
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
    stderr.push(String(s));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  setErrorReporter(new NoopErrorReporter());
});

describe("log", () => {
  it("emits one JSON line with level/time/msg and fields to stdout", () => {
    log.info("hello", { a: 1 });
    expect(stdout).toHaveLength(1);
    const obj = JSON.parse(stdout[0]);
    expect(obj.level).toBe("info");
    expect(obj.msg).toBe("hello");
    expect(obj.a).toBe(1);
    expect(typeof obj.time).toBe("string");
  });

  it("routes warn/error to stderr and serializes Error fields", () => {
    log.warn("oops", { err: new Error("boom") });
    expect(stderr).toHaveLength(1);
    const obj = JSON.parse(stderr[0]);
    expect(obj.err.name).toBe("Error");
    expect(obj.err.message).toBe("boom");
    expect(typeof obj.err.stack).toBe("string");
  });

  it("suppresses messages below LOG_LEVEL", () => {
    vi.stubEnv("LOG_LEVEL", "warn");
    log.info("nope");
    log.debug("also nope");
    expect(stdout).toHaveLength(0);
    log.error("yep");
    expect(stderr).toHaveLength(1);
  });

  it("child() merges bindings into every line", () => {
    log.child({ requestId: "r1" }).info("x");
    expect(JSON.parse(stdout[0]).requestId).toBe("r1");
  });

  it("log.error fans out to the active error reporter exactly once", () => {
    const captureException = vi.fn();
    setErrorReporter({ captureException, captureMessage: vi.fn() });
    const e = new Error("bad");
    log.error("failed", { err: e });
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(e);
  });
});
