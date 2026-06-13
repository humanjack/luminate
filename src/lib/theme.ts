/**
 * Tiny dependency-free theme store. The source of truth is an in-memory
 * `current` value (so it works even where localStorage is unavailable),
 * mirrored to localStorage and to the `dark` class on <html>. Components
 * subscribe via useSyncExternalStore — no setState-in-effect, and SSR uses
 * `getServerSnapshot` ("system") so hydration is stable.
 */

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "luminate-theme";

const listeners = new Set<() => void>();
let current: Theme | null = null;

function readStored(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore (private mode, etc.) */
  }
  return "system";
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Resolve a theme preference to the concrete light/dark to render. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

/** Apply the resolved theme to <html> by toggling the `dark` class. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

export function getTheme(): Theme {
  if (current === null) current = readStored();
  return current;
}

export function setTheme(theme: Theme): void {
  current = theme;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

/** Cycle order for the toggle button. */
export function nextTheme(theme: Theme): Theme {
  const order: Theme[] = ["light", "dark", "system"];
  return order[(order.indexOf(theme) + 1) % order.length];
}

export function subscribeTheme(cb: () => void): () => void {
  listeners.add(cb);

  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) {
      current = readStored();
      applyTheme(current);
      cb();
    }
  };
  const mq =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  const onMq = () => {
    if (getTheme() === "system") {
      applyTheme("system");
      cb();
    }
  };

  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  mq?.addEventListener?.("change", onMq);

  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    mq?.removeEventListener?.("change", onMq);
  };
}

/** For tests: reset the in-memory value. */
export function __resetThemeForTests(): void {
  current = null;
}
