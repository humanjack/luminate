import type { NextConfig } from "next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";
import { securityHeaders } from "./src/lib/security/headers";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Traced, minimal server bundle for container/standalone deploys (ships only
  // the files the server actually uses instead of all of node_modules).
  output: "standalone",
  // better-sqlite3 is a native addon — require it at runtime rather than
  // bundling it (also what a Docker runtime stage needs).
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Rewrite barrel imports to per-module imports (build-time only, no
    // behavior change) so we don't pull whole icon/UI packages into chunks.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-progress",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
    ],
  },
  compiler: {
    // In production strip console.log but keep error/warn (which carry our
    // logger/diagnostics). Dev keeps everything.
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },
  // Baseline security headers on every route. CSP is report-only for now (see
  // src/lib/security/headers.ts) so it observes violations without breaking the
  // app; HSTS is production-only.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(),
      },
    ];
  },
};

// Wrap with the bundle analyzer; only active when ANALYZE=1 (npm run analyze).
const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "1",
});

export default withBundleAnalyzer(nextConfig);
