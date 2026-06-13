import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  resolveTheme,
  applyTheme,
  getTheme,
  setTheme,
  nextTheme,
  __resetThemeForTests,
  THEME_KEY,
} from "@/lib/theme";

beforeEach(() => {
  __resetThemeForTests();
  document.documentElement.classList.remove("dark");
});

describe("resolveTheme", () => {
  it("returns explicit themes unchanged", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("resolves system against matchMedia", () => {
    const orig = window.matchMedia;
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true } as MediaQueryList) as typeof window.matchMedia;
    expect(resolveTheme("system")).toBe("dark");
    window.matchMedia = orig;
    expect(resolveTheme("system")).toBe("light"); // default mock: matches=false
  });
});

describe("applyTheme", () => {
  it("toggles the dark class on <html>", () => {
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});

describe("setTheme / getTheme", () => {
  it("persists, applies, and reflects the chosen theme", () => {
    setTheme("dark");
    expect(getTheme()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(THEME_KEY, "dark");
  });
});

describe("nextTheme", () => {
  it("cycles light → dark → system → light", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
    expect(nextTheme("system")).toBe("light");
  });
});
