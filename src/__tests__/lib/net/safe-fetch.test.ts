import { describe, it, expect, vi, afterEach } from "vitest";
import {
  assertPublicUrl,
  isPrivateIp,
  safeFetch,
  SsrfError,
  type LookupFn,
} from "@/lib/net/safe-fetch";

const publicLookup: LookupFn = async () => [
  { address: "93.184.216.34", family: 4 },
];
const privateLookup: LookupFn = async () => [
  { address: "10.0.0.5", family: 4 },
];

afterEach(() => {
  delete process.env.LUMINATE_ALLOW_PRIVATE_FETCH;
  vi.restoreAllMocks();
});

describe("isPrivateIp", () => {
  it("flags loopback / private / link-local / reserved IPv4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.5",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "224.0.0.1", // multicast
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("flags loopback / ULA / link-local / v4-mapped IPv6", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("flags IPv4-mapped IPv6 in canonical HEX form (the canonicalized bypass)", () => {
    // WHATWG URL canonicalizes ::ffff:127.0.0.1 to ::ffff:7f00:1, etc.
    for (const ip of [
      "::ffff:7f00:1", // 127.0.0.1
      "::ffff:a9fe:a9fe", // 169.254.169.254 (cloud metadata)
      "::ffff:a00:1", // 10.0.0.1
      "::ffff:c0a8:101", // 192.168.1.1
      "::7f00:1", // ::127.0.0.1 deprecated IPv4-compatible
      "64:ff9b::7f00:1", // NAT64 127.0.0.1
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("treats normal public addresses as public", () => {
    for (const ip of [
      "93.184.216.34",
      "8.8.8.8",
      "1.1.1.1",
      "2606:4700::1111",
      "::ffff:5db8:d822", // 93.184.216.34 mapped — public
    ]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("assertPublicUrl", () => {
  it("rejects non-http(s) schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertPublicUrl("ftp://example.com/x")).rejects.toBeInstanceOf(SsrfError);
    await expect(assertPublicUrl("gopher://example.com")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects malformed URLs", async () => {
    await expect(assertPublicUrl("not a url")).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects literal private/metadata IPs without any DNS lookup", async () => {
    const lookup = vi.fn(publicLookup);
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:8000/",
      "http://10.0.0.1/",
      "http://192.168.1.1/admin",
      "http://[::1]/",
      // IPv4-mapped IPv6 literals — URL canonicalizes these to hex form; the
      // guard must still reject them (regression for the review finding).
      "http://[::ffff:127.0.0.1]/",
      "http://[::ffff:169.254.169.254]/latest/meta-data/",
      "http://[::ffff:10.0.0.1]/",
    ]) {
      await expect(assertPublicUrl(url, { lookup })).rejects.toBeInstanceOf(SsrfError);
    }
    expect(lookup).not.toHaveBeenCalled(); // literal IPs short-circuit DNS
  });

  it("rejects blocked hostnames (localhost, metadata)", async () => {
    await expect(assertPublicUrl("http://localhost/")).rejects.toBeInstanceOf(SsrfError);
    await expect(
      assertPublicUrl("http://metadata.google.internal/")
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects a hostname that DNS-resolves to a private address", async () => {
    await expect(
      assertPublicUrl("http://sneaky.example.com/", { lookup: privateLookup })
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("rejects when DNS resolution fails", async () => {
    const failing: LookupFn = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(
      assertPublicUrl("http://nope.example.com/", { lookup: failing })
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("accepts a public host", async () => {
    const url = await assertPublicUrl("https://example.com/post", {
      lookup: publicLookup,
    });
    expect(url.hostname).toBe("example.com");
  });

  it("honors LUMINATE_ALLOW_PRIVATE_FETCH override", async () => {
    process.env.LUMINATE_ALLOW_PRIVATE_FETCH = "1";
    const url = await assertPublicUrl("http://127.0.0.1:8000/", { lookup: privateLookup });
    expect(url.hostname).toBe("127.0.0.1");
  });
});

describe("safeFetch", () => {
  function mockResponse(status: number, body: string, headers: Record<string, string> = {}) {
    return {
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      body: null,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    } as unknown as Response;
  }

  it("fetches a public URL and returns capped text", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(mockResponse(200, "<html>hello</html>"));
    const res = await safeFetch("https://example.com/x", { lookup: publicLookup });
    expect(res.status).toBe(200);
    expect(res.text).toContain("hello");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("never calls fetch for a private literal IP", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(mockResponse(200, "x"));
    await expect(
      safeFetch("http://169.254.169.254/", { lookup: publicLookup })
    ).rejects.toBeInstanceOf(SsrfError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-validates redirect targets and blocks a redirect to a private IP", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      mockResponse(302, "", { location: "http://169.254.169.254/" })
    );
    await expect(
      safeFetch("https://example.com/start", { lookup: publicLookup })
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("truncates a body that exceeds maxBytes", async () => {
    const big = "a".repeat(5000);
    vi.spyOn(global, "fetch").mockResolvedValue(mockResponse(200, big));
    const res = await safeFetch("https://example.com/big", {
      lookup: publicLookup,
      maxBytes: 1000,
    });
    expect(res.truncated).toBe(true);
    expect(res.text.length).toBeLessThanOrEqual(1000);
  });
});
