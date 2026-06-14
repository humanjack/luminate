/**
 * SSRF-hardened fetch for server-side retrieval of externally-supplied URLs.
 *
 * Any code path that fetches a URL the *user* controls (e.g. the source-import
 * route) must go through `safeFetch` / `assertPublicUrl` so an attacker cannot
 * pivot the server into internal networks — cloud metadata endpoints
 * (169.254.169.254), localhost services, or RFC-1918 ranges.
 *
 * Self-hosters who intentionally fetch internal docs can set
 * `LUMINATE_ALLOW_PRIVATE_FETCH=1` to bypass the private-range checks.
 */
import { isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

/** Injectable DNS resolver so tests can exercise the guard deterministically. */
export type LookupFn = (
  hostname: string
) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true });

function privateChecksDisabled(): boolean {
  return process.env.LUMINATE_ALLOW_PRIVATE_FETCH === "1";
}

/** Parse a dotted IPv4 string into its four octets, or null if malformed. */
function parseIPv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums as [number, number, number, number];
}

/** True for loopback / private / link-local / reserved / CGNAT IPv4. */
function isPrivateIPv4(ip: string): boolean {
  const octets = parseIPv4(ip);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && octets[2] === 0) return true; // 192.0.0.0/24 IETF
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224/4 multicast + 240/4 reserved
  return false;
}

/**
 * Expand an IPv6 string into its 8 16-bit hextets, handling `::` compression
 * and an embedded dotted-IPv4 tail (`::ffff:1.2.3.4`). Returns null if invalid.
 * Critical for SSRF: WHATWG URL canonicalizes `::ffff:127.0.0.1` to the hex
 * form `::ffff:7f00:1`, so we must compare on the numeric representation, not
 * on the dotted spelling.
 */
function expandIPv6(input: string): number[] | null {
  let addr = input.toLowerCase().split("%")[0]; // strip zone id

  // Fold an embedded dotted IPv4 tail into two hextets.
  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    addr = addr.slice(0, lastColon + 1) + hi + ":" + lo;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tailParts = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : null;

  let groups: string[];
  if (tailParts === null) {
    groups = head;
  } else {
    const missing = 8 - head.length - tailParts.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill("0"), ...tailParts];
  }
  if (groups.length !== 8) return null;

  const hextets = groups.map((g) => (g === "" ? NaN : parseInt(g, 16)));
  if (hextets.some((h) => Number.isNaN(h) || h < 0 || h > 0xffff)) return null;
  return hextets;
}

function embeddedV4IsPrivate(hi: number, lo: number): boolean {
  const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  return isPrivateIPv4(v4);
}

/** True for loopback / ULA / link-local / unspecified / v4-embedded-private IPv6. */
function isPrivateIPv6(ip: string): boolean {
  const h = expandIPv6(ip);
  if (!h) return false;

  if (h.every((x) => x === 0)) return true; // :: unspecified
  if (h.slice(0, 7).every((x) => x === 0) && h[7] === 1) return true; // ::1 loopback
  if ((h[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local

  // ::ffff:0:0/96 — IPv4-mapped
  if (
    h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 &&
    h[5] === 0xffff
  ) {
    return embeddedV4IsPrivate(h[6], h[7]);
  }
  // 64:ff9b::/96 — NAT64
  if (
    h[0] === 0x64 && h[1] === 0xff9b && h[2] === 0 && h[3] === 0 && h[4] === 0 &&
    h[5] === 0
  ) {
    return embeddedV4IsPrivate(h[6], h[7]);
  }
  // ::a.b.c.d (deprecated IPv4-compatible), excluding :: and ::1 handled above
  if (h.slice(0, 6).every((x) => x === 0) && (h[6] !== 0 || h[7] > 1)) {
    return embeddedV4IsPrivate(h[6], h[7]);
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

/**
 * Validate that `rawUrl` is an http(s) URL whose host does not resolve to a
 * private/reserved address. Throws {@link SsrfError} otherwise. Returns the
 * parsed URL on success.
 */
export async function assertPublicUrl(
  rawUrl: string,
  opts: { lookup?: LookupFn } = {}
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(`Unsupported scheme: ${url.protocol}`);
  }

  if (privateChecksDisabled()) return url;

  // WHATWG URL keeps brackets around IPv6 literals in `hostname`
  // (e.g. "[::1]") — strip them so isIP/isPrivateIp see a bare address.
  const host = url.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new SsrfError(`Blocked host: ${host}`);
  }

  // Literal IP in the URL — validate directly, no DNS needed.
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError(`Blocked private address: ${host}`);
    return url;
  }

  // Hostname — resolve every address and reject if any is private (DNS rebinding
  // and dual-stack hosts can return a mix).
  const lookup = opts.lookup ?? defaultLookup;
  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(host);
  } catch {
    throw new SsrfError(`DNS resolution failed for ${host}`);
  }
  if (!records || records.length === 0) {
    throw new SsrfError(`No addresses resolved for ${host}`);
  }
  for (const { address } of records) {
    if (isPrivateIp(address)) {
      throw new SsrfError(`${host} resolves to a private address (${address})`);
    }
  }
  return url;
}

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  text: string;
  truncated: boolean;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  lookup?: LookupFn;
}

/**
 * Fetch a user-supplied URL with SSRF protection: validates the host (and every
 * redirect hop) is public, enforces a connect/read timeout, and streams the
 * body with a hard byte cap so a malicious server can't exhaust memory.
 */
export async function safeFetch(
  rawUrl: string,
  opts: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 2_000_000;
  const maxRedirects = opts.maxRedirects ?? 5;

  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(current, { lookup: opts.lookup });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
        headers: opts.headers,
      });
    } finally {
      clearTimeout(timer);
    }

    // Manual redirect handling so we can re-validate each Location hop.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new SsrfError(`Redirect (${res.status}) with no Location header`);
      }
      if (hop === maxRedirects) {
        throw new SsrfError(`Too many redirects (>${maxRedirects})`);
      }
      current = new URL(location, url).toString();
      continue;
    }

    const { text, truncated } = await readCapped(res, maxBytes);
    return { status: res.status, finalUrl: url.toString(), text, truncated };
  }
  // Unreachable: the loop either returns or throws.
  throw new SsrfError("Redirect loop exceeded");
}

async function readCapped(
  res: Response,
  maxBytes: number
): Promise<{ text: string; truncated: boolean }> {
  // Real undici/Node Responses always expose a streaming body, which lets us
  // enforce the byte cap incrementally. The arrayBuffer/text fallbacks cover
  // non-streaming Response polyfills/mocks.
  if (!res.body || typeof res.body.getReader !== "function") {
    if (typeof res.arrayBuffer === "function") {
      const buf = Buffer.from(await res.arrayBuffer());
      const sliced = buf.subarray(0, maxBytes);
      return { text: sliced.toString("utf8"), truncated: buf.length > maxBytes };
    }
    const full = await res.text();
    return { text: full.slice(0, maxBytes), truncated: full.length > maxBytes };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > maxBytes) {
        const remaining = value.length - (total - maxBytes);
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  const decoder = new TextDecoder("utf-8");
  let text = "";
  for (const c of chunks) text += decoder.decode(c, { stream: true });
  text += decoder.decode();
  return { text, truncated };
}
