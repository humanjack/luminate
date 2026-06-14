/**
 * Baseline security response headers, applied to every route from
 * next.config.ts. Conservative by design so they don't break the app:
 *
 * - The CSP ships as **Content-Security-Policy-Report-Only** first, so it
 *   observes/report violations without blocking (promote to enforcing once the
 *   report stream is clean).
 * - HSTS is only emitted in production (never on http://localhost).
 *
 * Notes specific to Luminate: previews render same-origin (`frame-ancestors
 * 'self'` / `X-Frame-Options: SAMEORIGIN`), the recording flow needs the mic
 * (`microphone=(self)`), and ffmpeg.wasm/blob media need `blob:` in media/img.
 */

const CONNECT_SRC = [
  "'self'",
  "https://api.anthropic.com",
  "https://api.openai.com",
  "https://generativelanguage.googleapis.com",
  "https://api.tavily.com",
  "https://api.search.brave.com",
];

export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    // Next.js/Turbopack inject inline bootstrap and (in dev) eval. Report-only
    // for now, so this never blocks; tighten with nonces when enforcing.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${CONNECT_SRC.join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function securityHeaders(
  isProduction = process.env.NODE_ENV === "production"
): Array<{ key: string; value: string }> {
  const headers: Array<{ key: string; value: string }> = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(self), geolocation=(), browsing-topics=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy() },
  ];

  // Only assert HSTS over real TLS — never on http://localhost in dev.
  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
