import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { __resetThemeForTests } from "@/lib/theme";

beforeEach(() => {
  __resetThemeForTests();
  document.documentElement.classList.remove("dark");
});

describe("ThemeToggle (#62)", () => {
  it("starts on system and cycles through themes on click, updating <html>", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");

    // default (no stored value) → system
    expect(btn.getAttribute("aria-label")).toContain("System theme");

    // system → light
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toContain("Light theme");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // light → dark
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toContain("Dark theme");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // dark → system (matchMedia mock = not dark)
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-label")).toContain("System theme");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
