import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss, { type Root } from "postcss";
import tailwind from "@tailwindcss/postcss";
import { THEMES } from "@/lib/slides/themes";

let stylesheet: Root;
function declarations(selector: string) {
  const result: Record<string, string> = {};
  stylesheet.walkRules(selector, (rule) => {
    rule.walkDecls((declaration) => { result[declaration.prop] = declaration.value; });
  });
  return result;
}
beforeAll(async () => {
  const filename = path.resolve("src/app/globals.css");
  const result = await postcss([tailwind({ optimize: false })])
    .process(readFileSync(filename, "utf8"), { from: filename });
  stylesheet = result.root;
});

describe("Tailwind stylesheet integration", () => {
  it("compiles the existing semantic theme, opacity modifiers and radius scale", () => {
    expect(declarations(".bg-background")["background-color"]).toBe("hsl(var(--background))");
    expect(declarations(".text-primary").color).toBe("hsl(var(--primary))");
    expect(declarations(".bg-primary\\/20")["background-color"]).toContain("hsl(var(--primary)) 20%");
    expect(declarations(".rounded-sm")["border-radius"]).toBe("calc(var(--radius) - 4px)");
    expect(declarations(".rounded-md")["border-radius"]).toBe("calc(var(--radius) - 2px)");
    expect(declarations(".rounded-lg")["border-radius"]).toBe("var(--radius)");
  });

  it("keeps dark mode driven by the class toggle and visible keyboard focus", () => {
    expect(declarations(".dark")["--background"]).toBe("222.2 84% 4.9%");
    expect(declarations(".dark\\:text-red-400:where(.dark, .dark *)").color).toBeTruthy();
    expect(declarations(":focus-visible")["--tw-ring-color"]).toBe("hsl(var(--ring))");
    expect(declarations(".outline-hidden").outline).toBe("2px solid transparent");
    expect(stylesheet.toString()).toContain("@media (forced-colors: active)");
    expect(declarations(".shadow-xs")["--tw-shadow"]).toContain("0 1px 2px 0");
    expect(declarations(".shadow-sm")["--tw-shadow"]).toContain("0 1px 3px 0");
  });

  it("keeps pressed-button scale animated and the dashboard blur at eight pixels", () => {
    const transition = declarations(".transition-\\[color\\,background-color\\,border-color\\,transform\\,scale\\]");
    expect(transition["transition-property"]).toContain("scale");
    expect(declarations(".active\\:scale-\\[0\\.97\\]:active").scale).toBe("0.97");
    expect(declarations(".backdrop-blur-sm")["--tw-backdrop-blur"]).toContain("--blur-sm");
    expect(stylesheet.toString()).toContain("--blur-sm: 8px");
  });

  it("scans library slide-theme tokens and preserves sRGB gradients", () => {
    for (const theme of Object.values(THEMES)) {
      for (const token of Object.values(theme).flatMap((value) => value.split(" "))) {
        const selector = `.${token.replace(/[^\w-]/g, "\\$&")}`;
        expect(Object.keys(declarations(selector)).length, token).toBeGreaterThan(0);
      }
    }
    expect(declarations(".bg-linear-to-br\\/srgb")["--tw-gradient-position"]).toContain("in srgb");
  });
});
