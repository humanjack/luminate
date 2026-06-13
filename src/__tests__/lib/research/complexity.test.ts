import { describe, expect, it } from "vitest";

import {
  MAX_SUBAGENTS,
  planFanout,
  routeResearchStrategy,
} from "@/lib/research/complexity";

describe("routeResearchStrategy", () => {
  it("scales strategy to depth", () => {
    expect(routeResearchStrategy("quick")).toBe("single");
    expect(routeResearchStrategy("detailed")).toBe("loop");
    expect(routeResearchStrategy("comprehensive")).toBe("fanout");
  });
});

describe("planFanout", () => {
  it("spawns one subagent per sub-question under the cap", () => {
    expect(planFanout(4)).toEqual({ count: 4, dropped: 0 });
  });

  it("caps subagents at MAX_SUBAGENTS and reports the dropped count", () => {
    const { count, dropped } = planFanout(MAX_SUBAGENTS + 3);
    expect(count).toBe(MAX_SUBAGENTS);
    expect(dropped).toBe(3); // surfaced, not silently truncated
  });

  it("always spawns at least one", () => {
    expect(planFanout(0).count).toBe(1);
  });
});
