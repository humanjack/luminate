import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutlineEditor, seedFromMarkdown } from "@/components/workflow/outline-editor";
import type { OutlineItem, Claim } from "@/lib/db/schema";

const now = new Date();

function makeItem(partial: Partial<OutlineItem> = {}): OutlineItem {
  return {
    id: partial.id || `oi-${Math.random()}`,
    projectId: "p1",
    index: partial.index ?? 0,
    title: partial.title ?? "Section",
    summary: partial.summary ?? null,
    speakerGoal: partial.speakerGoal ?? null,
    claimIds: partial.claimIds ?? [],
    approved: partial.approved ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

describe("seedFromMarkdown", () => {
  it("splits sections on --- and pulls out the first heading + bullets", () => {
    const md = `# Intro\n- point a\n- point b\n\n---\n\n## Body\n- point c`;
    const items = seedFromMarkdown(md);
    expect(items.length).toBe(2);
    expect(items[0].title).toBe("Intro");
    expect(items[0].summary).toContain("point a");
    expect(items[1].title).toBe("Body");
    expect(items[1].approved).toBe(false);
    expect(items[1].index).toBe(1);
  });

  it("returns an empty array for empty markdown", () => {
    expect(seedFromMarkdown("")).toEqual([]);
  });
});

describe("OutlineEditor (#5)", () => {
  it("renders existing items in index order with an approval count", () => {
    const items = [
      makeItem({ id: "a", index: 0, title: "Intro", approved: true }),
      makeItem({ id: "b", index: 1, title: "Body", approved: false }),
    ];
    render(
      <OutlineEditor
        initial={items}
        onSave={vi.fn()}
      />
    );
    const titles = screen.getAllByLabelText(/Outline item .* title/);
    expect(titles[0]).toHaveValue("Intro");
    expect(titles[1]).toHaveValue("Body");
    expect(screen.getByTestId("approval-progress").textContent).toContain("1 / 2");
  });

  it("approve toggles enable the bulk save with the correct payload", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const items = [
      makeItem({ id: "a", index: 0, title: "Intro", approved: false }),
      makeItem({ id: "b", index: 1, title: "Body", approved: false }),
    ];
    render(<OutlineEditor initial={items} onSave={onSave} />);

    fireEvent.click(screen.getByTestId("approve-0"));
    fireEvent.click(screen.getByTestId("approve-1"));
    fireEvent.click(screen.getByTestId("save-outline"));

    await Promise.resolve();
    expect(onSave).toHaveBeenCalledOnce();
    const payload = onSave.mock.calls[0][0] as Array<{ approved: boolean }>;
    expect(payload.every((p) => p.approved)).toBe(true);
  });

  it("reorders items up and down", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const items = [
      makeItem({ id: "a", index: 0, title: "A" }),
      makeItem({ id: "b", index: 1, title: "B" }),
      makeItem({ id: "c", index: 2, title: "C" }),
    ];
    render(<OutlineEditor initial={items} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText("Move item 3 up"));
    fireEvent.click(screen.getByTestId("save-outline"));
    const payload = onSave.mock.calls[0][0] as Array<{ title: string; index: number }>;
    expect(payload.map((p) => p.title)).toEqual(["A", "C", "B"]);
    expect(payload.map((p) => p.index)).toEqual([0, 1, 2]);
  });

  it("removes an item and re-indexes the remaining ones", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const items = [
      makeItem({ id: "a", index: 0, title: "A" }),
      makeItem({ id: "b", index: 1, title: "B" }),
    ];
    render(<OutlineEditor initial={items} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText("Delete item 1"));
    fireEvent.click(screen.getByTestId("save-outline"));
    const payload = onSave.mock.calls[0][0] as Array<{ title: string; index: number }>;
    expect(payload.length).toBe(1);
    expect(payload[0]).toMatchObject({ title: "B", index: 0 });
  });

  it("shows unsupported-claim warnings when claims exist but item links none", () => {
    const items = [makeItem({ id: "a", index: 0, title: "Intro", claimIds: [] })];
    const claims: Claim[] = [
      {
        id: "c1",
        projectId: "p1",
        text: "Birds can fly",
        sourceIds: [],
        pinned: false,
        status: "approved",
        createdAt: now,
        updatedAt: now,
      },
    ];
    render(<OutlineEditor initial={items} claims={claims} onSave={vi.fn()} />);
    const warnings = screen.getAllByText(/unsupported/i);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("falls back to seeding from markdown when initial is empty", () => {
    render(
      <OutlineEditor
        initial={[]}
        fallbackMarkdown={"# Intro\n- a\n---\n# Outro\n- b"}
        onSave={vi.fn()}
      />
    );
    const titles = screen.getAllByLabelText(/Outline item .* title/);
    expect(titles.length).toBe(2);
    expect(titles[0]).toHaveValue("Intro");
    expect(titles[1]).toHaveValue("Outro");
  });
});
