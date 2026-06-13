"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTheme,
  setTheme,
  nextTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";

const ICON = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const LABEL: Record<Theme, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System theme",
};

export function ThemeToggle({ className }: { className?: string }) {
  // getServerSnapshot returns "system" so the SSR markup is stable; the client
  // snapshot reads the real preference right after hydration.
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "system" as Theme);
  const Icon = ICON[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${LABEL[theme]} (click to change)`}
      title={LABEL[theme]}
      onClick={() => setTheme(nextTheme(theme))}
      className={className}
    >
      <Icon className="w-4 h-4" />
    </Button>
  );
}
