import { describe, it, expect, afterEach } from "vitest";
import {
  getErrorReporter,
  setErrorReporter,
  NoopErrorReporter,
  type ErrorReporter,
} from "@/lib/reporting";

afterEach(() => setErrorReporter(new NoopErrorReporter()));

describe("error reporter seam", () => {
  it("defaults to a no-op reporter", () => {
    expect(getErrorReporter()).toBeInstanceOf(NoopErrorReporter);
    // no-op methods don't throw
    expect(() => getErrorReporter().captureException(new Error("x"))).not.toThrow();
  });

  it("setErrorReporter replaces the active reporter", () => {
    const reporter: ErrorReporter = {
      captureException: () => {},
      captureMessage: () => {},
    };
    setErrorReporter(reporter);
    expect(getErrorReporter()).toBe(reporter);
  });
});
