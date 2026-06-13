import { describe, expect, it } from "vitest";

import {
  buildVerificationPrompt,
  parseVerdicts,
  partitionVerifiable,
  summarizeTrust,
  type ClaimToVerify,
} from "@/lib/research/verify";

const claim = (id: string, text: string, sources: ClaimToVerify["sources"]): ClaimToVerify => ({
  id,
  text,
  sources,
});

describe("partitionVerifiable", () => {
  it("splits claims by whether any cited source has usable text", () => {
    const claims = [
      claim("a", "x", [{ url: "u", title: "t", text: "real source text" }]),
      claim("b", "y", [{ url: "u2", title: "t2", text: "" }]),
      claim("c", "z", []),
    ];
    const { verifiable, unverifiable } = partitionVerifiable(claims);
    expect(verifiable.map((c) => c.id)).toEqual(["a"]);
    expect(unverifiable.map((c) => c.id)).toEqual(["b", "c"]);
  });
});

describe("buildVerificationPrompt", () => {
  it("includes claim ids, claim text, and source excerpts; asks for JSON", () => {
    const prompt = buildVerificationPrompt([
      claim("c1", "The sky is blue.", [{ url: "https://x.io", title: "X", text: "the sky appears blue" }]),
    ]);
    expect(prompt).toContain("id=c1");
    expect(prompt).toContain("The sky is blue.");
    expect(prompt).toContain("https://x.io");
    expect(prompt).toMatch(/JSON array/i);
  });
});

describe("parseVerdicts", () => {
  const ids = new Set(["c1", "c2"]);

  it("parses verdicts and filters unknown ids", () => {
    const text = '[{"claimId":"c1","status":"supported","evidence":"q"},{"claimId":"zz","status":"supported"}]';
    const v = parseVerdicts(text, ids);
    expect(v).toEqual([{ claimId: "c1", status: "supported", evidence: "q" }]);
  });

  it("normalizes any non-'supported' status to unsupported", () => {
    const text = '[{"claimId":"c2","status":"nonsense"}]';
    expect(parseVerdicts(text, ids)[0]).toEqual({ claimId: "c2", status: "unsupported" });
  });

  it("tolerates prose/code-fence wrapping", () => {
    const text = 'Result:\n```json\n[{"claimId":"c1","status":"supported"}]\n```';
    expect(parseVerdicts(text, ids)).toHaveLength(1);
  });

  it("returns [] on unparseable input", () => {
    expect(parseVerdicts("not json", ids)).toEqual([]);
    expect(parseVerdicts("", ids)).toEqual([]);
  });
});

describe("summarizeTrust", () => {
  it("counts statuses and computes grounded ratio over the total", () => {
    const verdicts = [
      { claimId: "a", status: "supported" as const },
      { claimId: "b", status: "supported" as const },
      { claimId: "c", status: "unsupported" as const },
    ];
    const s = summarizeTrust(verdicts, 1); // 1 unverifiable
    expect(s).toEqual({
      total: 4,
      supported: 2,
      unsupported: 1,
      unverifiable: 1,
      groundedRatio: 0.5,
    });
  });

  it("is 0 grounded with no claims", () => {
    expect(summarizeTrust([], 0).groundedRatio).toBe(0);
  });
});
