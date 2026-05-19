"use client";

import { cn } from "@/lib/utils";
import { parseSlide } from "@/lib/slides/parse";
import { tokensFor, type SlideTheme } from "@/lib/slides/themes";

interface SlideCanvasProps {
  markdown: string;
  theme?: SlideTheme | string | null;
  variant?: "preview" | "thumbnail";
  className?: string;
}

/**
 * Renders a single slide visually at a 16:9 aspect ratio.
 * - `preview` is the large editor canvas; full type sizes.
 * - `thumbnail` is the rail tile; type scales down via container queries.
 */
export function SlideCanvas({
  markdown,
  theme = "default",
  variant = "preview",
  className,
}: SlideCanvasProps) {
  const slide = parseSlide(markdown ?? "");
  const t = tokensFor(theme);
  const isThumb = variant === "thumbnail";

  const titleClass = isThumb
    ? "text-[10px] font-bold leading-tight line-clamp-2"
    : "text-4xl md:text-5xl font-extrabold leading-tight";
  const subtitleClass = isThumb
    ? "text-[8px] font-semibold uppercase tracking-wider mt-0.5"
    : "text-base font-semibold uppercase tracking-wider";
  const bulletClass = isThumb
    ? "text-[7px] leading-tight"
    : "text-xl md:text-2xl leading-snug";
  const bodyClass = isThumb
    ? "text-[7px] leading-tight"
    : "text-lg md:text-xl leading-relaxed";
  const codeClass = isThumb
    ? "text-[6px] rounded px-1 py-0.5"
    : "text-sm rounded-lg p-3 font-mono whitespace-pre overflow-hidden";
  const footerClass = isThumb
    ? "text-[6px] mt-auto"
    : "text-xs uppercase tracking-wider";

  return (
    <div
      className={cn(
        "relative w-full aspect-video rounded-lg border overflow-hidden flex flex-col",
        t.surface,
        isThumb ? "p-2" : "p-10",
        className
      )}
      data-testid={isThumb ? "slide-thumbnail" : "slide-preview"}
    >
      {slide.subtitle && (
        <p className={cn(subtitleClass, t.subtitle)}>{slide.subtitle}</p>
      )}

      {slide.title && (
        <h1 className={cn(titleClass, t.title, isThumb ? "mt-0.5" : "mt-1")}>
          {slide.title}
        </h1>
      )}

      <div className={cn("flex-1 mt-2 flex flex-col gap-1", isThumb ? "gap-0.5 mt-1" : "gap-2 mt-4")}>
        {slide.bullets.length > 0 && (
          <ul className={cn("space-y-1", isThumb ? "space-y-0.5" : "space-y-2")}>
            {slide.bullets.map((b, i) => (
              <li key={i} className={cn("flex items-start gap-2", bulletClass, t.bullet)}>
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 rounded-full",
                    t.accent,
                    isThumb ? "w-1 h-1 mt-1" : "w-2 h-2 mt-2"
                  )}
                />
                <span className="flex-1">{b}</span>
              </li>
            ))}
          </ul>
        )}

        {slide.body.length > 0 && (
          <div className={cn("space-y-1", isThumb ? "space-y-0.5" : "space-y-3")}>
            {slide.body.map((p, i) => (
              <p key={i} className={cn(bodyClass, t.body)}>
                {p}
              </p>
            ))}
          </div>
        )}

        {slide.code && (
          <pre className={cn(codeClass, t.codeBlock)}>
            {isThumb ? slide.code.content.slice(0, 80) : slide.code.content}
          </pre>
        )}
      </div>

      {slide.footer && (
        <p className={cn(footerClass, t.footer, "mt-2")}>{slide.footer}</p>
      )}

      {!slide.title && !slide.subtitle && slide.bullets.length === 0 && slide.body.length === 0 && !slide.code && (
        <p className={cn("text-sm italic m-auto", t.body)}>
          {isThumb ? "Empty" : "Start typing markdown on the right to render this slide."}
        </p>
      )}
    </div>
  );
}
