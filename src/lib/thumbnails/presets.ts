import { THUMB_HEIGHT, THUMB_WIDTH, type ThumbnailContext, type ThumbnailPreset } from "./types";
import { escapeSvgText, pickNumberHook, wrapLines } from "./escape";

function frame(body: string, gradient: { from: string; via?: string; to: string }): string {
  const stops = gradient.via
    ? `<stop offset="0%" stop-color="${gradient.from}"/><stop offset="50%" stop-color="${gradient.via}"/><stop offset="100%" stop-color="${gradient.to}"/>`
    : `<stop offset="0%" stop-color="${gradient.from}"/><stop offset="100%" stop-color="${gradient.to}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}" viewBox="0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${THUMB_WIDTH}" y2="${THUMB_HEIGHT}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
      <feOffset dx="0" dy="4" result="o"/>
      <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}" fill="url(#bg)"/>
  ${body}
</svg>`;
}

function brandStripe(topic: string): string {
  return `<g>
    <rect x="0" y="${THUMB_HEIGHT - 70}" width="${THUMB_WIDTH}" height="70" fill="rgba(0,0,0,0.32)"/>
    <text x="40" y="${THUMB_HEIGHT - 25}" font-family="Inter,Arial,Helvetica,sans-serif" font-size="32" font-weight="700" fill="#fff" letter-spacing="2">LUMINATE · ${escapeSvgText(topic.slice(0, 60).toUpperCase())}</text>
  </g>`;
}

// 1. Bold text — single oversized title, gradient background
function boldText(ctx: ThumbnailContext): string {
  const lines = wrapLines(ctx.title, 14, 3);
  const body = `<g font-family="Inter,Arial,Helvetica,sans-serif" font-weight="900" fill="#fff" text-anchor="start">
    ${lines
      .map((line, i) => {
        const y = 240 + i * 130;
        return `<text x="80" y="${y}" font-size="120" filter="url(#shadow)">${escapeSvgText(line)}</text>`;
      })
      .join("\n    ")}
  </g>
  ${brandStripe(ctx.topic)}`;
  return frame(body, { from: "#1e1b4b", via: "#4338ca", to: "#7c3aed" });
}

// 2. Question — title set as a question with a giant question mark
function question(ctx: ThumbnailContext): string {
  const t = /\?$/.test(ctx.title) ? ctx.title : `${ctx.title}?`;
  const lines = wrapLines(t, 18, 3);
  const body = `<g>
    <text x="${THUMB_WIDTH - 80}" y="${THUMB_HEIGHT - 100}" text-anchor="end" font-family="Inter,Arial,Helvetica,sans-serif" font-size="640" font-weight="900" fill="rgba(255,255,255,0.16)">?</text>
  </g>
  <g font-family="Inter,Arial,Helvetica,sans-serif" fill="#0f172a" text-anchor="start">
    ${lines
      .map((line, i) => {
        const y = 240 + i * 110;
        return `<text x="80" y="${y}" font-size="96" font-weight="900" filter="url(#shadow)">${escapeSvgText(line)}</text>`;
      })
      .join("\n    ")}
  </g>
  ${brandStripe(ctx.topic)}`;
  return frame(body, { from: "#fef3c7", via: "#fde68a", to: "#fbbf24" });
}

// 3. Numbered list — bold number + 2 lines of supporting copy
function numberedList(ctx: ThumbnailContext): string {
  const number = ctx.numberHook ?? pickNumberHook(ctx.title);
  const supporting = ctx.title.replace(new RegExp(`\\b${number}\\b`), "").trim();
  const lines = wrapLines(supporting || ctx.title, 22, 3);
  const body = `<g font-family="Inter,Arial,Helvetica,sans-serif">
    <text x="80" y="540" font-size="540" font-weight="900" fill="#facc15" filter="url(#shadow)">${escapeSvgText(number)}</text>
    <g fill="#fff" text-anchor="start">
      ${lines
        .map((line, i) => {
          const y = 220 + i * 90;
          return `<text x="500" y="${y}" font-size="78" font-weight="800">${escapeSvgText(line)}</text>`;
        })
        .join("\n      ")}
    </g>
  </g>
  ${brandStripe(ctx.topic)}`;
  return frame(body, { from: "#0f172a", via: "#1e293b", to: "#0f172a" });
}

// 4. Reaction — title with an emoji-like reactor and a shocked emoji
function reaction(ctx: ThumbnailContext): string {
  const lines = wrapLines(ctx.title, 16, 3);
  const body = `<g>
    <circle cx="${THUMB_WIDTH - 220}" cy="280" r="180" fill="#fff" opacity="0.92"/>
    <text x="${THUMB_WIDTH - 220}" y="340" text-anchor="middle" font-size="220" font-family="Apple Color Emoji,Segoe UI Emoji,Inter,Arial">😱</text>
  </g>
  <g font-family="Inter,Arial,Helvetica,sans-serif" fill="#fff" text-anchor="start">
    ${lines
      .map((line, i) => {
        const y = 200 + i * 110;
        return `<text x="80" y="${y}" font-size="96" font-weight="900" filter="url(#shadow)">${escapeSvgText(line)}</text>`;
      })
      .join("\n    ")}
  </g>
  ${brandStripe(ctx.topic)}`;
  return frame(body, { from: "#7f1d1d", via: "#dc2626", to: "#f97316" });
}

const HANDLERS: Record<ThumbnailPreset, (ctx: ThumbnailContext) => string> = {
  "bold-text": boldText,
  question,
  "numbered-list": numberedList,
  reaction,
};

export function renderPreset(preset: ThumbnailPreset, ctx: ThumbnailContext): string {
  return HANDLERS[preset](ctx);
}

export function renderAllPresets(
  ctx: ThumbnailContext
): Array<{ preset: ThumbnailPreset; svg: string }> {
  return (Object.keys(HANDLERS) as ThumbnailPreset[]).map((preset) => ({
    preset,
    svg: renderPreset(preset, ctx),
  }));
}

export function svgToDataUrl(svg: string): string {
  // base64 encode so the data URL works in <img src=…> regardless of inner quotes
  const encoded = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}
