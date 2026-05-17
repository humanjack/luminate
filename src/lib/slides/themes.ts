export const SLIDE_THEMES = ["default", "dark", "playful"] as const;
export type SlideTheme = (typeof SLIDE_THEMES)[number];

export interface ThemeTokens {
  surface: string;       // background utility classes
  title: string;
  subtitle: string;
  body: string;
  bullet: string;
  accent: string;        // accent color for bullets / dividers
  footer: string;
  code: string;
  codeBlock: string;
}

export const THEMES: Record<SlideTheme, ThemeTokens> = {
  default: {
    surface: "bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-slate-900",
    title: "text-slate-900",
    subtitle: "text-indigo-700",
    body: "text-slate-700",
    bullet: "text-slate-800",
    accent: "bg-indigo-500",
    footer: "text-indigo-700/70",
    code: "bg-indigo-100 text-indigo-900",
    codeBlock: "bg-slate-900 text-slate-50",
  },
  dark: {
    surface: "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-50",
    title: "text-white",
    subtitle: "text-indigo-300",
    body: "text-slate-200",
    bullet: "text-slate-100",
    accent: "bg-indigo-400",
    footer: "text-slate-400",
    code: "bg-slate-800 text-amber-200",
    codeBlock: "bg-black/60 text-emerald-200",
  },
  playful: {
    surface: "bg-gradient-to-br from-amber-100 via-rose-100 to-fuchsia-200 text-slate-900",
    title: "text-fuchsia-900",
    subtitle: "text-rose-700",
    body: "text-slate-800",
    bullet: "text-slate-900",
    accent: "bg-fuchsia-500",
    footer: "text-fuchsia-800",
    code: "bg-fuchsia-100 text-fuchsia-900",
    codeBlock: "bg-slate-900 text-fuchsia-100",
  },
};

export function tokensFor(theme: string | null | undefined): ThemeTokens {
  if (theme && (SLIDE_THEMES as readonly string[]).includes(theme)) {
    return THEMES[theme as SlideTheme];
  }
  return THEMES.default;
}
